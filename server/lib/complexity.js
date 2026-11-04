'use strict';

// Static Big-O *estimates* for jsPerf test cases.
//
// The code is only ever parsed (acorn), never executed. Costs are modelled as
// n^a * (log n)^b pairs and rounded UP to the next class we can display:
// O(1), O(log n), O(log² n), O(n), O(n log n), O(n log² n), O(n^2), O(n^3), "higher" (n^4 and up), exponential or "unknown".
//
// Rules of thumb (all of them are heuristics, hence "estimate"):
//  - `n` is the size of whatever the called function iterates over; the actual
//    size of the data in the setup code is deliberately not looked at, except
//    where a bound is provably constant (see below).
//  - Loops: `i++`/`i += c`/`i--` loops run n times, `i *= 2`, `i >>= 1`,
//    `i = Math.floor(i / 2)` ... loops run log n times, nested loops multiply,
//    while/do-while loops are linear unless a halving/doubling is detected
//    (e.g. the `mid = (lo + hi) >>> 1` of a binary search).
//  - Constant bounds: a loop bound is constant when it is a number literal, a
//    never-reassigned variable initialised with a constant, `.length` of a
//    never-reassigned, never-grown array/string literal, or capped by a constant through
//    `Math.min(x, 24)`. Looping over / mapping an array literal is constant too.
//  - Built-ins: sort => n log n, indexOf/includes/slice/join/... => n,
//    forEach/map/filter/reduce/... => n * callback, push/pop/get/Math.* => 1.
//  - Recursion (conservative): one self call that halves its input costs
//    work * log n (work if work is already linear), two halving calls cost
//    n (constant work) or n log n (linear work), a non-halving single self
//    call costs work * n and several non-halving self calls are exponential
//    (exponential). Mutual recursion is "unknown".
//  - Calls compose: cost(call) = cost(callee body) + cost(arguments).
//  - A second pass (SpaceAnalyzer) estimates peak extra memory with the same classes, see its comment.
//  - Anything undecidable (calling a parameter, unknown library function,
//    eval, syntax errors, too much code/time) is "unknown".

const acorn = require('acorn');
const regex = require('./regex');
const builtins = require('./builtins');
const table = require('./builtinTable');

const DEFAULT_LIMITS = { maxCodeLength: 100000, maxSteps: 40000, maxMs: 250, maxDepth: 120, maxCalls: 12, maxPageMs: 1000, maxInternals: 8, maxNesting: 3 };

const REGEX_METHODS = new Set(['test', 'exec', 'match', 'matchAll', 'replace', 'replaceAll', 'search', 'split']);

class BudgetError extends Error {}

// ---------------------------------------------------------------------------
// cost algebra: { n, l } = n^n * log(n)^l, or null for "unknown"
// ---------------------------------------------------------------------------

const ZERO = { n: 0, l: 0 };
const LOG = { n: 0, l: 1 };
const LINEAR = { n: 1, l: 0 };
const NLOGN = { n: 1, l: 1 };
const EXPONENTIAL = { n: 99, l: 0 };
const UNKNOWN = null;

const isZero = (c) => c.n === 0 && c.l === 0;
const cmp = (a, b) => (a.n - b.n) || (a.l - b.l);
const max = (a, b) => (a === UNKNOWN || b === UNKNOWN) ? UNKNOWN : (cmp(a, b) >= 0 ? a : b);
const min = (a, b) => (cmp(a, b) <= 0 ? a : b); // only used on loop bounds, which are never unknown
const mul = (a, b) => (b === UNKNOWN) ? UNKNOWN : { n: a.n + b.n, l: a.l + b.l }; // `a` is a trip count or multiplier, never unknown

const classify = (c) => {
  if (c === UNKNOWN) {
    return 'unknown';
  }
  const { n, l } = c;
  if (n === 0) {
    return l === 0 ? 'o1' : (l === 1 ? 'ologn' : 'ologn2');
  }
  if (n === 1) {
    return l === 0 ? 'on' : (l === 1 ? 'onlogn' : 'onlogn2');
  }
  if (n === 2) {
    return l === 0 ? 'on2' : 'on3';
  }
  if (n >= EXPONENTIAL.n) {
    return 'oexp';
  }

  return (n === 3 && l === 0) ? 'on3' : 'higher';
};

const CLASSES = {
  o1: { label: 'O(1)', name: 'constant', curve: 'curve-o1' },
  ologn: { label: 'O(log n)', name: 'logarithmic', curve: 'curve-ologn' },
  ologn2: { label: 'O(log² n)', name: 'polylogarithmic', curve: 'curve-ologn2' },
  on: { label: 'O(n)', name: 'linear', curve: 'curve-on' },
  onlogn: { label: 'O(n log n)', name: 'linearithmic', curve: 'curve-onlogn' },
  onlogn2: { label: 'O(n log² n)', name: 'between linearithmic and quadratic', curve: 'curve-onlogn2' },
  on2: { label: 'O(n²)', name: 'quadratic', curve: 'curve-on2' },
  on3: { label: 'O(n³)', name: 'cubic', curve: 'curve-on3' },
  higher: { label: 'O(n⁴+)', name: 'worse than cubic', curve: 'curve-higher' },
  oexp: { label: 'O(2ⁿ)', name: 'exponential', curve: 'curve-oexp' },
  unknown: { label: 'unknown', name: 'could not be determined', curve: 'curve-unknown' }
};

// ---------------------------------------------------------------------------
// built-in knowledge
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// AST helpers
// ---------------------------------------------------------------------------

const isNode = (v) => v !== null && typeof v === 'object' && typeof v.type === 'string';
const isFn = (n) => n.type === 'FunctionExpression' || n.type === 'ArrowFunctionExpression' || n.type === 'FunctionDeclaration';
// `fn.bind(...)`: calling the result runs fn
const isBind = (n) => n.type === 'CallExpression' && n.callee.type === 'MemberExpression' && !n.callee.computed && n.callee.property.name === 'bind';

const childNodes = (node) => {
  const out = [];
  for (const key of Object.keys(node)) {
    const v = node[key];
    if (Array.isArray(v)) {
      for (const item of v) {
        if (isNode(item)) {
          out.push(item);
        }
      }
    } else if (isNode(v)) {
      out.push(v);
    }
  }

  return out;
};

// iterative pre-order walk (safe for very deep trees)
const walk = (root, visit) => {
  const stack = [root];
  while (stack.length) {
    const node = stack.pop();
    if (visit(node) === false) {
      continue;
    }

    const kids = childNodes(node);
    for (let i = kids.length - 1; i >= 0; i--) {
      stack.push(kids[i]);
    }
  }
};

const numberLiteral = (n) => n.type === 'Literal' && typeof n.value === 'number';
const stringLiteral = (n) => n.type === 'Literal' && typeof n.value === 'string';

const scalesBy = (op, lit) => {
  if (op === '*' || op === '/') {
    return (lit >= 2 && lit <= 1024) || (lit > 0 && lit < 1);
  }
  return lit >= 1 && lit <= 10; // shifts
};

const SCALE_OPS = new Set(['*', '/', '<<', '>>', '>>>']);
const SCALE_ASSIGN = new Set(['*=', '/=', '<<=', '>>=', '>>>=']);

// does the subtree multiply/divide/shift something by a small constant?
const hasScaling = (root) => {
  let found = false;
  walk(root, (node) => {
    if (found) {
      return false;
    }
    if (node.type === 'BinaryExpression' && SCALE_OPS.has(node.operator) && numberLiteral(node.right) && scalesBy(node.operator, node.right.value)) {
      found = true;
    } else if (node.type === 'AssignmentExpression' && SCALE_ASSIGN.has(node.operator) && numberLiteral(node.right) && scalesBy(node.operator.slice(0, -1), node.right.value)) {
      found = true;
    }
  });

  return found;
};

const patternNames = (pattern, out) => {
  walk(pattern, (node) => {
    if (node.type === 'Identifier') {
      out.push(node.name);
    } else if (node.type === 'AssignmentPattern') {
      patternNames(node.left, out); // the default value is not a binding
      return false;
    }
    return node.type !== 'MemberExpression'; // `obj.x = 1` does not reassign obj
  });
  return out;
};

// every name that is assigned somewhere in the subtree (=, +=, ++, for-in/of targets)
const assignedNames = (root, out) => {
  const names = [];
  walk(root, (node) => {
    if (node.type === 'AssignmentExpression') {
      patternNames(node.left, names);
    } else if (node.type === 'UpdateExpression') {
      patternNames(node.argument, names);
    } else if ((node.type === 'ForInStatement' || node.type === 'ForOfStatement') && node.left.type !== 'VariableDeclaration') {
      patternNames(node.left, names);
    }
  });
  names.forEach((name) => out.add(name));
  return out;
};

const memberName = (callee) => {
  if (!callee.computed && callee.property.type === 'Identifier') {
    return callee.property.name;
  }
  return stringLiteral(callee.property) ? callee.property.value : null;
};

const GROWERS = new Set(['push', 'unshift', 'splice']);
const LOOPS = /^(For|While|DoWhile)/;

// names of arrays/strings whose size can change, so a literal initialiser no longer proves a constant size:
// `.push()` / `.unshift()` / `.splice()` inside a loop or a function (it can run many times; `repeated` says the
// root itself runs repeatedly, as test code does), and `x[i] = ...` / `x.length = ...` anywhere
const grownNames = (root, out, repeated) => {
  const stack = [[root, repeated]];
  while (stack.length) {
    const [node, repeat] = stack.pop();
    if (node.type === 'CallExpression' && repeat && node.callee.type === 'MemberExpression' && node.callee.object.type === 'Identifier' && GROWERS.has(memberName(node.callee))) {
      out.add(node.callee.object.name);
    } else if (node.type === 'AssignmentExpression' && node.left.type === 'MemberExpression' && node.left.object.type === 'Identifier' && (memberName(node.left) === 'length' || (node.left.computed && !numberLiteral(node.left.property)))) {
      out.add(node.left.object.name);
    }

    const inner = repeat || LOOPS.test(node.type) || isFn(node);
    for (const child of childNodes(node)) {
      stack.push([child, inner]);
    }
  }

  return out;
};

// ---------------------------------------------------------------------------
// the analyzer
// ---------------------------------------------------------------------------

class Analyzer {
  constructor (limits) {
    this.limits = limits;
    this.b = builtins.profile(limits.engine);
    this.steps = 0;
    this.depth = 0;
    this.deadline = Date.now() + limits.maxMs;
    this.scopes = [new Map()];
    this.methods = new Map();
    this.assigned = new Set();
    this.ownerCache = new Map();
    this.fnSets = new Map(); // array name => the functions pushed into it
    this.listeners = []; // functions registered with addEventListener
    this.domParents = new Set(); // names of nodes that get children appended
    this.frames = [];
    this.field = 1; // which part of a table step this analyzer reads: 1 = time, 2 = memory
  }

  tick () {
    if (++this.steps > this.limits.maxSteps || Date.now() > this.deadline) {
      throw new BudgetError('analysis budget exceeded');
    }
  }

  // ---- scopes -------------------------------------------------------------

  lookup (name) {
    for (let i = this.scopes.length - 1; i >= 0; i--) {
      if (this.scopes[i].has(name)) {
        return { entry: this.scopes[i].get(name), idx: i };
      }
    }

    return null;
  }

  addMethod (name, fn) {
    if (!this.methods.has(name)) {
      this.methods.set(name, []);
    }
    this.methods.get(name).push(fn);
  }

  addObjectMethods (obj) {
    for (const prop of obj.properties) {
      if (prop.type === 'Property' && !prop.computed && isFn(prop.value)) {
        this.addMethod(prop.key.name || String(prop.key.value), prop.value);
      }
    }
  }

  addClass (map, name, cls) {
    const entry = { kind: 'class', ctor: null };
    for (const member of cls.body.body) {
      if (member.type === 'MethodDefinition' && !member.computed) {
        if (member.kind === 'constructor') {
          entry.ctor = member.value;
        } else {
          this.addMethod(member.key.name || String(member.key.value), member.value);
        }
      }
    }

    map.set(name, entry);
  }

  // registers the functions, classes and variables declared by a statement list
  collectDefs (statements, map, owner = null) {
    for (const s of statements) {
      if (s.type === 'FunctionDeclaration') {
        map.set(s.id.name, { kind: 'fn', node: s });
      } else if (s.type === 'ClassDeclaration') {
        this.addClass(map, s.id.name, s);
      } else if (s.type === 'VariableDeclaration') {
        for (const d of s.declarations) {
          this.collectDeclarator(d, map, owner);
        }
      } else if (s.type === 'ExpressionStatement') {
        this.collectExpression(s.expression, map);
      }
    }
  }

  collectDeclarator (d, map, owner) {
    if (d.id.type !== 'Identifier') {
      for (const name of patternNames(d.id, [])) {
        map.set(name, { kind: 'var', init: null, owner });
      }
      return;
    }

    const init = d.init;
    if (init && isFn(init)) {
      map.set(d.id.name, { kind: 'fn', node: init });
    } else if (init && init.type === 'ClassExpression') {
      this.addClass(map, d.id.name, init);
    } else {
      map.set(d.id.name, { kind: 'var', init, owner });
      if (init && init.type === 'ObjectExpression') {
        this.addObjectMethods(init);
      }
    }
  }

  collectExpression (expr, map) {
    if (expr.type === 'AssignmentExpression' && expr.operator === '=' && isFn(expr.right)) {
      if (expr.left.type === 'Identifier') {
        map.set(expr.left.name, { kind: 'fn', node: expr.right });
      } else if (expr.left.type === 'MemberExpression' && memberName(expr.left)) {
        this.addMethod(memberName(expr.left), expr.right);
      }
    } else if (expr.type === 'CallExpression' && isFn(expr.callee) && expr.callee.body.type === 'BlockStatement') {
      // IIFE: its declarations are visible to the rest of the page
      this.collectDefs(expr.callee.body.body, map);
    }
  }

  // ---- constants / sizes ----------------------------------------------------

  // is `name` reassigned / grown? Page level names are checked across all the code, names declared in a block or
  // function only within that block or function, so an unrelated `n = ...` elsewhere does not matter
  isAssigned (name, owner) {
    if (!owner) {
      return this.assigned.has(name);
    }

    if (!this.ownerCache.has(owner)) {
      const root = Array.isArray(owner) ? { type: 'BlockStatement', body: owner } : owner;
      this.ownerCache.set(owner, grownNames(root, assignedNames(root, new Set()), true));
    }

    return this.ownerCache.get(owner).has(name);
  }

  constEntry (name) {
    const found = this.lookup(name);
    return (found && found.entry.kind === 'var' && found.entry.init && !this.isAssigned(name, found.entry.owner)) ? found.entry.init : null;
  }

  // cost of walking the elements of `expr` (arrays/strings written as literals are constant sized)
  sizeCost (expr) {
    let target = expr;
    if (target.type === 'Identifier') {
      target = this.constEntry(target.name) || target;
    }

    if (target.type === 'ObjectExpression') {
      // an array-like `{ length: n }` is as big as its length, any other object literal has a fixed number of properties
      const length = target.properties.find((p) => p.type === 'Property' && !p.computed && (p.key.name || p.key.value) === 'length');
      return target.properties.some((p) => p.type === 'SpreadElement') ? LINEAR : (length ? this.boundCost(length.value) : ZERO);
    }

    const fixed = target.type === 'ArrayExpression' && !target.elements.some((e) => e && e.type === 'SpreadElement');
    return (fixed || target.type === 'TemplateLiteral' || stringLiteral(target)) ? ZERO : LINEAR;
  }

  // upper bound of the *value* of a loop bound expression
  boundCost (expr, depth = 0) {
    this.tick();
    if (depth > 8) {
      return LINEAR;
    }

    const bound = (e) => this.boundCost(e, depth + 1);
    switch (expr.type) {
      case 'Literal':
        return typeof expr.value === 'number' ? ZERO : LINEAR;
      case 'Identifier': {
        const init = this.constEntry(expr.name);
        return init ? bound(init) : LINEAR;
      }
      case 'MemberExpression':
        return (!expr.computed && expr.property.name === 'length') ? this.sizeCost(expr.object) : LINEAR;
      case 'UnaryExpression':
        return bound(expr.argument);
      case 'ConditionalExpression':
        return max(bound(expr.consequent), bound(expr.alternate));
      case 'BinaryExpression':
        return this.binaryBound(expr, bound);
      case 'CallExpression':
        return this.callBound(expr, bound);
      default:
        return LINEAR;
    }
  }

  binaryBound (expr, bound) {
    const left = bound(expr.left);
    const right = bound(expr.right);
    switch (expr.operator) {
      case '*':
        return mul(left, right);
      case '%':
        return min(left, right);
      case '+':
      case '-':
        return max(left, right);
      case '/':
      case '>>':
      case '>>>':
      case '<<':
        return left;
      default:
        return LINEAR;
    }
  }

  callBound (expr, bound) {
    const callee = expr.callee;
    if (callee.type !== 'MemberExpression' || callee.object.name !== 'Math' || expr.arguments.length === 0) {
      return LINEAR;
    }

    const args = expr.arguments.map(bound);
    switch (memberName(callee)) {
      case 'min':
        return args.reduce(min);
      case 'max':
        return args.reduce(max);
      case 'log':
      case 'log2':
      case 'log10':
        return isZero(args[0]) ? ZERO : LOG;
      case 'abs':
      case 'floor':
      case 'ceil':
      case 'round':
      case 'trunc':
      case 'sqrt': // rounded up to the argument itself
        return args[0];
      default:
        return LINEAR;
    }
  }

  // ---- loops ----------------------------------------------------------------

  forTrip (node) {
    const { init, test, update } = node;
    let loopVar = null;
    let logUpdate = false;
    if (update && update.type === 'UpdateExpression' && update.argument.type === 'Identifier') {
      loopVar = update.argument.name;
    } else if (update && update.type === 'AssignmentExpression' && update.left.type === 'Identifier') {
      loopVar = update.left.name;
      logUpdate = hasScaling(update);
    }

    let bound = test ? this.testBound(test, loopVar) : LINEAR;
    // counting down starts at the real bound (`for (j = i; j > 0; j--)`), counting up starts at a lower limit
    if (this.descending(test, update, loopVar)) {
      // an unknown starting point (no initialiser, or not for this variable) is assumed to be n
      const starts = init ? this.loopStarts(init, loopVar) : [];
      bound = starts.length ? starts.reduce((acc, start) => max(acc, this.boundCost(start)), bound) : LINEAR;
    }

    return (logUpdate && !isZero(bound)) ? LOG : bound;
  }

  // the expressions the loop variable is initialised with
  loopStarts (init, loopVar) {
    if (init.type === 'VariableDeclaration') {
      return init.declarations.filter((d) => d.init && d.id.name === loopVar).map((d) => d.init);
    }

    return (init.type === 'AssignmentExpression' && init.left.name === loopVar) ? [init.right] : [];
  }

  descending (test, update, loopVar) {
    const isVar = (node) => node.type === 'Identifier' && node.name === loopVar;
    if (update && (update.operator === '--' || ['-=', '/=', '>>=', '>>>='].includes(update.operator))) {
      return true;
    }

    return Boolean(test) && test.type === 'BinaryExpression' && ((test.operator[0] === '>' && isVar(test.left)) || (test.operator[0] === '<' && isVar(test.right)));
  }

  testBound (test, loopVar) {
    if (test.type === 'LogicalExpression') {
      const a = this.testBound(test.left, loopVar);
      const b = this.testBound(test.right, loopVar);
      return test.operator === '&&' ? min(a, b) : max(a, b);
    }

    if (test.type === 'BinaryExpression' && ['<', '<=', '>', '>=', '!=', '!=='].includes(test.operator)) {
      if (test.left.type === 'Identifier' && test.left.name === loopVar) {
        return this.boundCost(test.right);
      }
      if (test.right.type === 'Identifier' && test.right.name === loopVar) {
        return this.boundCost(test.left);
      }
      // `i * i <= n` stops at sqrt(n): no sqrt class exists, so report the cheaper bound's cost (an upper bound)
      const isSquare = (node) => node.type === 'BinaryExpression' && node.operator === '*' && node.left.type === 'Identifier' && node.left.name === loopVar && node.right.type === 'Identifier' && node.right.name === loopVar;
      if (loopVar && isSquare(test.left)) {
        return this.boundCost(test.right);
      }
      if (loopVar && isSquare(test.right)) {
        return this.boundCost(test.left);
      }

      return max(this.boundCost(test.left), this.boundCost(test.right));
    }

    return LINEAR;
  }

  whileTrip (node) {
    const testNames = new Set();
    walk(node.test, (n) => {
      if (n.type === 'Identifier') {
        testNames.add(n.name);
      }
    });

    let scaled = false;
    let linear = false;
    walk(node.body, (n) => {
      if (n.type === 'UpdateExpression' && testNames.has(n.argument.name)) {
        linear = true;
      } else if (n.type === 'AssignmentExpression' && n.left.type === 'Identifier' && testNames.has(n.left.name)) {
        if (n.operator === '+=' || n.operator === '-=') {
          linear = true;
        } else if (hasScaling(n)) {
          scaled = true;
        }
      }
    });

    if (scaled) {
      return LOG;
    }

    // `mid = (lo + hi) >>> 1; lo = mid + 1` style loops move their bounds through another variable
    return (!linear && (hasScaling(node.body) || hasScaling(node.test))) ? LOG : LINEAR;
  }

  loopTrip (node) {
    switch (node.type) {
      case 'ForStatement':
        return this.forTrip(node);
      case 'ForOfStatement':
      case 'ForInStatement':
        return this.sizeCost(node.right);
      default:
        return this.whileTrip(node);
    }
  }

  // ---- cost of statements and expressions ----------------------------------------

  cost (node) {
    this.tick();
    if (++this.depth > this.limits.maxDepth) {
      throw new BudgetError('nesting too deep');
    }

    try {
      return this.costNode(node);
    } finally {
      this.depth--;
    }
  }

  costAll (nodes) {
    return nodes.reduce((acc, n) => max(acc, this.cost(n)), ZERO);
  }

  costNode (node) {
    switch (node.type) {
      case 'Program':
        return this.costAll(node.body);
      case 'BlockStatement':
      case 'StaticBlock':
        return this.withScope(node.body, () => this.costAll(node.body));
      case 'FunctionDeclaration':
      case 'FunctionExpression':
      case 'ArrowFunctionExpression':
      case 'ClassDeclaration':
      case 'ClassExpression':
        return ZERO;
      case 'IfStatement':
      case 'ConditionalExpression':
        return max(this.cost(node.test), this.branches([node.consequent, node.alternate].filter(Boolean)));
      case 'SwitchStatement':
        return max(this.cost(node.discriminant), this.branches(node.cases));
      case 'ForStatement':
        return max(this.costAll([node.init, node.test, node.update].filter(Boolean)), this.forCost(node));
      case 'WhileStatement':
      case 'DoWhileStatement':
        return this.loopCost(node, [node.test, node.body]);
      case 'ForOfStatement':
      case 'ForInStatement':
        return max(this.cost(node.right), this.loopCost(node, [node.body]));
      case 'CallExpression':
        return this.costCall(node);
      case 'NewExpression':
        return this.costNew(node);
      case 'TaggedTemplateExpression':
      case 'ImportExpression':
        return UNKNOWN;
      default:
        return this.costAll(childNodes(node));
    }
  }

  // only one branch runs per call, so recursive call sites in sibling branches do not add up
  branches (parts) {
    const frames = this.frames.slice();
    const base = frames.map((f) => f.sites);
    const most = base.map(() => 0);
    let total = ZERO;
    for (const part of parts) {
      frames.forEach((f, i) => { f.sites = base[i]; });
      total = max(total, this.cost(part));
      frames.forEach((f, i) => { most[i] = Math.max(most[i], f.sites - base[i]); });
    }

    frames.forEach((f, i) => { f.sites = base[i] + most[i]; });
    return total;
  }

  // `i += step` with a non-literal step walks the input in blocks (bottom-up merge sort): the work inside one
  // block is bounded by the block size, so when it is at least linear all blocks together cost no more than that
  isStrided (node) {
    const { update } = node;
    return Boolean(update) && update.type === 'AssignmentExpression' && (update.operator === '+=' || update.operator === '-=') && !numberLiteral(update.right);
  }

  forCost (node) {
    const body = this.costAll([node.test, node.update, node.body].filter(Boolean));
    return (this.isStrided(node) && body !== UNKNOWN && body.n >= 1) ? body : mul(this.forTrip(node), body);
  }

  loopCost (node, parts) {
    return mul(this.loopTrip(node), this.costAll(parts.filter(Boolean)));
  }

  withScope (statements, fn) {
    const map = new Map();
    this.collectDefs(statements, map, statements);
    this.scopes.push(map);
    try {
      return fn();
    } finally {
      this.scopes.pop();
    }
  }

  // cost of a function body, evaluated in the scope it was defined in
  costFunction (fn, idx, inline = false, args = []) {
    const at = this.frames.findLastIndex((f) => f.fn === fn);
    if (at >= 0) {
      // a call back into a running function is plain recursion unless a named function sits in between
      if (this.frames.slice(at + 1).every((f) => f.inline)) {
        this.frames[at].sites++;
        return ZERO;
      }

      return UNKNOWN; // mutual recursion
    }

    return this.inFunction(fn, idx, inline, args, (frame) => {
      const work = this.cost(fn.body);
      return frame.sites === 0 ? work : this.recursive(fn, work, frame.sites);
    });
  }

  // runs `run` with the scope a call of `fn` sees: its parameters (bound to the callbacks and constants in `args`)
  // on top of the scope it was defined in
  inFunction (fn, idx, inline, args, run) {
    const frame = { fn, inline, sites: 0 };
    const callbacks = fn.params.map((p, i) => (p.type === 'Identifier' && args[i]) ? (args[i].bound || this.functionValue(args[i])) : null);
    const numbers = fn.params.map((p, i) => (p.type === 'Identifier' && args[i]) ? this.numberValue(args[i]) : null);
    this.frames.push(frame);
    const saved = this.scopes;
    this.scopes = saved.slice(0, idx + 1);
    const params = new Map();
    fn.params.forEach((p, i) => {
      for (const name of patternNames(p, [])) {
        // a parameter bound to a numeric constant is a value, not a size: loops bounded by it are constant
        params.set(name, numbers[i] ? { kind: 'var', init: numbers[i], owner: fn.body } : { kind: 'param', callback: callbacks[i] });
      }
    });

    this.scopes.push(params);
    try {
      return run(frame);
    } finally {
      this.scopes = saved;
      this.frames.pop();
    }
  }

  // conservative divide & conquer / linear recursion rule, see top of file
  recursive (fn, work, sites) {
    if (work === UNKNOWN) {
      return UNKNOWN;
    }

    if (hasScaling(fn.body)) {
      if (sites === 1) {
        return work.n === 0 ? { n: 0, l: work.l + 1 } : work;
      }
      if (sites === 2) {
        return work.n === 0 ? LINEAR : (work.n === 1 ? { n: 1, l: work.l + 1 } : work);
      }
      return mul(work, { n: Math.ceil(Math.log2(sites)), l: 0 });
    }

    return sites === 1 ? mul(work, LINEAR) : EXPONENTIAL;
  }

  // the number literal an argument expression is known to be (itself, or a never-reassigned constant), else null
  numberValue (arg) {
    const init = arg.type === 'Identifier' ? this.constEntry(arg.name) : arg;
    return init && numberLiteral(init) ? init : null;
  }

  // the function an argument expression stands for at a call site (an inline function, a named one, or a callback
  // parameter that was itself bound to one), so that calling the matching parameter can be costed; null if unknown
  functionValue (arg) {
    if (isFn(arg)) {
      return { node: arg, idx: this.scopes.length - 1 };
    }
    if (isBind(arg)) {
      return this.functionValue(arg.callee.object);
    }

    const found = arg.type === 'Identifier' ? this.lookup(arg.name) : null;
    if (found && found.entry.kind === 'fn') {
      return { node: found.entry.node, idx: found.idx };
    }

    return found && found.entry.kind === 'param' ? found.entry.callback : null;
  }

  // cost of invoking a function-valued expression (identifier or inline function)
  calleeCost (expr, bound = null) {
    if (isFn(expr)) {
      return this.costFunction(expr, this.scopes.length - 1, true, bound ? [{ bound }] : []);
    }
    if (isBind(expr)) {
      return this.calleeCost(expr.callee.object);
    }

    return expr.type === 'Identifier' ? this.identifierCall(expr.name) : UNKNOWN;
  }

  // spreading an array / string into a call passes every element
  argsCost (args) {
    const spread = args.filter((a) => a.type === 'SpreadElement').map((a) => this.sizeCost(a.argument));
    return spread.reduce(max, this.costAll(args.filter((a) => !isFn(a))));
  }

  costCall (node) {
    const { callee } = node;
    const args = this.argsCost(node.arguments);
    if (callee.type === 'Identifier') {
      // `Array(n)` allocates like `new Array(n)`
      return max(args, (callee.name === 'Array' && !this.lookup('Array')) ? this.costNew(node) : this.identifierCall(callee.name, node.arguments));
    }
    if (callee.type === 'MemberExpression' && callee.computed && callee.object.type === 'Identifier' && this.fnSets.has(callee.object.name)) {
      // `handlers[i](x)`: any of the functions kept in the array
      return max(args, this.fnSets.get(callee.object.name).reduce((acc, e) => max(acc, this.costEntry(e)), this.cost(callee.property)));
    }
    if (callee.type === 'MemberExpression') {
      return max(args, this.methodCall(node, callee));
    }
    if (isFn(callee) || callee.type === 'Super') {
      return max(args, callee.type === 'Super' ? ZERO : this.calleeCost(callee));
    }

    return UNKNOWN;
  }

  identifierCall (name, args = []) {
    const found = this.lookup(name);
    if (found) {
      if (found.entry.kind === 'param' && found.entry.callback) {
        const { callback } = found.entry;
        if (callback.multi) {
          return callback.multi.reduce((acc, e) => max(acc, this.costEntry(e)), ZERO);
        }

        return this.costFunction(callback.node, callback.idx, callback.node.type !== 'FunctionDeclaration', args);
      }
      if (found.entry.kind === 'var' && found.entry.init && isBind(found.entry.init)) {
        return this.calleeCost(found.entry.init);
      }

      return found.entry.kind === 'fn' ? this.costFunction(found.entry.node, found.idx, false, args) : UNKNOWN;
    }

    if (this.b.O1_GLOBAL_FUNCTIONS.has(name)) {
      return ZERO;
    }

    return this.b.N_GLOBAL_FUNCTIONS.has(name) ? LINEAR : UNKNOWN;
  }

  methodCall (node, callee) {
    const name = memberName(callee);
    const receiver = callee.object;
    if (name === null) {
      return UNKNOWN;
    }

    const ns = receiver.type === 'Identifier' ? this.builtinName(receiver.name) : null;
    if (ns !== null && !this.lookup(ns)) {
      const known = this.staticCall(node, ns, name);
      if (known !== undefined) {
        return known;
      }
    }

    if ((name === 'call' || name === 'apply') && receiver.type === 'MemberExpression' && memberName(receiver) && !this.methods.has(memberName(receiver))) {
      return this.borrowedMethod(node, memberName(receiver), name);
    }
    if (name === 'call' || name === 'apply') {
      const own = receiver.type === 'MemberExpression' ? this.methods.get(memberName(receiver)) : null;
      return own ? own.reduce((acc, fn) => max(acc, this.costFunction(fn, 0)), ZERO) : this.calleeCost(receiver);
    }

    const recv = this.cost(receiver);
    if (this.methods.has(name)) {
      // the page defines a method of that name: assume that is the one being called
      return this.methods.get(name).reduce((acc, fn) => max(acc, this.costFunction(fn, 0)), recv);
    }
    if (name === 'dispatchEvent') {
      return max(recv, this.dispatchCost());
    }

    const elements = (this.b.CALLBACK_METHODS.has(name) && receiver.type === 'Identifier' && this.fnSets.has(receiver.name)) ? { multi: this.fnSets.get(receiver.name) } : null;
    const cost = this.builtinMethod(name, recv, this.sizeCost(receiver), this.callbackCost(node.arguments[0], elements), node);
    return (cost !== UNKNOWN && this.backtracks(name, node)) ? EXPONENTIAL : cost;
  }

  // the built-in a name stands for (`var Kind = Float64Array`), or the name itself
  builtinName (name) {
    let current = name;
    for (let i = 0; i < 4; i++) {
      const found = this.lookup(current);
      const init = found && found.entry.kind === 'var' && !this.assigned.has(current) ? found.entry.init : null;
      if (!init || init.type !== 'Identifier') {
        return current;
      }
      current = init.name;
    }

    return name;
  }

  // `Array.prototype.push.apply(a, b)` / `Object.prototype.hasOwnProperty.call(o, k)`: a built-in run on another receiver
  borrowedMethod (node, method, how) {
    const [self, ...rest] = node.arguments;
    const synthetic = { callee: { object: self || { type: 'Identifier', name: 'undefined' } }, arguments: how === 'call' ? rest : [] };
    const spread = how === 'apply' && rest[0] ? this.sizeCost(rest[0]) : ZERO; // `apply` passes every element as an argument
    return max(spread, this.builtinMethod(method, ZERO, self ? this.sizeCost(self) : ZERO, ZERO, synthetic));
  }

  // ---- functions kept in arrays and event listeners -------------------------------

  // the cost of one function recorded by collectFunctions, seen from the scope it was found in
  costEntry (entry) {
    const saved = this.scopes;
    this.scopes = saved.slice(0, entry.idx + 1);
    if (entry.env.size > 0) {
      this.scopes.push(new Map([...entry.env].map(([name, multi]) => [name, { kind: 'param', callback: { multi } }])));
    }

    try {
      return this.costFunction(entry.node, this.scopes.length - 1, true);
    } finally {
      this.scopes = saved;
    }
  }

  // an event dispatch runs every registered listener once (how many there are is whatever the registration loops say)
  dispatchCost () {
    return this.listeners.reduce((acc, l) => max(acc, mul(l.mult, this.costEntry(l))), ZERO);
  }

  // finds the functions a page keeps in arrays (`list.push(fn)`, `[fn, fn]`) and registers as event listeners, so that
  // calling an element of such an array, or a listener-less `dispatchEvent`, can be costed
  collectFunctions (root) {
    walk(root, (node) => {
      if (node.type === 'CallExpression' && node.callee.type === 'MemberExpression' && node.callee.object.type === 'Identifier' && ['appendChild', 'insertBefore', 'replaceChild', 'insertAdjacentHTML', 'append', 'prepend'].includes(memberName(node.callee))) {
        this.domParents.add(node.callee.object.name);
      } else if (node.type === 'AssignmentExpression' && node.left.type === 'MemberExpression' && node.left.object.type === 'Identifier' && memberName(node.left) === 'innerHTML') {
        this.domParents.add(node.left.object.name);
      }
    });

    const entryFor = (arg, env) => {
      const value = this.functionValue(arg);
      return value && !value.multi ? { node: value.node, idx: value.idx, env } : null;
    };
    const addTo = (name, arg, env) => {
      const entry = entryFor(arg, env);
      if (entry) {
        this.fnSets.set(name, (this.fnSets.get(name) || []).concat(entry));
      }
    };

    const visit = (node, mult, env, depth) => {
      this.tick();
      if (depth > this.limits.maxDepth) {
        throw new BudgetError('nesting too deep');
      }

      let inner = mult;
      let scope = env;
      if (node.type === 'CallExpression' && node.callee.type === 'MemberExpression' && !node.callee.computed) {
        const name = memberName(node.callee);
        const target = node.callee.object;
        if (name === 'push' && target.type === 'Identifier') {
          node.arguments.forEach((arg) => addTo(target.name, arg, env));
        } else if (name === 'addEventListener' && node.arguments[1]) {
          const entry = entryFor(node.arguments[1], env);
          if (entry) {
            this.listeners.push(Object.assign(entry, { mult }));
          }
        } else if (name === 'forEach' && target.type === 'Identifier' && this.fnSets.has(target.name) && node.arguments[0] && isFn(node.arguments[0]) && node.arguments[0].params[0]) {
          const [param] = node.arguments[0].params;
          if (param.type === 'Identifier') {
            scope = new Map(env).set(param.name, this.fnSets.get(target.name));
            inner = mul(mult, this.sizeCost(target));
          }
        }
      } else if (node.type === 'VariableDeclarator' && node.id.type === 'Identifier' && node.init && node.init.type === 'ArrayExpression') {
        node.init.elements.forEach((el) => el && addTo(node.id.name, el, env));
      } else if (node.type === 'AssignmentExpression' && node.left.type === 'Identifier' && node.right.type === 'ArrayExpression') {
        node.right.elements.forEach((el) => el && addTo(node.left.name, el, env));
      } else if (/^(For|While|DoWhile)/.test(node.type)) {
        inner = mul(mult, this.loopTrip(node));
      }

      for (const child of childNodes(node)) {
        // an inline callback's body is visited with the loops around it, a function declaration's is not run here
        if (isFn(child) && child.type === 'FunctionDeclaration') {
          continue;
        }
        visit(child, inner, scope, depth + 1);
      }
    };

    visit(root, ZERO, new Map(), 0);
  }

  // is the receiver a string that is already stored (a variable or property, not a fresh concatenation or call result)?
  // `substring` / `substr` only exist on strings, `slice` is also an array method so it needs a sign that it is text
  storedString (name, receiver) {
    const isText = (e) => stringLiteral(e) || e.type === 'TemplateLiteral';
    if (isText(receiver)) {
      return true;
    }
    if (receiver.type !== 'Identifier' && receiver.type !== 'MemberExpression') {
      return false;
    }

    const found = receiver.type === 'Identifier' ? this.lookup(receiver.name) : null;
    const init = found && found.entry.kind === 'var' ? found.entry.init : null;
    return name !== 'slice' || (Boolean(init) && isText(init));
  }

  // `repeat(count)` / `padStart(width)` build a result as long as their argument says, whatever the receiver is
  argSized (name, size, node) {
    const length = node.arguments[0] ? this.boundCost(node.arguments[0]) : ZERO;
    if (this.b.ropes) {
      return isZero(length) ? ZERO : LOG; // doubling concatenations, nothing is copied until the string is read
    }

    return name === 'repeat' ? mul(size, length) : max(size, length);
  }

  // a regular expression with a quantified group that contains a quantifier can backtrack exponentially
  backtracks (name, node) {
    if (!REGEX_METHODS.has(name)) {
      return false;
    }

    const literal = [node.callee.object, node.arguments[0]].find((e) => e && e.type === 'Literal' && e.regex);
    return Boolean(literal) && /\((?:[^()\\]|\\.)*[+*](?:[^()\\]|\\.)*\)[+*]|\((?:[^()\\]|\\.)*[+*](?:[^()\\]|\\.)*\)\{\d+,\d*\}/.test(literal.regex.pattern);
  }

  // the number of nodes a DOM insertion / removal walks: one for a node made by createElement that never got children
  subtreeCost (arg) {
    const created = (e) => e.type === 'CallExpression' && e.callee.type === 'MemberExpression' && ['createElement', 'createTextNode', 'createComment'].includes(memberName(e.callee));
    if (!arg) {
      return ZERO;
    }

    const found = arg.type === 'Identifier' ? this.lookup(arg.name) : null;
    const init = found && found.entry.kind === 'var' ? found.entry.init : null;
    return (created(arg) || (init && created(init) && !this.domParents.has(arg.name))) ? ZERO : LINEAR;
  }

  // the size a DOM method's steps are in: the nodes it moves, the markup it parses, the value it serializes, or the tree
  domSize (row, node) {
    const [first, second] = node.arguments;
    switch (row.spec.time) {
      case 'markup':
        return second ? this.sizeCost(second) : ZERO;
      case 'tree':
        return this.isIdSelector(first) ? ZERO : LINEAR;
      case 'n':
        return first ? this.sizeCost(first) : ZERO;
      case 'log':
        return LOG;
      default:
        return this.subtreeCost(first);
    }
  }

  // is the selector a literal `#id`, which the browser answers with a hash lookup
  isIdSelector (arg) {
    return Boolean(arg) && arg.type === 'Literal' && typeof arg.value === 'string' && /^#[\w-]+$/.test(arg.value);
  }

  // DOM methods; undefined when `name` is not one
  domMethod (name, recv, node) {
    const { b } = this;
    switch (b.DOM.get(name)) {
      case '1':
        return recv;
      case 'subtree':
        return max(recv, this.subtreeCost(node.arguments[0]));
      case 'markup':
        return max(recv, node.arguments[1] ? this.sizeCost(node.arguments[1]) : ZERO);
      case 'tree':
        return max(recv, this.isIdSelector(node.arguments[0]) ? ZERO : LINEAR);
      case 'log':
        return max(recv, LOG);
      case 'n':
        return max(recv, node.arguments[0] ? this.sizeCost(node.arguments[0]) : ZERO);
      default:
        return undefined;
    }
  }

  // cost of a built-in instance method given the cost of its receiver, the receiver's size and one callback call
  builtinMethod (name, recv, size, callback, node) {
    const { b } = this;
    const dom = this.domMethod(name, recv, node);
    if (dom !== undefined) {
      return dom;
    }
    if (b.ARG_SIZED.has(name)) {
      return max(recv, this.argSized(name, size, node));
    }
    if (b.STRING_O1_METHODS.has(name) && this.storedString(name, node.callee.object)) {
      return recv;
    }
    if (b.O1_METHODS.has(name)) {
      return recv;
    }
    if (b.LOG_METHODS.has(name)) {
      return max(recv, LOG);
    }
    if (b.N_METHODS.has(name)) {
      return max(recv, size);
    }
    if (b.CALLBACK_METHODS.has(name)) {
      return max(recv, mul(size, callback));
    }
    if (b.ONCE_CALLBACK_METHODS.has(name)) {
      return max(recv, callback);
    }

    return b.SORT_METHODS.has(name) ? max(recv, mul(isZero(size) ? ZERO : NLOGN, callback)) : UNKNOWN;
  }

  // cost of one invocation of a callback argument; no callback => constant (default comparator, ...)
  callbackCost (arg, bound = null) {
    return arg ? this.calleeCost(arg, bound) : ZERO;
  }

  // Math.x(), Object.keys(x), JSON.parse(x), Array.from(x, fn) ...; undefined when `ns.name` is not a known built-in
  staticCall (node, ns, name) {
    const first = node.arguments[0];
    if ((ns === 'Array' || this.b.TYPED_ARRAYS.has(ns)) && name === 'from') {
      return first ? this.fromCost(this.sizeCost(first), this.callbackCost(node.arguments[1])) : ZERO;
    }
    if (this.b.N_STATICS.has(ns) && this.b.N_STATICS.get(ns).has(name)) {
      return this.staticSize(name, node.arguments);
    }
    if (this.b.O1_NAMESPACES.has(ns) || (this.b.O1_STATICS.has(ns) && this.b.O1_STATICS.get(ns).has(name))) {
      return ZERO;
    }

    return undefined;
  }

  fromCost (size, callback) {
    return mul(size, callback);
  }

  // Object.assign copies from its sources (every argument after the first), the others walk their first argument
  staticSize (name, args) {
    const read = name === 'assign' ? args.slice(1) : args.slice(0, 1);
    return read.reduce((acc, arg) => max(acc, this.sizeCost(arg)), ZERO);
  }

  costNew (node) {
    const args = this.argsCost(node.arguments);
    const { callee } = node;
    if (callee.type === 'MemberExpression' && callee.object.type === 'Identifier' && this.b.O1_NAMESPACES.has(callee.object.name) && !this.lookup(callee.object.name)) {
      return args; // new Intl.NumberFormat(...), new Date(...)
    }
    if (callee.type !== 'Identifier') {
      return UNKNOWN;
    }

    const alias = this.builtinName(callee.name);
    const found = this.lookup(alias);
    if (found) {
      const { entry } = found;
      if (entry.kind === 'class') {
        return max(args, entry.ctor ? this.costFunction(entry.ctor, found.idx) : ZERO);
      }
      return max(args, entry.kind === 'fn' ? this.costFunction(entry.node, found.idx) : UNKNOWN);
    }

    const first = node.arguments[0];
    if (this.b.SIZED_CONSTRUCTORS.has(alias)) {
      const size = !first ? ZERO : ((numberLiteral(first) || first.type === 'ArrayExpression') ? ZERO : this.sizeCost(first));
      return max(args, size);
    }

    if (alias === 'Promise') {
      return max(args, this.callbackCost(first)); // the executor runs once
    }

    return this.b.O1_CONSTRUCTORS.has(alias) ? args : UNKNOWN;
  }

  // ---- the calls of a test body ------------------------------------------------

  // outermost calls in source order with the multiplier of the loops enclosing them
  listCalls (program) {
    const out = [];
    const visit = (node, mult, depth) => {
      this.tick();
      if (depth > this.limits.maxDepth) {
        throw new BudgetError('nesting too deep');
      }
      if (isFn(node) || node.type === 'ClassDeclaration') {
        return;
      }
      if (node.type === 'CallExpression' || node.type === 'NewExpression') {
        out.push({ node, mult });
        return;
      }

      let inner = mult;
      if (/^(For|While|DoWhile)/.test(node.type) && !(node.type === 'ForStatement' && this.isStrided(node))) {
        inner = mul(mult, this.loopTrip(node));
      }

      for (const child of childNodes(node)) {
        visit(child, inner, depth + 1);
      }
    };

    for (const stmt of program.body) {
      visit(stmt, ZERO, 0);
    }

    return out;
  }

  // ---- what a call is made of ----------------------------------------------------

  // a fresh time and step budget, for work done after the answer is known
  resetBudget () {
    this.steps = 0;
    this.deadline = Date.now() + this.limits.maxMs;
  }

  // the owners of the methods a receiver most likely has, best first (the table keeps one row per owner)
  ownerHints (receiver) {
    const found = receiver.type === 'Identifier' ? this.lookup(receiver.name) : null;
    const init = found && found.entry.kind === 'var' && found.entry.init ? found.entry.init : receiver;
    if (stringLiteral(init) || init.type === 'TemplateLiteral') {
      return ['String.prototype'];
    }
    if (init.type === 'ArrayExpression') {
      return ['Array.prototype'];
    }
    if (init.type === 'Literal') {
      return [init.regex ? 'RegExp.prototype' : 'Number.prototype'];
    }
    if (init.type === 'NewExpression' && init.callee.type === 'Identifier') {
      return [this.b.TYPED_ARRAYS.has(init.callee.name) ? '%TypedArray%.prototype' : `${init.callee.name}.prototype`];
    }

    return [];
  }

  // the table row a call runs, with the sizes its steps are measured in; null when it is not a known built-in
  builtinRow (node) {
    const { callee } = node;
    const first = node.arguments[0];
    const sized = (arg) => ((!arg || numberLiteral(arg) || arg.type === 'ArrayExpression') ? ZERO : this.sizeCost(arg));
    if (node.type === 'NewExpression') {
      const alias = callee.type === 'Identifier' ? this.builtinName(callee.name) : null;
      const row = alias && !this.lookup(alias) ? table.get(`new ${alias}`) : null;
      return row ? { row, size: sized(first), callback: first } : null;
    }
    if (callee.type === 'Identifier') {
      const row = this.lookup(callee.name) ? null : table.get(callee.name);
      return row ? { row, size: first ? this.sizeCost(first) : ZERO, callback: null } : null;
    }

    const name = callee.type === 'MemberExpression' ? memberName(callee) : null;
    if (name === null || name === 'call' || name === 'apply' || this.methods.has(name)) {
      return null; // call / apply are costed as the function they borrow
    }

    const receiver = callee.object;
    const ns = receiver.type === 'Identifier' ? this.builtinName(receiver.name) : null;
    const owned = ns !== null && !this.lookup(ns) ? (table.get(`${ns}.${name}`) || (this.b.TYPED_ARRAYS.has(ns) ? table.get(`%TypedArray%.${name}`) : undefined)) : undefined;
    if (owned) {
      return { row: owned, size: first ? this.sizeCost(first) : ZERO, callback: name === 'from' ? node.arguments[1] : first };
    }

    const dom = table.dom(name);
    if (dom) {
      return { row: dom, size: this.domSize(dom, node), callback: null };
    }

    const row = table.method(name, this.ownerHints(receiver));
    return (row && !row.accessor) ? { row, size: this.sizeCost(receiver), callback: first, receiver, name } : null;
  }

  // the cost a step's time (or memory) token stands for
  tokenCost (token, ctx) {
    const [kind, withCallback] = token.split('*');
    if (kind === 'unknown') {
      return UNKNOWN;
    }
    if (kind === 'cb') {
      return ctx.callback;
    }

    let cost = ctx.size; // n, sized, subtree, markup
    if (kind === '1' || kind === 'log' || kind === 'arg') {
      cost = { 1: ZERO, log: LOG, arg: ctx.arg }[kind];
    } else if (kind === 'nlogn') {
      cost = isZero(ctx.size) ? ZERO : mul(ctx.size, LOG);
    }

    return withCallback ? mul(cost, ctx.callback) : cost;
  }

  // the steps of a built-in call: the table's, in the units of this call; null when it is not a known built-in
  builtinSteps (node) {
    const found = this.builtinRow(node);
    if (!found) {
      return null;
    }

    const { row } = found;
    const profile = row[this.b.engine];
    const steps = (profile.shared && !this.storedString(found.name, found.receiver)) ? row.spec.steps : profile.steps;
    if (!steps || steps.length < 2) {
      return [];
    }

    const first = node.arguments[0];
    const ctx = {
      size: found.size,
      arg: first ? this.boundCost(first) : ZERO,
      callback: found.callback ? this.callbackCost(found.callback) : ZERO
    };
    return steps.map((step) => ({ name: step[0], cost: this.tokenCost(step[this.field], ctx) }));
  }

  // the function a call runs when the page defined it, with the scope level it was found at
  userFunction (node) {
    const { callee } = node;
    if (node.type !== 'CallExpression') {
      return null;
    }
    if (callee.type === 'Identifier') {
      const found = this.lookup(callee.name);
      return found && found.entry.kind === 'fn' ? { fn: found.entry.node, idx: found.idx } : null;
    }

    const name = callee.type === 'MemberExpression' ? memberName(callee) : null;
    const own = name === null ? null : this.methods.get(name);
    if (own) {
      return { fn: own[0], idx: 0 };
    }

    return isFn(callee) ? { fn: callee, idx: this.scopes.length - 1 } : null;
  }

  // short name of what a call calls: `helper`, `arr.sort`, `Math.max`, `new Map`
  callName (node) {
    const { callee } = node;
    if (node.type === 'NewExpression') {
      return `new ${callee.type === 'Identifier' ? callee.name : '…'}`;
    }
    if (callee.type === 'Identifier') {
      return callee.name;
    }

    const name = callee.type === 'MemberExpression' ? memberName(callee) : null;
    if (name === null) {
      return 'call';
    }

    const owner = rootName(callee.object);
    return owner === '?' ? `.${name}` : `${owner}.${name}`;
  }

  // the steps of a function the page defined: its loops, and the calls it makes outside of loops
  bodySteps (fn) {
    const { body } = fn;
    const statements = body.type === 'BlockStatement' ? body.body : [body];
    const collect = () => {
      const out = [];
      for (const stmt of statements) {
        if (/^(For|While|DoWhile)/.test(stmt.type)) {
          out.push({ name: `${LOOP_NAMES[stmt.type]} loop`, cost: this.cost(stmt) });
          continue;
        }
        for (const { node, mult } of this.listCalls({ body: [stmt] })) {
          out.push({ name: this.callName(node), cost: mul(mult, safe(() => this.cost(node), UNKNOWN)), node });
        }
      }

      return out;
    };

    return body.type === 'BlockStatement' ? this.withScope(statements, collect) : collect();
  }

  // the steps that are calls get their own steps, down to `maxNesting` levels; it runs inside the function whose steps they are
  expandSteps (steps, depth, seen) {
    return steps.map((step, i) => {
      if (!step.node || depth + 1 >= this.limits.maxNesting || i >= this.limits.maxInternals) {
        return step;
      }

      return Object.assign({}, step, { inner: safe(() => this.internals(step.node, depth + 1, seen), null) });
    });
  }

  /**
   * The steps one call is made of, each with its own class and, when the step is a call, the steps of that call; none
   * when it is a single operation. A function is not opened inside itself.
   *
   * @returns {{steps: Array<{name: string, cls: string, steps?: Array, more?: number}>, more: number}}
   */
  internals (node, depth = 0, seen = new Set()) {
    let steps = this.builtinSteps(node);
    if (steps === null) {
      const user = this.userFunction(node);
      steps = user && !seen.has(user.fn)
        ? this.inFunction(user.fn, user.idx, false, node.arguments, () => this.expandSteps(this.bodySteps(user.fn), depth, new Set(seen).add(user.fn)))
        : [];
    }

    const shown = steps.slice(0, this.limits.maxInternals).map(({ name, cost, inner }) => {
      const step = { name, cls: classify(cost) };
      if (inner && inner.steps.length) {
        step.steps = inner.steps;
        step.more = inner.more;
      }

      return step;
    });
    return { steps: shown, more: steps.length - shown.length };
  }
}

// ---------------------------------------------------------------------------
// memory estimate: the same walk, but the cost is the peak extra memory a snippet holds on to
//  - temporaries (`slice`, `map`, `split`, `[...a]`, `new Array(n)` ...) cost the size of what they copy and are
//    freed again, so a loop around them does not multiply them
//  - collections that a loop keeps growing (`push`, `a[i] = x`, `s += 'x'`, `m.set(k, v)`) cost one slot per
//    iteration, nested growing loops multiply
//  - recursion keeps one frame per level: log n deep when the input is halved, n deep otherwise
// ---------------------------------------------------------------------------

const LOOP_NAMES = { ForStatement: 'for', ForInStatement: 'for…in', ForOfStatement: 'for…of', WhileStatement: 'while', DoWhileStatement: 'do…while' };

const IN_PLACE_STATICS = new Set(['assign', 'freeze']);
const GROWTH_METHODS = new Set(['push', 'unshift', 'add', 'set', 'appendChild', 'insertBefore', 'insertAdjacentHTML']);

const declaredNames = (root) => {
  const names = new Set();
  walk(root, (node) => {
    if (node.type === 'VariableDeclarator') {
      patternNames(node.id, []).forEach((name) => names.add(name));
    } else if (node.type === 'FunctionDeclaration' || node.type === 'ClassDeclaration') {
      names.add(node.id.name);
    }
  });
  return names;
};

const rootName = (expr) => {
  let node = expr;
  while (node.type === 'MemberExpression') {
    node = node.object;
  }

  if (node.type === 'ThisExpression') {
    return 'this';
  }

  return node.type === 'Identifier' ? node.name : '?';
};

class SpaceAnalyzer extends Analyzer {
  constructor (limits) {
    super(limits);
    this.grown = new Set(); // names of collections that grow in the current loop body / function
    this.retained = []; // { cost, names } of the growing loops completed inside the current loop body / function
    this.field = 2;
  }

  // does `x[i] = v` add slots to `name`? Only when it is built up from an empty literal: writing into an array that
  // was created at its full size (`slice()`, `new Array(n)`, a parameter) just overwrites slots
  startsEmpty (name) {
    const found = this.lookup(name);
    if (!found || found.entry.kind !== 'var') {
      return false;
    }

    const init = found.entry.init;
    const empty = (e) => e.type === 'ArrayExpression' || e.type === 'ObjectExpression' ||
      (e.type === 'NewExpression' && e.callee.name === 'Array' && e.arguments.length === 0) ||
      (e.type === 'CallExpression' && e.callee.type === 'MemberExpression' && e.callee.object.name === 'Object' && memberName(e.callee) === 'create');
    return !init || empty(init);
  }

  // the name of the collection a node makes bigger, else null
  growthTarget (node) {
    if (node.type === 'CallExpression' && node.callee.type === 'MemberExpression') {
      const name = memberName(node.callee);
      return (GROWTH_METHODS.has(name) || (name === 'splice' && node.arguments.length > 2)) ? rootName(node.callee.object) : null;
    }

    if (node.type !== 'AssignmentExpression') {
      return null;
    }

    const { left, right, operator } = node;
    if (left.type === 'MemberExpression') {
      const root = rootName(left.object);
      return (operator === '=' && left.computed && !numberLiteral(left.property) && this.startsEmpty(root)) ? root : null;
    }

    if (left.type !== 'Identifier') {
      return null;
    }

    const found = this.lookup(left.name);
    const isString = (e) => stringLiteral(e) || e.type === 'TemplateLiteral' || (e.type === 'BinaryExpression' && (isString(e.left) || isString(e.right)));
    const text = Boolean(found && found.entry.init && isString(found.entry.init));
    if (operator === '+=') {
      return (isString(right) || text) ? left.name : null;
    }
    if (operator !== '=') {
      return null;
    }

    const selfRef = (e) => e.type === 'Identifier' && e.name === left.name;
    const concat = right.type === 'CallExpression' && right.callee.type === 'MemberExpression' && selfRef(right.callee.object) && memberName(right.callee) === 'concat';
    const spread = right.type === 'ArrayExpression' && right.elements.some((e) => e && e.type === 'SpreadElement' && selfRef(e.argument));
    const append = right.type === 'BinaryExpression' && right.operator === '+' && selfRef(right.left) && (text || isString(right.right));
    return (concat || spread || append) ? left.name : null;
  }

  // listeners run one after the other: what they allocate is not added up
  dispatchCost () {
    return this.listeners.reduce((acc, l) => max(acc, this.costEntry(l)), ZERO);
  }

  // matching never allocates, however much it backtracks
  backtracks () {
    return false;
  }

  builtinMethod (name, recv, size, callback, node) {
    const { b } = this;
    const dom = this.domMethod(name, recv, node);
    if (dom !== undefined) {
      return dom;
    }
    if (b.ARG_SIZED.has(name)) {
      return max(recv, this.argSized(name, size, node)); // the result is as big as the time spent building it (ropes share)
    }
    if (b.STRING_O1_METHODS.has(name) && this.storedString(name, node.callee.object)) {
      return recv; // a slice of a stored string shares its characters
    }
    if (b.ALLOC_METHODS.has(name) || b.SORT_METHODS.has(name)) {
      return max(recv, max(size, b.SORT_METHODS.has(name) ? callback : ZERO));
    }
    if (b.ALLOC_CALLBACK_METHODS.has(name)) {
      return max(recv, max(size, callback));
    }
    if (b.CALLBACK_METHODS.has(name) || b.ONCE_CALLBACK_METHODS.has(name)) {
      return max(recv, callback);
    }

    return (b.O1_METHODS.has(name) || b.LOG_METHODS.has(name) || b.N_METHODS.has(name)) ? recv : UNKNOWN;
  }

  staticSize (name, args) {
    return IN_PLACE_STATICS.has(name) ? ZERO : super.staticSize(name, args);
  }

  fromCost (size, callback) {
    return max(size, callback);
  }

  // one frame per level of recursion on top of whatever each level holds
  recursive (fn, work) {
    if (work === UNKNOWN) {
      return UNKNOWN;
    }

    return hasScaling(fn.body) ? max(work, LOG) : mul(work, LINEAR);
  }

  costFunction (fn, idx, inline = false, args = []) {
    const grown = this.grown;
    const retained = this.retained;
    this.grown = new Set();
    this.retained = [];
    try {
      return super.costFunction(fn, idx, inline, args);
    } finally {
      // growing a collection the function did not create is visible to the caller's loop
      const own = declaredNames(fn.body);
      const params = fn.params.map((p) => (p.type === 'Identifier' ? p.name : null));
      this.grown.forEach((name) => {
        const at = params.indexOf(name);
        if (at >= 0 && args[at]) {
          grown.add(rootName(args[at])); // growing a parameter grows whatever was passed in
        } else if (!own.has(name)) {
          grown.add(name);
        }
      });
      this.grown = grown;
      this.retained = retained;
    }
  }

  costNode (node) {
    switch (node.type) {
      case 'ForStatement':
        return this.spaceLoop(node, [node.init, node.test, node.update, node.body]);
      case 'WhileStatement':
      case 'DoWhileStatement':
        return this.spaceLoop(node, [node.test, node.body]);
      case 'ForOfStatement':
      case 'ForInStatement':
        return max(this.cost(node.right), this.spaceLoop(node, [node.body]));
      case 'ArrayExpression':
      case 'ObjectExpression': {
        const items = node.type === 'ArrayExpression' ? node.elements : node.properties;
        const copies = items.filter((e) => e && e.type === 'SpreadElement').map((e) => this.sizeCost(e.argument));
        return copies.reduce(max, super.costNode(node));
      }
      default: {
        const target = this.growthTarget(node);
        if (target !== null) {
          this.grown.add(target);
        }

        return super.costNode(node);
      }
    }
  }

  spaceLoop (node, parts) {
    const outer = { grown: this.grown, retained: this.retained };
    this.grown = new Set();
    this.retained = [];
    let body;
    let grown;
    let inner;
    try {
      body = this.costAll(parts.filter(Boolean));
      grown = this.grown;
      inner = this.retained;
    } finally {
      this.grown = outer.grown;
      this.retained = outer.retained;
    }

    // collections created inside the loop are thrown away with every iteration
    const own = declaredNames(node);
    const kept = (names) => new Set([...names].filter((name) => !own.has(name)));
    const trip = this.loopTrip(node);
    const found = [];
    if (kept(grown).size > 0) {
      found.push({ cost: trip, names: kept(grown) });
    }

    for (const r of inner) {
      if (kept(r.names).size > 0) {
        found.push({ cost: mul(trip, r.cost), names: kept(r.names) });
      }
    }

    this.retained.push(...found);
    return found.reduce((acc, f) => max(acc, f.cost), body);
  }

  // variables of the test body that hold on to a lot of memory, with the loops that grow them
  listVariables (program) {
    const rated = new Map();
    const note = (name, cost) => {
      rated.set(name, rated.has(name) ? max(rated.get(name), cost) : cost);
    };

    const visit = (node, mult, depth) => {
      this.tick();
      if (depth > this.limits.maxDepth) {
        throw new BudgetError('nesting too deep');
      }
      if (isFn(node) || node.type === 'ClassDeclaration') {
        return;
      }
      if (node.type === 'VariableDeclarator' && node.id.type === 'Identifier' && node.init) {
        note(node.id.name, this.cost(node.init));
      }

      const target = this.growthTarget(node);
      if (target !== null && target !== '?' && target !== 'this') {
        note(target, mult);
      }

      let inner = mult;
      if (/^(For|While|DoWhile)/.test(node.type)) {
        inner = mul(mult, this.loopTrip(node));
      }

      for (const child of childNodes(node)) {
        visit(child, inner, depth + 1);
      }
    };

    program.body.forEach((stmt) => visit(stmt, ZERO, 0));
    return [...rated].map(([name, cost]) => ({ code: name, cls: classify(cost) })).filter((v) => v.cls !== 'o1');
  }
}

// ---------------------------------------------------------------------------
// public API
// ---------------------------------------------------------------------------

const parse = (code) => {
  try {
    return acorn.parse(code, { ecmaVersion: 'latest', allowReturnOutsideFunction: true, allowAwaitOutsideFunction: true, allowHashBang: true });
  } catch {
    return null;
  }
};

// <script> bodies of the page's HTML (external and non-JS scripts are skipped)
const scriptBodies = (html) => {
  const bodies = [];
  const re = new RegExp(regex.script, 'gi');
  let m;
  while ((m = re.exec(html || '')) !== null) {
    const type = /\stype\s*=\s*["']?([^"'\s>]*)/i.exec(m[1]);
    if (!/\ssrc\s*=/i.test(m[1]) && (!type || /javascript|ecmascript|module/i.test(type[1]))) {
      bodies.push(m[2]);
    }
  }

  return bodies;
};

const snippet = (code, node) => {
  const text = code.slice(node.start, node.end).replace(/\s+/g, ' ');
  return text.length > 80 ? text.slice(0, 77) + '...' : text;
};

// bump when the rules change: stored estimates with an older version are analyzed again on their next view
const VERSION = 9;

const result = (overall, calls, extra) => Object.assign({ estimate: true, version: VERSION, overall, calls }, extra);

const safe = (fn, fallback) => {
  try {
    return fn();
  } catch {
    // BudgetError, stack overflow ... - never let hostile code escape the analyzer
    return fallback;
  }
};

/**
 * Estimates the complexity of every test of a page.
 *
 * @param {{initHTML?: string, setup?: string, teardown?: string}} page
 * @param {Array<{code: string}>} tests
 * @param {object} [options] limits overrides (maxCodeLength, maxSteps, maxMs, maxDepth, maxCalls, maxPageMs); `engine`
 *   ('spec' or 'v8') analyzes with a single rule set, otherwise the standard's result is returned with the V8 one
 *   under `engines.v8`
 * @returns {Array<{estimate: true, overall: string, calls: Array<{code: string, cls: string}>}>} one result per test
 */
const analyzePage = (page, tests, options) => {
  const limits = Object.assign({}, DEFAULT_LIMITS, options);
  const pageCode = [...scriptBodies(page.initHTML), page.setup || '', page.teardown || '']
    .filter((code) => code.length <= limits.maxCodeLength)
    .map(parse)
    .filter(Boolean);

  // each test has its own budget, this one keeps a page with many tests from holding up the event loop
  const deadline = Date.now() + limits.maxPageMs;
  return tests.map((test) => {
    if (Date.now() > deadline) {
      return result('unknown', []);
    }

    const code = String(test.code || '');
    if (limits.engine) {
      return analyzeOne(code, pageCode, limits);
    }

    // both rule sets are stored, the one that matches the viewer's browser is shown
    const base = analyzeOne(code, pageCode, Object.assign({}, limits, { engine: 'spec' }));
    const v8 = analyzeOne(code, pageCode, Object.assign({}, limits, { engine: 'v8' }));
    delete v8.estimate;
    delete v8.version;
    return Object.assign(base, { engines: { v8 } });
  });
};

const prepare = (Cls, program, pageCode, limits) => {
  const analyzer = new Cls(limits);

  // page level definitions first, the test's own code is evaluated on top of them
  for (const p of pageCode) {
    analyzer.collectDefs(p.body, analyzer.scopes[0]);
    assignedNames(p, analyzer.assigned);
    grownNames(p, analyzer.assigned, false);
  }

  assignedNames(program, analyzer.assigned);
  grownNames(program, analyzer.assigned, true);
  analyzer.collectDefs(program.body, analyzer.scopes[0]);
  [...pageCode, program].forEach((tree) => safe(() => analyzer.collectFunctions(tree), null));
  return analyzer;
};

// what each listed call is made of, once the answer is known (a call that is a single operation gets nothing)
const withInternals = (analyzer, calls, listed, limits) => {
  analyzer.resetBudget();
  listed.forEach((item, i) => {
    const { steps, more } = safe(() => analyzer.internals(calls[i].node), { steps: [], more: 0 });
    if (steps.length) {
      item.steps = steps;
      if (more) {
        item.moreSteps = more;
      }
    }
  });
};

const analyzeSpace = (program, code, calls, pageCode, limits) => {
  const analyzer = prepare(SpaceAnalyzer, program, pageCode, limits);
  const items = calls.slice(0, limits.maxCalls).map(({ node, mult }) => {
    const cost = safe(() => analyzer.cost(node), UNKNOWN);
    // a call that grows a collection keeps one more element per iteration of the loops around it
    return { code: snippet(code, node), cls: classify(cost === UNKNOWN ? UNKNOWN : (safe(() => analyzer.growthTarget(node), null) === null ? cost : max(cost, mult))) };
  });

  withInternals(analyzer, calls, items, limits);

  const variables = safe(() => analyzer.listVariables(program), []).slice(0, limits.maxCalls);
  return { overall: classify(safe(() => analyzer.cost(program), UNKNOWN)), items, variables };
};

const analyzeOne = (code, pageCode, limits) => {
  const program = code.length > limits.maxCodeLength ? null : parse(code);
  if (!program) {
    return result('unknown', [], { space: { overall: 'unknown', items: [], variables: [] } });
  }

  const analyzer = prepare(Analyzer, program, pageCode, limits);
  const calls = safe(() => analyzer.listCalls(program), []);
  const listed = calls.slice(0, limits.maxCalls).map(({ node, mult }) => ({
    code: snippet(code, node),
    cls: classify(safe(() => mul(mult, analyzer.cost(node)), UNKNOWN))
  }));

  const overall = classify(safe(() => analyzer.cost(program), UNKNOWN));
  withInternals(analyzer, calls, listed, limits);
  const space = analyzeSpace(program, code, calls, pageCode, limits);
  return result(overall, listed, Object.assign({ space }, calls.length > listed.length ? { more: calls.length - listed.length } : {}));
};

const analyzeTest = (page, code, options) => analyzePage(page, [{ code }], options)[0];

/**
 * Normalises a stored value (JSON column, JSON string or garbage) for the template.
 *
 * @returns {object|null} null when there is nothing to show
 */
const present = (value, engine) => {
  const stored = safe(() => (typeof value === 'string' ? JSON.parse(value) : value), null);
  const data = (engine === 'v8' && stored && stored.engines && stored.engines.v8) ? Object.assign({}, stored, stored.engines.v8) : stored;
  if (!data || !Array.isArray(data.calls)) {
    return null;
  }

  const info = (cls) => {
    const key = Object.hasOwn(CLASSES, cls) ? cls : 'unknown';
    return Object.assign({ cls: key }, CLASSES[key]);
  };
  const space = data.space && Array.isArray(data.space.items) ? data.space : null;
  // a step that is a call has the steps of that call, as deep as the analysis goes
  const stepList = (steps, depth) => steps.slice(0, DEFAULT_LIMITS.maxInternals).map((s) => Object.assign(
    { step: String(s.name).slice(0, 40) },
    info(s.cls),
    depth + 1 < DEFAULT_LIMITS.maxNesting && Array.isArray(s.steps) && s.steps.length ? { steps: stepList(s.steps, depth + 1), moreSteps: Number(s.more) || 0 } : {}
  ));
  const stepsOf = (item) => (Array.isArray(item.steps) ? { steps: stepList(item.steps, 0), moreSteps: Number(item.moreSteps) || 0 } : {});
  const rate = (item) => Object.assign({ code: String(item.code) }, info(item.cls), stepsOf(item));
  // the last row of a group carries the heavy border; `rows` is how many rows the group's total cell spans
  const rows = (items, extra = 0) => items.map((item, i) => Object.assign(rate(item), { end: i === items.length - 1 && !extra }));
  return {
    space: space && {
      overall: info(space.overall),
      items: rows(space.items.concat(Array.isArray(space.variables) ? space.variables : [])),
      rows: Math.max(1, space.items.length + (Array.isArray(space.variables) ? space.variables.length : 0))
    },
    overall: info(data.overall),
    calls: rows(data.calls, data.more || 0),
    rows: Math.max(1, data.calls.length + (data.more ? 1 : 0)),
    more: data.more || 0,
    unknown: info(data.overall).cls === 'unknown'
  };
};

module.exports = { VERSION, analyzePage, analyzeTest, present, classify, CLASSES, DEFAULT_LIMITS };
