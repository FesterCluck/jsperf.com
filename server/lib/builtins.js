'use strict';

// Complexity of JavaScript built-ins, per engine profile.
//
//  - `spec`: what the ECMAScript algorithms imply (their loops over `length`, copies of their receiver, ...). The
//    standard states no complexities itself, except that Map / Set / WeakMap must be sublinear on average.
//    Used for every browser that is not Chromium based.
//  - `v8`: what Chrome's engine really does where that differs: ropes for string concatenation (repeat / pad are
//    built by doubling, so they are logarithmic until the result is read), sliced strings for substring / slice,
//    constant time shift thanks to trimming the front of the backing store, hash tables with constant time
//    Map / Set operations and trimming that only scans the whitespace at the ends.
//
// Costs are classes of the receiver's size (see complexity.js); this file only holds the tables.

const set = (...lists) => new Set(lists.flat());

// instance methods that take constant time (formatting and accessors are bounded by the format, not by a collection)
const O1 = ['push', 'pop', 'charAt', 'charCodeAt', 'codePointAt', 'at', 'getTime', 'toFixed', 'valueOf', 'hasOwnProperty',
  'log', 'warn', 'error', 'info', 'debug', 'toString', 'bind', 'now', 'next',
  'toLocaleString', 'toLocaleDateString', 'toLocaleTimeString', 'toISOString', 'toJSON', 'toUTCString', 'toGMTString', 'toDateString',
  'toTimeString', 'toPrecision', 'toExponential', 'format', 'formatToParts', 'formatRange', 'resolvedOptions', 'supportedLocalesOf',
  'getFullYear', 'getMonth', 'getDate', 'getDay', 'getHours', 'getMinutes', 'getSeconds', 'getMilliseconds', 'getTimezoneOffset',
  'getUTCFullYear', 'getUTCMonth', 'getUTCDate', 'getUTCDay', 'getUTCHours', 'getUTCMinutes', 'getUTCSeconds', 'getUTCMilliseconds',
  'setFullYear', 'setMonth', 'setDate', 'setHours', 'setMinutes', 'setSeconds', 'setMilliseconds', 'setTime',
  'setUTCFullYear', 'setUTCMonth', 'setUTCDate', 'setUTCHours', 'setUTCMinutes', 'setUTCSeconds', 'setUTCMilliseconds',
  'subarray', 'isWellFormed', 'deref', 'isPrototypeOf', 'propertyIsEnumerable', 'resolve', 'reject',
  // iterators are created lazily: walking them is costed by the loop that consumes them
  'keys', 'values', 'entries', 'take', 'drop'];

// keyed collection operations: the standard only promises "sublinear on average", engines use hash tables
const COLLECTION_OPS = ['get', 'set', 'has', 'add', 'delete'];

// instance methods that touch every element of their receiver
const N = ['indexOf', 'lastIndexOf', 'includes', 'slice', 'substring', 'substr', 'concat', 'join', 'split', 'reverse', 'fill',
  'splice', 'shift', 'unshift', 'copyWithin', 'flat', 'trim', 'replace', 'replaceAll', 'match', 'matchAll', 'search', 'test',
  'exec', 'startsWith', 'endsWith', 'toUpperCase', 'toLowerCase', 'localeCompare', 'normalize', 'toReversed', 'with', 'clear',
  'trimStart', 'trimEnd', 'toSpliced', 'toWellFormed', 'toArray',
  'union', 'intersection', 'difference', 'symmetricDifference', 'isSubsetOf', 'isSupersetOf', 'isDisjointFrom'];

// methods whose cost is set by their count / length argument instead (see Analyzer.argSized)
const ARG_SIZED = ['repeat', 'padStart', 'padEnd'];

// methods that copy their receiver into a new array / string (memory)
const ALLOC = ['slice', 'substring', 'substr', 'concat', 'join', 'split', 'flat', 'trim', 'replace', 'replaceAll', 'match',
  'matchAll', 'toUpperCase', 'toLowerCase', 'normalize', 'toReversed', 'with', 'splice', 'copyWithin', 'trimStart', 'trimEnd',
  'toSpliced', 'toWellFormed', 'toArray', 'union', 'intersection', 'difference', 'symmetricDifference'];

const TYPED_ARRAYS = ['Int8Array', 'Uint8Array', 'Uint8ClampedArray', 'Int16Array', 'Uint16Array', 'Int32Array', 'Uint32Array',
  'Float32Array', 'Float64Array', 'BigInt64Array', 'BigUint64Array'];

const common = {
  TYPED_ARRAYS: set(TYPED_ARRAYS),
  ONCE_CALLBACK_METHODS: set(['then', 'catch', 'finally']), // promise methods: the callback runs once
  // methods that run a callback once per element
  CALLBACK_METHODS: set(['forEach', 'map', 'filter', 'reduce', 'reduceRight', 'some', 'every', 'find', 'findIndex', 'findLast',
    'findLastIndex', 'flatMap']),
  ALLOC_CALLBACK_METHODS: set(['map', 'filter', 'flatMap']),
  SORT_METHODS: set(['sort', 'toSorted']), // comparison sorts: n log n time, a scratch copy of the elements
  ARG_SIZED: set(ARG_SIZED),
  // namespaces whose methods are all constant time
  O1_NAMESPACES: set(['Math', 'Number', 'Date', 'console', 'performance', 'Symbol', 'Reflect', 'Boolean', 'BigInt', 'Intl', 'Atomics']),
  O1_GLOBAL_FUNCTIONS: set(['parseInt', 'parseFloat', 'isNaN', 'isFinite', 'String', 'Number', 'Boolean', 'Symbol', 'BigInt',
    'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'queueMicrotask', 'requestAnimationFrame', 'cancelAnimationFrame']),
  N_GLOBAL_FUNCTIONS: set(['encodeURIComponent', 'decodeURIComponent', 'encodeURI', 'decodeURI', 'escape', 'unescape', 'structuredClone']),
  // static helpers by namespace: null = every method of it
  N_STATICS: new Map([
    ['JSON', null],
    ['Object', set(['keys', 'values', 'entries', 'assign', 'fromEntries', 'freeze', 'getOwnPropertyNames', 'groupBy'])],
    ['Promise', set(['all', 'allSettled', 'race', 'any'])],
    ['Map', set(['groupBy'])]
  ]),
  O1_STATICS: new Map([
    ['Object', set(['create', 'getPrototypeOf', 'setPrototypeOf', 'defineProperty', 'is', 'hasOwn', 'getOwnPropertyDescriptor', 'seal',
      'isFrozen', 'isSealed', 'preventExtensions', 'isExtensible'])],
    ['Promise', set(['resolve', 'reject', 'withResolvers'])],
    ['Array', set(['isArray', 'of'])],
    ...TYPED_ARRAYS.map((name) => [name, set(['of'])]),
    ['String', set(['fromCharCode', 'fromCodePoint', 'raw'])]
  ]),
  // constructors: arg => size dependent allocation
  SIZED_CONSTRUCTORS: set(['Array', 'Set', 'Map', 'WeakSet', 'WeakMap', 'ArrayBuffer', 'Int8Array', 'Uint8Array', 'Uint8ClampedArray',
    'Int16Array', 'Uint16Array', 'Int32Array', 'Uint32Array', 'Float32Array', 'Float64Array', 'BigInt64Array', 'BigUint64Array']),
  O1_CONSTRUCTORS: set(['Date', 'Object', 'Error', 'TypeError', 'RangeError', 'RegExp', 'String', 'Number', 'Boolean', 'Event', 'CustomEvent', 'EventTarget']),
  ALLOC_METHODS: set(ALLOC),
  // DOM (not part of ECMAScript): read from Chrome's implementation, and used for every browser since the table has no other source
  DOM_O1_METHODS: set(['createElement', 'createTextNode', 'createComment', 'createDocumentFragment', 'getElementById']),
  // inserting or removing a node visits its whole subtree: constant for a lone node, linear for a fragment or a populated element
  DOM_SUBTREE_METHODS: set(['appendChild', 'insertBefore', 'removeChild', 'replaceChild']),
  DOM_MARKUP_METHODS: set(['insertAdjacentHTML']), // parsed and inserted: linear in the markup
  // string methods that are constant time when the receiver is a plain stored string (no extra memory either)
  STRING_O1_METHODS: new Set()
};

const spec = Object.assign({}, common, {
  engine: 'spec',
  O1_METHODS: set(O1),
  LOG_METHODS: set(COLLECTION_OPS),
  N_METHODS: set(N),
  ropes: false
});

const v8 = Object.assign({}, common, {
  engine: 'v8',
  // Array.prototype.shift never moves more than a small constant number of elements (bigger arrays just move their start),
  // and trimming only looks at the whitespace around the text
  O1_METHODS: set(O1, COLLECTION_OPS, ['shift', 'trim', 'trimStart', 'trimEnd']),
  ALLOC_METHODS: set(ALLOC.filter((name) => !['trim', 'trimStart', 'trimEnd'].includes(name))), // the result shares the characters
  LOG_METHODS: new Set(),
  N_METHODS: set(N.filter((name) => !['shift', 'trim', 'trimStart', 'trimEnd'].includes(name))),
  // substrings of long stored strings share the parent's characters
  STRING_O1_METHODS: set(['slice', 'substring', 'substr']),
  ropes: true // concatenation, repeat and padding build ropes: logarithmic until the string is read
});

exports.spec = spec;
exports.v8 = v8;
exports.profile = (engine) => (engine === 'v8' ? v8 : spec);
