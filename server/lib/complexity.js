'use strict';

// Static Big-O *estimates* for jsPerf test cases.
//
// The code is only ever parsed (acorn), never executed. Costs are modelled as
// n^a * (log n)^b pairs and rounded UP to the next class we can display:
// O(1), O(log n), O(n), O(n log n), O(n^2), O(n^3), "higher" or "unknown".
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
//    never-reassigned array/string literal, or capped by a constant through
//    `Math.min(x, 24)`. Looping over / mapping an array literal is constant too.
//  - Built-ins: sort => n log n, indexOf/includes/slice/join/... => n,
//    forEach/map/filter/reduce/... => n * callback, push/pop/get/Math.* => 1.
//  - Recursion (conservative): one self call that halves its input costs
//    work * log n (work if work is already linear), two halving calls cost
//    n (constant work) or n log n (linear work), a non-halving single self
//    call costs work * n and several non-halving self calls are "higher"
//    (exponential). Mutual recursion is "unknown".
//  - Calls compose: cost(call) = cost(callee body) + cost(arguments).
//  - Anything undecidable (calling a parameter, unknown library function,
//    eval, syntax errors, too much code/time) is "unknown".

const acorn = require('acorn');
const regex = require('./regex');

const DEFAULT_LIMITS = { maxCodeLength: 100000, maxSteps: 40000, maxMs: 250, maxDepth: 120, maxCalls: 12 };

class BudgetError extends Error {}

// ---------------------------------------------------------------------------
// cost algebra: { n, l } = n^n * log(n)^l, or null for "unknown"
// ---------------------------------------------------------------------------

const ZERO = { n: 0, l: 0 };
const LOG = { n: 0, l: 1 };
const LINEAR = { n: 1, l: 0 };
const NLOGN = { n: 1, l: 1 };
const HIGHER = { n: 9, l: 0 };
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
    return l === 0 ? 'o1' : (l === 1 ? 'ologn' : 'on');
  }
  if (n === 1) {
    return l === 0 ? 'on' : (l === 1 ? 'onlogn' : 'on2');
  }
  if (n === 2) {
    return l === 0 ? 'on2' : 'on3';
  }
  return (n === 3 && l === 0) ? 'on3' : 'higher';
};

const CLASSES = {
  o1: { label: 'O(1)', name: 'constant', curve: 'curve-o1' },
  ologn: { label: 'O(log n)', name: 'logarithmic', curve: 'curve-ologn' },
  on: { label: 'O(n)', name: 'linear', curve: 'curve-on' },
  onlogn: { label: 'O(n log n)', name: 'linearithmic', curve: 'curve-onlogn' },
  on2: { label: 'O(n²)', name: 'quadratic', curve: 'curve-on2' },
  on3: { label: 'O(n³)', name: 'cubic', curve: 'curve-on3' },
  higher: { label: 'O(n⁴+)', name: 'worse than cubic', curve: 'curve-higher' },
  unknown: { label: 'unknown', name: 'could not be determined', curve: 'curve-unknown' }
};

// ---------------------------------------------------------------------------
// built-in knowledge
// ---------------------------------------------------------------------------

// instance methods that take constant time
const O1_METHODS = new Set(['push', 'pop', 'charAt', 'charCodeAt', 'codePointAt', 'at', 'get', 'set', 'has', 'add', 'delete',
  'getTime', 'toFixed', 'valueOf', 'hasOwnProperty', 'log', 'warn', 'error', 'info', 'debug', 'toString', 'bind', 'now', 'next']);
// instance methods that touch every element of their receiver
const N_METHODS = new Set(['indexOf', 'lastIndexOf', 'includes', 'slice', 'substring', 'substr', 'concat', 'join', 'split',
  'reverse', 'fill', 'splice', 'shift', 'unshift', 'copyWithin', 'flat', 'trim', 'replace', 'replaceAll', 'match', 'matchAll',
  'search', 'test', 'exec', 'startsWith', 'endsWith', 'padStart', 'padEnd', 'repeat', 'toUpperCase', 'toLowerCase',
  'localeCompare', 'normalize', 'keys', 'values', 'entries', 'toReversed', 'with', 'clear']);
// methods that run a callback once per element
const CALLBACK_METHODS = new Set(['forEach', 'map', 'filter', 'reduce', 'reduceRight', 'some', 'every', 'find', 'findIndex',
  'findLast', 'findLastIndex', 'flatMap']);
const SORT_METHODS = new Set(['sort', 'toSorted']);

// namespaces whose methods are all constant time
const O1_NAMESPACES = new Set(['Math', 'Number', 'Date', 'console', 'performance', 'Symbol', 'Reflect', 'Boolean', 'BigInt']);
const O1_GLOBAL_FUNCTIONS = new Set(['parseInt', 'parseFloat', 'isNaN', 'isFinite', 'String', 'Number', 'Boolean', 'Symbol', 'BigInt']);
const N_GLOBAL_FUNCTIONS = new Set(['encodeURIComponent', 'decodeURIComponent', 'encodeURI', 'decodeURI', 'escape', 'unescape', 'structuredClone']);
// static helpers by namespace: null = every method of it
const N_STATICS = new Map([['JSON', null], ['Object', new Set(['keys', 'values', 'entries', 'assign', 'fromEntries', 'freeze', 'getOwnPropertyNames'])]]);
const O1_STATICS = new Map([['Object', new Set(['create', 'getPrototypeOf', 'defineProperty', 'is'])], ['Array', new Set(['isArray', 'of'])], ['String', new Set(['fromCharCode', 'fromCodePoint', 'raw'])]]);
// constructors: arg => size dependent allocation
const SIZED_CONSTRUCTORS = new Set(['Array', 'Set', 'Map', 'WeakSet', 'WeakMap', 'ArrayBuffer', 'Int8Array', 'Uint8Array', 'Uint8ClampedArray',
  'Int16Array', 'Uint16Array', 'Int32Array', 'Uint32Array', 'Float32Array', 'Float64Array', 'BigInt64Array', 'BigUint64Array']);
const O1_CONSTRUCTORS = new Set(['Date', 'Object', 'Error', 'TypeError', 'RangeError', 'RegExp', 'String', 'Number', 'Boolean']);

// ---------------------------------------------------------------------------
// AST helpers
// ---------------------------------------------------------------------------

const isNode = (v) => v !== null && typeof v === 'object' && typeof v.type === 'string';
const isFn = (n) => n.type === 'FunctionExpression' || n.type === 'ArrowFunctionExpression' || n.type === 'FunctionDeclaration';

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

// ---------------------------------------------------------------------------
// the analyzer
// ---------------------------------------------------------------------------

class Analyzer {
  constructor (limits) {
    this.limits = limits;
    this.steps = 0;
    this.depth = 0;
    this.deadline = Date.now() + limits.maxMs;
    this.scopes = [new Map()];
    this.methods = new Map();
    this.assigned = new Set();
    this.frames = [];
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
  collectDefs (statements, map) {
    for (const s of statements) {
      if (s.type === 'FunctionDeclaration') {
        map.set(s.id.name, { kind: 'fn', node: s });
      } else if (s.type === 'ClassDeclaration') {
        this.addClass(map, s.id.name, s);
      } else if (s.type === 'VariableDeclaration') {
        for (const d of s.declarations) {
          this.collectDeclarator(d, map);
        }
      } else if (s.type === 'ExpressionStatement') {
        this.collectExpression(s.expression, map);
      }
    }
  }

  collectDeclarator (d, map) {
    if (d.id.type !== 'Identifier') {
      for (const name of patternNames(d.id, [])) {
        map.set(name, { kind: 'var', init: null });
      }
      return;
    }

    const init = d.init;
    if (init && isFn(init)) {
      map.set(d.id.name, { kind: 'fn', node: init });
    } else if (init && init.type === 'ClassExpression') {
      this.addClass(map, d.id.name, init);
    } else {
      map.set(d.id.name, { kind: 'var', init });
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

  constEntry (name) {
    const found = this.lookup(name);
    return (found && found.entry.kind === 'var' && found.entry.init && !this.assigned.has(name)) ? found.entry.init : null;
  }

  // cost of walking the elements of `expr` (arrays/strings written as literals are constant sized)
  sizeCost (expr) {
    let target = expr;
    if (target.type === 'Identifier') {
      target = this.constEntry(target.name) || target;
    }

    return (target.type === 'ArrayExpression' || target.type === 'TemplateLiteral' || stringLiteral(target)) ? ZERO : LINEAR;
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
    this.collectDefs(statements, map);
    this.scopes.push(map);
    try {
      return fn();
    } finally {
      this.scopes.pop();
    }
  }

  // cost of a function body, evaluated in the scope it was defined in
  costFunction (fn, idx, inline = false) {
    const at = this.frames.findLastIndex((f) => f.fn === fn);
    if (at >= 0) {
      // a call back into a running function is plain recursion unless a named function sits in between
      if (this.frames.slice(at + 1).every((f) => f.inline)) {
        this.frames[at].sites++;
        return ZERO;
      }

      return UNKNOWN; // mutual recursion
    }

    const frame = { fn, inline, sites: 0 };
    this.frames.push(frame);
    const saved = this.scopes;
    this.scopes = saved.slice(0, idx + 1);
    const params = new Map();
    for (const p of fn.params) {
      for (const name of patternNames(p, [])) {
        params.set(name, { kind: 'param' });
      }
    }

    this.scopes.push(params);
    try {
      const work = this.cost(fn.body);
      return frame.sites === 0 ? work : this.recursive(fn, work, frame.sites);
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

    return sites === 1 ? mul(work, LINEAR) : HIGHER;
  }

  // cost of invoking a function-valued expression (identifier or inline function)
  calleeCost (expr) {
    if (isFn(expr)) {
      return this.costFunction(expr, this.scopes.length - 1, true);
    }

    return expr.type === 'Identifier' ? this.identifierCall(expr.name) : UNKNOWN;
  }

  argsCost (args) {
    return this.costAll(args.filter((a) => !isFn(a)));
  }

  costCall (node) {
    const { callee } = node;
    const args = this.argsCost(node.arguments);
    if (callee.type === 'Identifier') {
      return max(args, this.identifierCall(callee.name));
    }
    if (callee.type === 'MemberExpression') {
      return max(args, this.methodCall(node, callee));
    }
    if (isFn(callee) || callee.type === 'Super') {
      return max(args, callee.type === 'Super' ? ZERO : this.calleeCost(callee));
    }

    return UNKNOWN;
  }

  identifierCall (name) {
    const found = this.lookup(name);
    if (found) {
      return found.entry.kind === 'fn' ? this.costFunction(found.entry.node, found.idx) : UNKNOWN;
    }

    if (O1_GLOBAL_FUNCTIONS.has(name)) {
      return ZERO;
    }

    return N_GLOBAL_FUNCTIONS.has(name) ? LINEAR : UNKNOWN;
  }

  methodCall (node, callee) {
    const name = memberName(callee);
    const receiver = callee.object;
    if (name === null) {
      return UNKNOWN;
    }

    if (receiver.type === 'Identifier' && !this.lookup(receiver.name)) {
      const known = this.staticCall(node, receiver.name, name);
      if (known !== undefined) {
        return known;
      }
    }

    if (name === 'call' || name === 'apply') {
      return this.calleeCost(receiver);
    }

    const recv = this.cost(receiver);
    if (this.methods.has(name)) {
      // the page defines a method of that name: assume that is the one being called
      return this.methods.get(name).reduce((acc, fn) => max(acc, this.costFunction(fn, 0)), recv);
    }

    const size = this.sizeCost(receiver);
    const callback = this.callbackCost(node.arguments[0]);
    if (O1_METHODS.has(name)) {
      return recv;
    }
    if (N_METHODS.has(name)) {
      return max(recv, size);
    }
    if (CALLBACK_METHODS.has(name)) {
      return max(recv, mul(size, callback));
    }

    return SORT_METHODS.has(name) ? max(recv, mul(isZero(size) ? ZERO : NLOGN, callback)) : UNKNOWN;
  }

  // cost of one invocation of a callback argument; no callback => constant (default comparator, ...)
  callbackCost (arg) {
    return arg ? this.calleeCost(arg) : ZERO;
  }

  // Math.x(), Object.keys(x), JSON.parse(x), Array.from(x, fn) ...; undefined when `ns.name` is not a known built-in
  staticCall (node, ns, name) {
    const first = node.arguments[0];
    if (O1_NAMESPACES.has(ns)) {
      return ZERO;
    }
    if (N_STATICS.has(ns) && (N_STATICS.get(ns) === null || N_STATICS.get(ns).has(name))) {
      return first ? this.sizeCost(first) : ZERO;
    }
    if (O1_STATICS.has(ns) && O1_STATICS.get(ns).has(name)) {
      return ZERO;
    }
    if (ns === 'Array' && name === 'from') {
      return first ? mul(this.sizeCost(first), this.callbackCost(node.arguments[1])) : ZERO;
    }

    return undefined;
  }

  costNew (node) {
    const args = this.argsCost(node.arguments);
    const { callee } = node;
    if (callee.type !== 'Identifier') {
      return UNKNOWN;
    }

    const found = this.lookup(callee.name);
    if (found) {
      const { entry } = found;
      if (entry.kind === 'class') {
        return max(args, entry.ctor ? this.costFunction(entry.ctor, found.idx) : ZERO);
      }
      return max(args, entry.kind === 'fn' ? this.costFunction(entry.node, found.idx) : UNKNOWN);
    }

    const first = node.arguments[0];
    if (SIZED_CONSTRUCTORS.has(callee.name)) {
      const size = !first ? ZERO : ((numberLiteral(first) || first.type === 'ArrayExpression') ? ZERO : this.sizeCost(first));
      return max(args, size);
    }

    return O1_CONSTRUCTORS.has(callee.name) ? args : UNKNOWN;
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

const result = (overall, calls, extra) => Object.assign({ estimate: true, overall, calls }, extra);

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
 * @param {object} [options] limits overrides (maxCodeLength, maxSteps, maxMs, maxDepth, maxCalls)
 * @returns {Array<{estimate: true, overall: string, calls: Array<{code: string, cls: string}>}>} one result per test
 */
const analyzePage = (page, tests, options) => {
  const limits = Object.assign({}, DEFAULT_LIMITS, options);
  const pageCode = [...scriptBodies(page.initHTML), page.setup || '', page.teardown || '']
    .filter((code) => code.length <= limits.maxCodeLength)
    .map(parse)
    .filter(Boolean);

  return tests.map((test) => analyzeOne(String(test.code || ''), pageCode, limits));
};

const analyzeOne = (code, pageCode, limits) => {
  const program = code.length > limits.maxCodeLength ? null : parse(code);
  if (!program) {
    return result('unknown', []);
  }

  const analyzer = new Analyzer(limits);

  // page level definitions first, the test's own code is evaluated on top of them
  for (const p of pageCode) {
    analyzer.collectDefs(p.body, analyzer.scopes[0]);
    assignedNames(p, analyzer.assigned);
  }

  assignedNames(program, analyzer.assigned);
  analyzer.collectDefs(program.body, analyzer.scopes[0]);

  const calls = safe(() => analyzer.listCalls(program), []);
  const listed = calls.slice(0, limits.maxCalls).map(({ node, mult }) => ({
    code: snippet(code, node),
    cls: classify(safe(() => mul(mult, analyzer.cost(node)), UNKNOWN))
  }));

  const overall = classify(safe(() => analyzer.cost(program), UNKNOWN));
  return result(overall, listed, calls.length > listed.length ? { more: calls.length - listed.length } : {});
};

const analyzeTest = (page, code, options) => analyzePage(page, [{ code }], options)[0];

/**
 * Normalises a stored value (JSON column, JSON string or garbage) for the template.
 *
 * @returns {object|null} null when there is nothing to show
 */
const present = (value) => {
  const data = safe(() => (typeof value === 'string' ? JSON.parse(value) : value), null);
  if (!data || !Array.isArray(data.calls)) {
    return null;
  }

  const info = (cls) => {
    const key = Object.hasOwn(CLASSES, cls) ? cls : 'unknown';
    return Object.assign({ cls: key }, CLASSES[key]);
  };
  return {
    overall: info(data.overall),
    calls: data.calls.map((c) => Object.assign({ code: String(c.code) }, info(c.cls))),
    more: data.more || 0,
    unknown: info(data.overall).cls === 'unknown'
  };
};

module.exports = { analyzePage, analyzeTest, present, classify, CLASSES, DEFAULT_LIMITS };
