'use strict';

// Complexity of JavaScript built-ins, per engine profile, derived from the lookup in builtinTable.js (which also holds
// where each class comes from).
//
//  - `spec`: what the ECMAScript algorithms imply (their loops over `length`, copies of their receiver, ...). The
//    standard states no complexities itself, except that Map / Set / WeakMap must be sublinear on average.
//    Used for every browser that is not Chromium based.
//  - `v8`: what Chrome's engine really does where that differs: ropes for string concatenation (repeat / pad are
//    built by doubling, so they are logarithmic until the result is read), sliced strings for substring / slice,
//    constant time shift thanks to trimming the front of the backing store, hash tables with constant time
//    Map / Set operations and trimming that only scans the whitespace at the ends.
//
// Costs are classes of the receiver's size (see complexity.js); this file turns the table into the sets it looks at.

const table = require('./builtinTable');

const TYPED_ARRAYS = table.TA;

// callable without `new`, and constant time
const CALLABLE_CONSTRUCTORS = ['String', 'Number', 'Boolean', 'Symbol', 'BigInt'];

// objects that are only a bag of functions: every call on them is constant time unless the table lists it as dearer
// (`Math.sumPrecise` walks an iterable)
const NAMESPACES = ['Math', 'Number', 'Date', 'console', 'performance', 'Symbol', 'BigInt', 'Intl'];

const set = (items) => new Set(items);

const RANK = { 1: 0, log: 1, arg: 2, n: 3, subtree: 3, markup: 3, tree: 3, sized: 3, nlogn: 4, unknown: 9 };
const base = (time) => time.replace(/\*cb$/, '');
const rank = (time) => RANK[base(time)];

// instance methods are looked up by name alone, so one name has to stand for every owner that defines it: a row marked
// `primary` wins (`set` is the Map method, not TypedArray's), otherwise the most expensive owner does
const methodRows = (engine) => {
  const byName = new Map();
  for (const row of table.rows) {
    if (row.kind === 'method' && !row.accessor) {
      byName.set(row.name, (byName.get(row.name) || []).concat(row));
    }
  }

  const chosen = new Map();
  for (const [name, rows] of byName) {
    const primary = rows.find((r) => r.primary);
    chosen.set(name, primary || rows.reduce((best, r) => (rank(r[engine].time) > rank(best[engine].time) ? r : best)));
  }

  return chosen;
};

const build = (engine) => {
  const sets = {
    O1_METHODS: new Set(),
    LOG_METHODS: new Set(),
    N_METHODS: new Set(),
    CALLBACK_METHODS: new Set(),
    ONCE_CALLBACK_METHODS: new Set(),
    SORT_METHODS: new Set(),
    ARG_SIZED: new Set(),
    ALLOC_METHODS: new Set(),
    ALLOC_CALLBACK_METHODS: new Set(),
    STRING_O1_METHODS: new Set()
  };

  let ropes = false;
  for (const [name, row] of methodRows(engine)) {
    const { time, space } = row[engine];
    const spec = row.spec.time;
    if (spec === 'arg') {
      sets.ARG_SIZED.add(name);
      ropes = ropes || time === 'log';
      continue;
    }
    if (time === 'unknown') {
      continue;
    }

    const kind = base(time);
    const callback = time.endsWith('*cb');
    if (kind === '1') {
      sets.O1_METHODS.add(name);
    } else if (kind === 'log') {
      sets.LOG_METHODS.add(name);
    } else if (kind === 'nlogn') {
      sets.SORT_METHODS.add(name);
    } else if (kind === 'n' && callback) {
      sets.CALLBACK_METHODS.add(name);
    } else if (kind === 'n') {
      sets.N_METHODS.add(name);
    }
    if (time === 'cb') {
      sets.ONCE_CALLBACK_METHODS.add(name);
    }
    if (space === 'n' && kind !== 'nlogn') {
      (callback ? sets.ALLOC_CALLBACK_METHODS : sets.ALLOC_METHODS).add(name);
    }
  }

  // a result that shares its parent's characters when the receiver is a stored string: the call is linear otherwise
  for (const row of table.rows) {
    if (row.kind === 'method' && !row.accessor && row[engine].shared) {
      sets.STRING_O1_METHODS.add(row.name);
      sets.N_METHODS.add(row.name);
      sets.ALLOC_METHODS.add(row.name);
      sets.O1_METHODS.delete(row.name);
    }
  }

  return Object.assign(sets, { ropes });
};

// functions called on a namespace (`Math.max`, `Object.keys`, `JSON.parse`)
const statics = (engine) => {
  const o1Namespaces = new Set();
  const n = new Map();
  const o1 = new Map();
  const owners = new Map();
  for (const row of table.rows) {
    if (row.kind === 'static' && !row.name.startsWith('@@')) {
      owners.set(row.owner, (owners.get(row.owner) || []).concat(row));
    }
  }

  const add = (map, owner, name) => map.set(owner, (map.get(owner) || new Set()).add(name));
  const targets = (owner) => (owner === '%TypedArray%' ? TYPED_ARRAYS : [owner]);
  for (const [owner, rows] of owners) {
    const namespace = NAMESPACES.includes(owner) || rows.every((r) => r[engine].time === '1');
    for (const row of rows) {
      const { time } = row[engine];
      if (time === 'unknown' || row.name === 'from') { // `from` is costed by its callback, see staticCall
        continue;
      }
      for (const target of targets(owner)) {
        if (time !== '1') {
          add(n, target, row.name);
        } else if (!namespace) {
          add(o1, target, row.name);
        }
      }
    }
    if (namespace) {
      targets(owner).forEach((t) => o1Namespaces.add(t));
    }
  }

  return { o1Namespaces, n, o1 };
};

const common = (engine) => {
  const s = statics(engine);
  const ctors = table.rows.filter((r) => r.kind === 'ctor');
  const globals = table.rows.filter((r) => r.kind === 'global' && r[engine].time === '1').map((r) => r.name);
  return {
    TYPED_ARRAYS: set(TYPED_ARRAYS),
    O1_NAMESPACES: s.o1Namespaces,
    O1_GLOBAL_FUNCTIONS: set(globals.concat(CALLABLE_CONSTRUCTORS)),
    N_GLOBAL_FUNCTIONS: set(table.rows.filter((r) => r.kind === 'global' && base(r[engine].time) === 'n').map((r) => r.name)),
    N_STATICS: s.n,
    O1_STATICS: s.o1,
    SIZED_CONSTRUCTORS: set(ctors.filter((r) => r[engine].time === 'sized').map((r) => r.name)),
    O1_CONSTRUCTORS: set(ctors.filter((r) => r[engine].time === '1').map((r) => r.name)),
    DOM: new Map(table.rows.filter((r) => r.kind === 'dom').map((r) => [r.name, r[engine].time]))
  };
};

const make = (engine) => Object.assign({ engine }, common(engine), build(engine));

const spec = make('spec');
const v8 = make('v8');

exports.spec = spec;
exports.v8 = v8;
exports.profile = (engine) => (engine === 'v8' ? v8 : spec);
exports.table = table;
