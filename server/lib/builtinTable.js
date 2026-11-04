'use strict';

// Static lookup of what JavaScript built-ins cost, per engine profile. complexity.js reads it (through builtins.js)
// to cost calls and to break a call down into the steps it performs.
//
// Every row is one built-in function, accessor or constructor, keyed `Owner.name` (`Array.prototype.sort`, `Math.max`,
// `new Map`, `parseInt`; well-known symbols are `@@iterator`). A row holds, per profile, the time and memory the call
// takes as a function of its main input `n` (the receiver, or the argument that is walked), and optionally the steps
// the work is made of:
//
//   time   '1' | 'log' | 'n' | 'nlogn' | 'arg' (set by a count / length argument) | 'sized' (a constructor
//          allocating what its first argument says) | 'unknown'; a trailing '*cb' multiplies by the cost of the
//          callback argument (`n*cb` runs it once per element, plain `cb` runs it once)
//   space  '1' | 'log' | 'n' | 'arg' | 'cb' (what the callback holds) | 'unknown'
//   steps  [[name, time, space], ...] in the order they happen; only written when a call is more than one thing
//
// Profiles (see builtins.js for how they are used):
//   spec   what the ECMAScript algorithm implies. The standard states no complexities itself, except that Map / Set /
//          WeakMap operations must be sublinear on average, so a row is read off the loops of the algorithm.
//   v8     what V8 (12.4, the engine of Node 22 LTS) does where that differs. A row without a `v8` part is the same.
//
// Sources, in order of preference: `ref` is a file and symbol in the V8 source (checked by
// scripts/verify-builtin-table.js), else the section of ECMA-262 the row is named after (`sec-array.prototype.sort`,
// checked against test/fixtures/spec-sections.json), else the row is marked `est`: our own estimate, because neither
// states it (formatting with ICU, the browser, the DOM). `note` records anything a class hides.

const TA = ['Int8Array', 'Uint8Array', 'Uint8ClampedArray', 'Int16Array', 'Uint16Array', 'Int32Array', 'Uint32Array',
  'Float32Array', 'Float64Array', 'BigInt64Array', 'BigUint64Array'];

// property names that are accessors (getters): reading them is a property access, calling one is a mistake
const ACCESSORS = new Set(['size', 'buffer', 'byteLength', 'byteOffset', 'length', 'description', 'detached', 'maxByteLength', 'resizable',
  'growable', 'dotAll', 'flags', 'global', 'hasIndices', 'ignoreCase', 'multiline', 'source', 'sticky', 'unicode', 'unicodeSets',
  'disposed', 'constructor', '@@toStringTag', '__proto__', '@@species']);

const rows = [];

// owner: '' (global), 'Math', 'Array.prototype', 'new' (constructors), 'dom'
const kindOf = (owner) => {
  if (owner === '') {
    return 'global';
  }
  if (owner === 'new') {
    return 'ctor';
  }
  if (owner === 'dom') {
    return 'dom';
  }
  return /prototype/i.test(owner) ? 'method' : 'static';
};

const nameOf = (owner, name) => (owner === 'new' ? `new ${name}` : (owner === '' ? name : `${owner}.${name}`));

/**
 * @param {string} owner
 * @param {string} names space separated
 * @param {string} time
 * @param {string} space
 * @param {object} [opts] { steps, v8: {time, space, steps, shared}, ref, blink, est, primary, note, shared }
 */
const def = (owner, names, time, space, opts = {}) => {
  for (const name of names.split(' ')) {
    const spec = { time, space };
    if (opts.steps) {
      spec.steps = opts.steps;
    }
    const v8 = Object.assign({}, spec, opts.v8 || {});
    const key = nameOf(owner, name);
    rows.push({
      key,
      owner,
      name,
      kind: kindOf(owner),
      accessor: ACCESSORS.has(name),
      spec,
      v8,
      ref: opts.ref || null,
      blink: opts.blink || null,
      est: Boolean(opts.est),
      primary: Boolean(opts.primary),
      note: opts.note || ''
    });
  }
};

const V8 = 'src/builtins/';
const TQ = (file, symbol) => `${V8}${file}.tq#${symbol}`;
const CC = (file, symbol) => `${V8}${file}.cc#${symbol}`;
const BL = (file, symbol) => `third_party/blink/renderer/${file}#${symbol}`;

// ---------------------------------------------------------------------------------------------------------------
// global functions
// ---------------------------------------------------------------------------------------------------------------
def('', 'isFinite isNaN', '1', '1', { ref: CC('builtins-global-gen', 'GlobalIsFinite') });
def('', 'parseFloat parseInt', '1', '1', { note: 'reads the digits of a numeric string; those are short in practice, so it is costed as constant' });
def('', 'encodeURI encodeURIComponent decodeURI decodeURIComponent escape unescape', 'n', 'n', {
  steps: [['scan characters', 'n', '1'], ['build result', 'n', 'n']],
  ref: CC('builtins-global', 'GlobalEncodeURI')
});
def('', 'eval', 'unknown', 'unknown', { steps: [['parse source', 'n', 'n'], ['run it', 'unknown', 'unknown']], note: 'runs arbitrary code' });

// ---------------------------------------------------------------------------------------------------------------
// Object
// ---------------------------------------------------------------------------------------------------------------
def('Object', 'keys values entries', 'n', 'n', {
  steps: [['collect own keys', 'n', 'n'], ['copy into result array', 'n', 'n']],
  ref: CC('builtins-object-gen', 'ObjectKeys'),
  note: 'V8 copies the enum cache of a fast object; a dictionary object is walked'
});
def('Object', 'assign', 'n', '1', { steps: [['read each source key', 'n', '1'], ['write on target', 'n', '1']], ref: CC('builtins-object-gen', 'ObjectAssign') });
def('Object', 'fromEntries', 'n*cb', 'n', { steps: [['iterate entries', 'n', '1'], ['define properties', 'n', 'n']], ref: TQ('object-fromentries', 'ObjectFromEntries') });
def('Object', 'groupBy', 'n*cb', 'n', { steps: [['iterate items', 'n', '1'], ['callback per item', 'n*cb', 'cb'], ['group', 'n', 'n']], ref: TQ('object-groupby', 'ObjectGroupBy') });
def('Object', 'freeze seal', 'n', '1', { steps: [['visit every own key', 'n', '1'], ['redefine as non-configurable', 'n', '1']], ref: CC('builtins-object', 'ObjectFreeze'), note: 'seal is one step cheaper per key' });
def('Object', 'isFrozen isSealed', '1', '1', { v8: {}, ref: CC('builtins-object', 'ObjectIsFrozen'), note: 'spec TestIntegrityLevel checks every key; a frozen or sealed object is flagged, which V8 answers from its map' });
def('Object', 'getOwnPropertyNames getOwnPropertySymbols', 'n', 'n', { ref: CC('builtins-object', 'ObjectGetOwnPropertySymbols') });
def('Object', 'getOwnPropertyDescriptors', 'n', 'n', { steps: [['visit every own key', 'n', '1'], ['build a descriptor', 'n', 'n']], ref: CC('builtins-object', 'ObjectGetOwnPropertyDescriptors') });
def('Object', 'defineProperties', 'n', '1', { ref: CC('builtins-object', 'ObjectDefineProperties') });
def('Object', 'create getPrototypeOf setPrototypeOf defineProperty getOwnPropertyDescriptor is hasOwn isExtensible preventExtensions', '1', '1', { ref: CC('builtins-object-gen', 'ObjectHasOwn') });

def('Object.prototype', 'hasOwnProperty propertyIsEnumerable valueOf toLocaleString __lookupGetter__ __lookupSetter__ __defineGetter__ __defineSetter__ __proto__', '1', '1', { ref: CC('builtins-object-gen', 'ObjectPrototypeHasOwnProperty') });
def('Object.prototype', 'isPrototypeOf', '1', '1', { note: 'walks the prototype chain of its argument, which is short' });
def('Object.prototype', 'toString', '1', '1', { primary: true, note: 'other toString methods are costed by what they print: Array.prototype.toString is linear' });

// ---------------------------------------------------------------------------------------------------------------
// Function, Boolean, Symbol, Error
// ---------------------------------------------------------------------------------------------------------------
def('Function.prototype', 'apply', 'n', 'n', { steps: [['read arguments array', 'n', 'n'], ['call', '1', '1']], ref: CC('builtins-function', 'FunctionPrototypeBind') });
def('Function.prototype', 'call bind @@hasInstance', '1', '1', { ref: CC('builtins-function', 'FunctionPrototypeBind') });
def('Function.prototype', 'toString', 'n', 'n', { note: 'copies the function source text' });
def('Boolean.prototype', 'toString valueOf', '1', '1', { ref: TQ('boolean', 'BooleanPrototypeToString') });
def('Symbol', 'for keyFor', '1', '1', { ref: CC('builtins-symbol', 'SymbolFor') });
def('Symbol.prototype', 'description toString valueOf @@toPrimitive', '1', '1', { ref: TQ('symbol', 'SymbolPrototypeToString') });
def('Error', 'isError', '1', '1');
def('Error', 'captureStackTrace prepareStackTrace', '1', '1', { ref: CC('builtins-error', 'ErrorCaptureStackTrace'), note: 'capturing a stack trace is bounded by the stack trace limit' });
def('Error.prototype', 'toString', '1', '1', { ref: CC('builtins-error', 'ErrorPrototypeToString') });

// ---------------------------------------------------------------------------------------------------------------
// Number, BigInt, Math, Date
// ---------------------------------------------------------------------------------------------------------------
def('Number', 'isFinite isInteger isNaN isSafeInteger parseFloat parseInt', '1', '1', { ref: TQ('number', 'NumberIsInteger') });
def('Number.prototype', 'toExponential toFixed toLocaleString toPrecision toString valueOf', '1', '1', { primary: true, ref: CC('builtins-number', 'NumberPrototypeToFixed'), note: 'bounded by the number of digits printed' });
def('BigInt', 'asIntN asUintN', '1', '1', { ref: CC('builtins-bigint', 'BigIntAsUintN'), note: 'linear in the words of the BigInt; constant for the word sized values tests use' });
def('BigInt.prototype', 'toLocaleString toString valueOf', '1', '1', { ref: CC('builtins-bigint', 'BigIntPrototypeToString'), note: 'linear or worse in the digits of a huge BigInt' });
def('Math', 'abs acos acosh asin asinh atan atanh atan2 cbrt ceil clz32 cos cosh exp expm1 floor fround f16round hypot imul log log1p log10 log2 max min pow random round sign sin sinh sqrt tan tanh trunc', '1', '1', { ref: TQ('math', 'MathAbs') });
def('Math', 'sumPrecise', 'n', '1', { note: 'sums an iterable' });
def('Date', 'now parse UTC', '1', '1', { ref: CC('builtins-date', 'DateNow') });
def('Date.prototype', 'getDate getDay getFullYear getHours getMilliseconds getMinutes getMonth getSeconds getTime getTimezoneOffset getUTCDate getUTCDay getUTCFullYear getUTCHours getUTCMilliseconds getUTCMinutes getUTCMonth getUTCSeconds getYear valueOf', '1', '1', { ref: CC('builtins-date-gen', 'DatePrototypeGetTime') });
def('Date.prototype', 'setDate setFullYear setHours setMilliseconds setMinutes setMonth setSeconds setTime setUTCDate setUTCFullYear setUTCHours setUTCMilliseconds setUTCMinutes setUTCMonth setUTCSeconds setYear', '1', '1', { ref: CC('builtins-date', 'DatePrototypeSetFullYear') });
def('Date.prototype', 'toDateString toISOString toJSON toString toTimeString toUTCString toGMTString @@toPrimitive', '1', '1', { ref: CC('builtins-date', 'DatePrototypeToISOString') });
def('Date.prototype', 'toLocaleDateString toLocaleString toLocaleTimeString', '1', '1', { ref: CC('builtins-date', 'DatePrototypeToLocaleString'), note: 'formatted by ICU, bounded by the format' });

// ---------------------------------------------------------------------------------------------------------------
// String
// ---------------------------------------------------------------------------------------------------------------
def('String', 'fromCharCode fromCodePoint raw', '1', '1', { ref: CC('builtins-string', 'StringFromCodePoint'), note: 'one character per argument; spread arguments are costed at the call' });
def('String.prototype', 'at charAt charCodeAt codePointAt toString valueOf @@iterator', '1', '1', { ref: TQ('string-at', 'StringPrototypeAt'), note: 'on a concatenation that was never read V8 first flattens it, once' });
def('String.prototype', 'isWellFormed', 'n', '1', { v8: { time: '1' }, ref: TQ('string-iswellformed', 'StringPrototypeIsWellFormed'), note: 'V8 answers one-byte strings without looking' });
def('String.prototype', 'indexOf includes lastIndexOf', 'n', '1', {
  steps: [['search', 'n', '1']],
  ref: TQ('string-indexof', 'StringPrototypeIndexOf'),
  note: 'V8 searches with Boyer-Moore-Horspool; worst case is linear in the text times the pattern'
});
def('String.prototype', 'startsWith endsWith', 'n', '1', { ref: TQ('string-startswith', 'StringPrototypeStartsWith'), note: 'compares as many characters as the search string has' });
def('String.prototype', 'slice substring substr', 'n', 'n', {
  steps: [['copy characters', 'n', 'n']],
  v8: { time: '1', space: '1', shared: true, steps: [['share the parent characters', '1', '1']] },
  ref: TQ('string-substring', 'StringPrototypeSubstring'),
  note: 'V8 makes a SlicedString of 13 or more characters that points into the parent instead of copying'
});
def('String.prototype', 'trim trimStart trimEnd trimLeft trimRight', 'n', 'n', {
  steps: [['scan whitespace at the ends', '1', '1'], ['copy the rest', 'n', 'n']],
  v8: { time: '1', space: '1', steps: [['scan whitespace at the ends', '1', '1'], ['share the rest', '1', '1']] },
  ref: TQ('string-trim', 'StringPrototypeTrim')
});
def('String.prototype', 'concat', 'n', 'n', { v8: { time: '1', space: '1', steps: [['link a rope node', '1', '1']] }, steps: [['copy both strings', 'n', 'n']], note: 'V8 joins strings of 13 or more characters into a rope without copying; reading the result later flattens it' });
def('String.prototype', 'repeat', 'arg', 'arg', {
  steps: [['append the string count times', 'arg', 'arg']],
  v8: { time: 'log', space: 'log', steps: [['double the repeated part', 'log', 'log'], ['join into a rope', 'log', 'log']] },
  ref: TQ('string-repeat', 'StringRepeat'),
  note: 'V8 builds the result with ~log2(count) concatenations of ropes'
});
def('String.prototype', 'padStart padEnd', 'arg', 'arg', {
  steps: [['build the fill', 'arg', 'arg'], ['join with the string', 'n', 'n']],
  v8: { time: 'log', space: 'log', steps: [['build the fill by doubling', 'log', 'log'], ['join into a rope', 'log', 'log']] },
  ref: TQ('string-pad', 'StringPrototypePadStart')
});
def('String.prototype', 'toLowerCase toUpperCase toLocaleLowerCase toLocaleUpperCase normalize toWellFormed', 'n', 'n', { steps: [['map every character', 'n', '1'], ['build result', 'n', 'n']], ref: CC('builtins-string', 'StringPrototypeNormalize') });
def('String.prototype', 'localeCompare', 'n', '1', { ref: CC('builtins-string', 'StringPrototypeLocaleCompare'), note: 'ICU collation compares until the strings differ' });
def('String.prototype', 'match matchAll search replace replaceAll split', 'n', 'n', {
  steps: [['scan for the pattern', 'n', '1'], ['build result', 'n', 'n']],
  ref: TQ('string-match-search', 'StringPrototypeMatch'),
  note: 'a regular expression with nested quantifiers can backtrack exponentially'
});
def('String.prototype', 'anchor big blink bold fixed fontcolor fontsize italics link small strike sub sup', 'n', 'n', { ref: TQ('string-html', 'StringPrototypeAnchor'), note: 'wraps a copy of the string in markup' });

// ---------------------------------------------------------------------------------------------------------------
// RegExp
// ---------------------------------------------------------------------------------------------------------------
def('RegExp', 'escape', 'n', 'n');
def('RegExp', '@@species', '1', '1');
def('RegExp', '$1 $2 $3 $4 $5 $6 $7 $8 $9 $_ $& $` $\' $+ input lastMatch lastParen leftContext rightContext', '1', '1', { ref: CC('builtins-regexp', 'RegExpInputGetter'), note: 'legacy static properties of the last match' });
def('RegExp.prototype', 'exec test @@match @@replace @@search @@split', 'n', '1', {
  steps: [['match from lastIndex', 'n', '1'], ['build the match array', '1', '1']],
  ref: TQ('regexp-exec', 'RegExpPrototypeExec'),
  note: 'irregexp is a backtracking matcher: patterns with nested quantifiers are exponential in the worst case'
});
def('RegExp.prototype', '@@matchAll', '1', '1', { ref: TQ('regexp-match-all', 'RegExpPrototypeMatchAll'), note: 'returns a lazy iterator, matching happens as it is consumed' });
def('RegExp.prototype', 'dotAll flags global hasIndices ignoreCase multiline source sticky unicode unicodeSets toString compile', '1', '1', { ref: CC('builtins-regexp', 'RegExpPrototypeToString') });

// ---------------------------------------------------------------------------------------------------------------
// Array
// ---------------------------------------------------------------------------------------------------------------
def('Array', 'isArray of', '1', '1', { ref: TQ('array-isarray', 'ArrayIsArray'), note: 'Array.of copies its (literal) arguments' });
def('Array', 'from', 'n*cb', 'n', { steps: [['iterate the source', 'n', '1'], ['callback per element', 'n*cb', 'cb'], ['store', 'n', 'n']], ref: TQ('array-from', 'ArrayFrom') });
def('Array', 'fromAsync', 'n*cb', 'n', { ref: TQ('array-from-async', 'ArrayFromAsync') });
def('Array', '@@species', '1', '1');
def('Array.prototype', 'at', '1', '1', { ref: TQ('array-at', 'ArrayPrototypeAt') });
def('Array.prototype', 'push pop', '1', '1', { ref: CC('builtins-array', 'ArrayPush'), note: 'amortized: the backing store grows by half plus 16 and is trimmed when it is less than half full' });
def('Array.prototype', 'shift', 'n', '1', {
  steps: [['move the elements down', 'n', '1']],
  v8: { time: '1', steps: [['trim the front of the backing store', '1', '1']] },
  ref: TQ('array-shift', 'ArrayPrototypeShift'),
  note: 'V8 moves at most 100 elements, longer arrays just advance their start'
});
def('Array.prototype', 'unshift', 'n', '1', { steps: [['move the elements up', 'n', '1'], ['write the new elements', '1', '1']], ref: TQ('array-unshift', 'ArrayPrototypeUnshift') });
def('Array.prototype', 'splice', 'n', 'n', { steps: [['copy the removed part', 'n', 'n'], ['move the tail', 'n', '1']], ref: TQ('array-splice', 'ArrayPrototypeSplice') });
def('Array.prototype', 'slice', 'n', 'n', { steps: [['copy the range', 'n', 'n']], ref: TQ('array-slice', 'ArrayPrototypeSlice') });
def('Array.prototype', 'concat', 'n', 'n', { steps: [['copy every operand', 'n', 'n']], ref: CC('builtins-array', 'ArrayConcat'), primary: true });
def('Array.prototype', 'join toString toLocaleString', 'n', 'n', { steps: [['convert elements to text', 'n', 'n'], ['concatenate', 'n', 'n']], ref: TQ('array-join', 'ArrayPrototypeJoin') });
def('Array.prototype', 'reverse', 'n', '1', { ref: TQ('array-reverse', 'ArrayPrototypeReverse') });
def('Array.prototype', 'fill copyWithin', 'n', '1', { ref: CC('builtins-array', 'ArrayPrototypeFill') });
def('Array.prototype', 'flat', 'n', 'n', { steps: [['visit every element', 'n', '1'], ['append to result', 'n', 'n']], ref: TQ('array-flat', 'ArrayPrototypeFlat') });
def('Array.prototype', 'includes indexOf lastIndexOf', 'n', '1', { ref: TQ('array-lastindexof', 'ArrayPrototypeLastIndexOf') });
def('Array.prototype', 'toReversed with', 'n', 'n', { steps: [['copy elements', 'n', 'n']], ref: TQ('array-to-reversed', 'ArrayPrototypeToReversed') });
def('Array.prototype', 'toSpliced', 'n', 'n', { steps: [['copy elements', 'n', 'n']], ref: TQ('array-to-spliced', 'ArrayPrototypeToSpliced') });
def('Array.prototype', 'entries keys values @@iterator', '1', '1', { ref: CC('builtins-array-gen', 'ArrayPrototypeValues'), note: 'creates a lazy iterator: walking it is costed by the loop that consumes it' });
def('Array.prototype', 'every some find findIndex findLast findLastIndex forEach', 'n*cb', 'cb', {
  steps: [['visit elements', 'n', '1'], ['callback per element', 'n*cb', 'cb']],
  ref: TQ('array-foreach', 'ArrayForEach'),
  note: 'stops early on the first hit for every / some / find*'
});
def('Array.prototype', 'reduce reduceRight', 'n*cb', 'cb', { steps: [['visit elements', 'n', '1'], ['callback per element', 'n*cb', 'cb']], ref: TQ('array-reduce', 'ArrayReduce') });
def('Array.prototype', 'map filter flatMap', 'n*cb', 'n', {
  steps: [['visit elements', 'n', '1'], ['callback per element', 'n*cb', 'cb'], ['store results', 'n', 'n']],
  ref: TQ('array-map', 'ArrayMap')
});
def('Array.prototype', 'sort', 'nlogn*cb', 'n', {
  steps: [['copy elements to a work list', 'n', 'n'], ['merge sort the runs', 'nlogn*cb', 'n'], ['write the order back', 'n', '1']],
  ref: 'third_party/v8/builtins/array-sort.tq#ArrayPrototypeSort',
  note: 'V8 sorts with TimSort: n log n worst case, linear on data that is already ordered'
});
def('Array.prototype', 'toSorted', 'nlogn*cb', 'n', {
  steps: [['copy elements', 'n', 'n'], ['merge sort the runs', 'nlogn*cb', 'n']],
  ref: TQ('array-to-sorted', 'ArrayPrototypeToSorted')
});

// ---------------------------------------------------------------------------------------------------------------
// typed arrays
// ---------------------------------------------------------------------------------------------------------------
def('%TypedArray%', 'from', 'n*cb', 'n', { steps: [['iterate the source', 'n', '1'], ['callback per element', 'n*cb', 'cb'], ['store', 'n', 'n']], ref: TQ('typed-array-from', 'TypedArrayFrom') });
def('%TypedArray%', 'of', '1', '1', { ref: TQ('typed-array-of', 'TypedArrayOf'), note: 'copies its (literal) arguments' });
def('%TypedArray%', '@@species', '1', '1');
def('%TypedArray%.prototype', 'at buffer byteLength byteOffset length entries keys values @@iterator @@toStringTag subarray', '1', '1', { ref: TQ('typed-array-subarray', 'TypedArrayPrototypeSubArray'), note: 'subarray shares the buffer' });
def('%TypedArray%.prototype', 'copyWithin fill reverse', 'n', '1', { ref: CC('builtins-typed-array', 'TypedArrayPrototypeFill') });
def('%TypedArray%.prototype', 'includes indexOf lastIndexOf', 'n', '1', { ref: CC('builtins-typed-array', 'TypedArrayPrototypeIndexOf') });
def('%TypedArray%.prototype', 'join toString toLocaleString', 'n', 'n', { ref: CC('builtins-typed-array', 'TypedArrayPrototypeIncludes') });
def('%TypedArray%.prototype', 'set', 'n', '1', { steps: [['read the source', 'n', '1'], ['write at the offset', 'n', '1']], ref: TQ('typed-array-set', 'TypedArrayPrototypeSet') });
def('%TypedArray%.prototype', 'slice toReversed with', 'n', 'n', { ref: TQ('typed-array-slice', 'TypedArrayPrototypeSlice') });
def('%TypedArray%.prototype', 'every some find findIndex findLast findLastIndex forEach reduce reduceRight', 'n*cb', 'cb', { ref: TQ('typed-array-foreach', 'TypedArrayPrototypeForEach') });
def('%TypedArray%.prototype', 'map filter', 'n*cb', 'n', { ref: TQ('typed-array-filter', 'TypedArrayPrototypeFilter') });
def('%TypedArray%.prototype', 'sort toSorted', 'nlogn*cb', 'n', {
  steps: [['copy elements', 'n', 'n'], ['merge sort', 'nlogn*cb', 'n']],
  ref: TQ('typed-array-sort', 'TypedArrayPrototypeSort'),
  note: 'without a comparator V8 sorts the numbers directly with std::sort, which has no work list'
});
def('Uint8Array', 'fromBase64 fromHex', 'n', 'n');
def('Uint8Array.prototype', 'setFromBase64 setFromHex toBase64 toHex', 'n', 'n');

// ---------------------------------------------------------------------------------------------------------------
// keyed collections
// ---------------------------------------------------------------------------------------------------------------
// the standard only requires "sublinear on average"; V8 uses ordered hash tables
const HASHED = { time: '1', space: '1' };
def('Map.prototype', 'get has', 'log', '1', { v8: HASHED, primary: true, ref: CC('builtins-collections-gen', 'MapPrototypeGet'), note: 'hash table lookup' });
def('Map.prototype', 'set', 'log', '1', { v8: HASHED, primary: true, ref: CC('builtins-collections-gen', 'MapPrototypeSet'), note: 'amortized: the table doubles when it is full' });
def('Map.prototype', 'delete', 'log', '1', { v8: HASHED, primary: true, ref: CC('builtins-collections-gen', 'MapPrototypeDelete'), note: 'amortized: the table is rehashed when a quarter full' });
def('Map.prototype', 'getOrInsert getOrInsertComputed', 'log', '1', { v8: HASHED, est: true });
def('Map.prototype', 'clear', 'n', '1', { v8: { time: '1', steps: [['swap in an empty table', '1', '1']] }, steps: [['drop every entry', 'n', '1']], ref: 'src/objects/ordered-hash-table.cc#Clear', note: 'V8 swaps in an empty table' });
def('Map.prototype', 'forEach', 'n*cb', 'cb', { steps: [['visit entries', 'n', '1'], ['callback per entry', 'n*cb', 'cb']], ref: CC('builtins-collections-gen', 'MapPrototypeForEach') });
def('Map.prototype', 'entries keys values @@iterator size', '1', '1', { ref: CC('builtins-collections-gen', 'MapPrototypeGetSize') });
def('Map', 'groupBy', 'n*cb', 'n', { steps: [['iterate items', 'n', '1'], ['callback per item', 'n*cb', 'cb'], ['group', 'n', 'n']], ref: TQ('map-groupby', 'MapGroupBy') });
def('Map', '@@species', '1', '1');
def('Set.prototype', 'add has', 'log', '1', { v8: HASHED, primary: true, ref: CC('builtins-collections-gen', 'SetPrototypeAdd') });
def('Set.prototype', 'delete', 'log', '1', { v8: HASHED, primary: true, ref: CC('builtins-collections-gen', 'SetPrototypeDelete') });
def('Set.prototype', 'clear', 'n', '1', { v8: { time: '1', steps: [['swap in an empty table', '1', '1']] }, steps: [['drop every entry', 'n', '1']], ref: 'src/objects/ordered-hash-table.cc#Clear' });
def('Set.prototype', 'forEach', 'n*cb', 'cb', { steps: [['visit values', 'n', '1'], ['callback per value', 'n*cb', 'cb']], ref: CC('builtins-collections-gen', 'MapPrototypeForEach') });
def('Set.prototype', 'entries keys values @@iterator size', '1', '1', { ref: CC('builtins-collections-gen', 'SetPrototypeGetSize') });
def('Set.prototype', 'union intersection difference symmetricDifference', 'n', 'n', {
  steps: [['visit the values', 'n', '1'], ['probe the other set', 'n', '1'], ['store the result', 'n', 'n']],
  ref: TQ('set-union', 'SetPrototypeUnion')
});
def('Set.prototype', 'isSubsetOf isSupersetOf isDisjointFrom', 'n', '1', { ref: TQ('set-is-subset-of', 'SetPrototypeIsSubsetOf') });
def('Set', '@@species', '1', '1');
def('WeakMap.prototype', 'get has set delete getOrInsert getOrInsertComputed', 'log', '1', { v8: HASHED, ref: CC('builtins-collections-gen', 'WeakMapPrototypeSet') });
def('WeakSet.prototype', 'add has delete', 'log', '1', { v8: HASHED, ref: CC('builtins-collections-gen', 'WeakSetPrototypeAdd') });
def('WeakRef.prototype', 'deref', '1', '1', { ref: TQ('weak-ref', 'WeakRefDeref') });
def('FinalizationRegistry.prototype', 'register unregister', '1', '1', { ref: TQ('finalization-registry', 'FinalizationRegistryRegister') });

// ---------------------------------------------------------------------------------------------------------------
// binary data and Atomics
// ---------------------------------------------------------------------------------------------------------------
def('ArrayBuffer', 'isView @@species', '1', '1', { ref: TQ('arraybuffer', 'ArrayBufferIsView') });
def('ArrayBuffer.prototype', 'byteLength detached maxByteLength resizable', '1', '1');
def('ArrayBuffer.prototype', 'slice resize transfer transferToFixedLength', 'n', 'n', { steps: [['allocate', 'arg', 'arg'], ['copy bytes', 'n', '1']], ref: CC('builtins-arraybuffer', 'ArrayBufferPrototypeSlice') });
def('SharedArrayBuffer', '@@species', '1', '1');
def('SharedArrayBuffer.prototype', 'byteLength growable maxByteLength grow', '1', '1');
def('SharedArrayBuffer.prototype', 'slice', 'n', 'n');
def('DataView.prototype', 'buffer byteLength byteOffset getBigInt64 getBigUint64 getFloat16 getFloat32 getFloat64 getInt8 getInt16 getInt32 getUint8 getUint16 getUint32 setBigInt64 setBigUint64 setFloat16 setFloat32 setFloat64 setInt8 setInt16 setInt32 setUint8 setUint16 setUint32', '1', '1', { ref: TQ('data-view', 'DataViewPrototypeGetInt8') });
def('Atomics', 'add and compareExchange exchange isLockFree load notify or pause store sub xor', '1', '1', { ref: CC('builtins-sharedarraybuffer-gen', 'AtomicsLoad') });
def('Atomics', 'wait waitAsync', 'unknown', '1', { ref: CC('builtins-sharedarraybuffer', 'AtomicsWait'), note: 'blocks until another thread notifies' });

// ---------------------------------------------------------------------------------------------------------------
// JSON, iterators, promises, reflection
// ---------------------------------------------------------------------------------------------------------------
def('JSON', 'parse', 'n', 'n', { steps: [['scan the text', 'n', '1'], ['build the values', 'n', 'n']], ref: CC('builtins-json', 'JsonParse') });
def('JSON', 'stringify', 'n', 'n', { steps: [['walk the value graph', 'n', 'log'], ['build the text', 'n', 'n']], ref: CC('builtins-json', 'JsonStringify') });
def('JSON', 'rawJSON', 'n', 'n');
def('JSON', 'isRawJSON', '1', '1');
def('Iterator', 'from concat zip zipKeyed', '1', '1', { ref: TQ('iterator-from', 'IteratorFrom'), note: 'lazy: the iterator does its work as it is consumed' });
def('Iterator.prototype', 'map filter flatMap take drop chunks windows @@iterator @@dispose', '1', '1', { ref: TQ('iterator-helpers', 'IteratorPrototypeMap'), note: 'lazy helpers: each step costs when it is pulled by a consumer' });
def('Iterator.prototype', 'forEach every some find reduce', 'n*cb', 'cb', {
  steps: [['pull every value', 'n', '1'], ['callback per value', 'n*cb', 'cb']],
  ref: TQ('iterator-helpers', 'IteratorPrototypeForEach')
});
def('Iterator.prototype', 'toArray includes join', 'n', 'n', { ref: TQ('iterator-helpers', 'IteratorPrototypeToArray') });
def('%AsyncIteratorPrototype%', '@@asyncIterator', '1', '1', { est: true });
def('%AsyncIteratorPrototype%', '@@asyncDispose', 'unknown', 'unknown', { est: true, note: 'awaits the iterator\'s return()' });
def('%IteratorHelperPrototype%', 'next return', '1', '1', { ref: TQ('iterator-helpers', 'IteratorPrototypeMap') });
def('%WrapForValidIteratorPrototype%', 'next return', '1', '1', { ref: TQ('iterator-from', 'IteratorFrom') });
def('%ArrayIteratorPrototype%', 'next', '1', '1', { primary: true, ref: CC('builtins-array-gen', 'ArrayIteratorPrototypeNext') });
def('%MapIteratorPrototype%', 'next', '1', '1', { ref: CC('builtins-collections-gen', 'MapIteratorPrototypeNext') });
def('%SetIteratorPrototype%', 'next', '1', '1', { ref: CC('builtins-collections-gen', 'SetIteratorPrototypeNext') });
def('%StringIteratorPrototype%', 'next', '1', '1', { ref: TQ('string-iterator', 'StringPrototypeIterator') });
def('%RegExpStringIteratorPrototype%', 'next', 'n', 'n', { est: true, note: 'runs the next match' });
def('%ForInIteratorPrototype%', 'next', '1', '1', { est: true });
def('%AsyncFromSyncIteratorPrototype%', 'next return throw', '1', '1', { est: true });
def('%GeneratorPrototype%', 'next return throw', 'unknown', 'unknown', { ref: CC('builtins-generator-gen', 'GeneratorPrototypeNext'), note: 'runs the generator body up to its next yield' });
def('%AsyncGeneratorPrototype%', 'next return throw', 'unknown', 'unknown', { est: true });
def('Promise', 'all allSettled any race', 'n', 'n', { steps: [['iterate the promises', 'n', '1'], ['subscribe to each', 'n', 'n']], ref: TQ('promise-all', 'PromiseAll') });
def('Promise', 'resolve reject try withResolvers @@species', '1', '1', { ref: TQ('promise-resolve', 'PromiseResolve') });
def('Promise.prototype', 'then catch finally', 'cb', 'cb', { ref: TQ('promise-then', 'PromisePrototypeThen'), note: 'the callback runs once, later' });
def('Reflect', 'apply construct ownKeys', 'n', 'n', { ref: CC('builtins-reflect', 'ReflectDefineProperty'), note: 'apply / construct read their arguments array; ownKeys copies the keys' });
def('Reflect', 'defineProperty deleteProperty get getOwnPropertyDescriptor getPrototypeOf has isExtensible preventExtensions set setPrototypeOf', '1', '1', { ref: CC('builtins-reflect', 'ReflectDefineProperty') });
def('Proxy', 'revocable', '1', '1', { ref: TQ('proxy-revocable', 'ProxyRevocable') });
def('DisposableStack.prototype', 'adopt defer move use disposed', '1', '1', { est: true });
def('DisposableStack.prototype', 'dispose @@dispose', 'n*cb', 'cb', { est: true, note: 'runs every disposer once' });
def('AsyncDisposableStack.prototype', 'adopt defer move use disposed', '1', '1', { est: true });
def('AsyncDisposableStack.prototype', 'disposeAsync @@asyncDispose', 'n*cb', 'cb', { est: true });

// ---------------------------------------------------------------------------------------------------------------
// constructors (`new X(...)`); 'sized' = what the first argument says
// ---------------------------------------------------------------------------------------------------------------
def('new', 'Array ArrayBuffer SharedArrayBuffer ' + TA.join(' '), 'sized', 'sized', { ref: CC('builtins-constructor-gen', 'FastNewObject'), note: 'allocates and zero-fills `length` slots, or copies the array or iterable passed' });
def('new', 'Map Set WeakMap WeakSet AggregateError', 'sized', 'sized', { ref: CC('builtins-collections-gen', 'MapPrototypeSet'), note: 'adds every entry of the iterable passed' });
def('new', 'Date Object Error TypeError RangeError EvalError ReferenceError SyntaxError URIError Boolean Number String RegExp DataView WeakRef FinalizationRegistry Proxy DisposableStack AsyncDisposableStack Iterator Symbol BigInt', '1', '1', { note: 'RegExp compiles its pattern, linear in its length (a literal is compiled once)' });
def('new', 'Promise', 'cb', '1', { ref: TQ('promise-constructor', 'PromiseConstructor'), note: 'the executor runs once, synchronously' });
def('new', 'Function', 'unknown', 'unknown', { note: 'compiles the source it is given' });

// ---------------------------------------------------------------------------------------------------------------
// the host: not part of ECMAScript (browser and DOM), estimated
// ---------------------------------------------------------------------------------------------------------------
def('', 'setTimeout clearTimeout setInterval clearInterval queueMicrotask', '1', '1', { est: true, note: 'schedules and returns; the callback runs later, once (Blink DOMTimer, V8 EnqueueMicrotask)' });
def('', 'requestAnimationFrame', '1', '1', { blink: BL('core/dom/scripted_animation_controller.cc', 'RegisterFrameCallback'), note: 'appends to the frame callbacks; the callback runs before the next paint' });
def('', 'cancelAnimationFrame', '1', '1', { blink: BL('core/dom/scripted_animation_controller.cc', 'CancelFrameCallback'), note: 'erases from the pending callbacks, which are few' });
def('', 'structuredClone', 'n', 'n', { blink: BL('bindings/core/v8/serialization/v8_script_value_serializer.cc', 'Serialize'), steps: [['walk the value graph', 'n', 'log'], ['copy it', 'n', 'n']], note: 'Blink serializes with V8\'s ValueSerializer, then deserializes the bytes' });
def('', 'fetch', '1', '1', { blink: BL('core/fetch/global_fetch.cc', 'fetch'), note: 'starts the request and returns a promise' });
def('', 'atob btoa', 'n', 'n', { est: true, note: 'Blink decodes / encodes base64, one pass over the string' });
def('console', 'log warn error info debug dir table trace time timeEnd timeLog group groupEnd groupCollapsed assert count countReset clear', '1', '1', { ref: CC('builtins-console', 'CONSOLE_METHOD_LIST'), note: 'V8 hands the arguments to the inspector; printing an object is bounded by what the console shows' });
def('performance', 'now', '1', '1', { blink: BL('core/timing/performance.cc', 'now') });
def('performance', 'mark measure clearMarks clearMeasures', '1', '1', { blink: BL('core/timing/performance_user_timing.cc', 'ClearMarks'), note: 'marks are kept by name; measure looks its endpoints up' });
def('performance', 'getEntries getEntriesByName getEntriesByType', 'n', 'n', { blink: BL('core/timing/performance.cc', 'getEntriesByName'), note: 'copies the matching entries of the buffers in start order' });
def('Intl.Collator.prototype', 'compare', '1', '1', { ref: CC('builtins-intl', 'CollatorPrototypeCompare') });
def('Intl.DateTimeFormat.prototype', 'format formatToParts formatRange formatRangeToParts', '1', '1', { ref: CC('builtins-intl', 'DateTimeFormatPrototypeFormatRange') });
def('Intl.NumberFormat.prototype', 'format formatToParts formatRange formatRangeToParts', '1', '1', { ref: CC('builtins-intl', 'NumberFormatPrototypeFormatToParts') });
def('Intl.PluralRules.prototype', 'select selectRange', '1', '1', { ref: CC('builtins-intl', 'PluralRulesPrototypeSelect') });
def('Intl.RelativeTimeFormat.prototype', 'format formatToParts', '1', '1', { ref: CC('builtins-intl', 'RelativeTimeFormatPrototypeFormatToParts') });
def('Intl.ListFormat.prototype', 'format formatToParts', '1', '1', { est: true, note: 'bounded by the list passed, which is short' });
def('Intl.Collator.prototype', 'resolvedOptions', '1', '1', { est: true });
def('Intl.DateTimeFormat.prototype', 'resolvedOptions', '1', '1', { est: true });
def('Intl.NumberFormat.prototype', 'resolvedOptions', '1', '1', { est: true });
def('Intl.PluralRules.prototype', 'resolvedOptions', '1', '1', { est: true });
def('Intl.RelativeTimeFormat.prototype', 'resolvedOptions', '1', '1', { est: true });
def('Intl.ListFormat.prototype', 'resolvedOptions', '1', '1', { est: true });
def('Intl', 'getCanonicalLocales', '1', '1', { ref: CC('builtins-intl', 'IntlGetCanonicalLocales') });
def('Intl', 'supportedValuesOf', '1', '1', { ref: CC('builtins-intl', 'IntlSupportedValuesOf') });
def('Intl.Collator', 'supportedLocalesOf', '1', '1', { ref: CC('builtins-intl', 'CollatorSupportedLocalesOf') });
def('new', 'Event', '1', '1', { blink: BL('core/dom/events/event.cc', 'Event') });
def('new', 'CustomEvent', '1', '1', { blink: BL('core/dom/events/custom_event.cc', 'CustomEvent') });
def('new', 'EventTarget', '1', '1', { blink: BL('core/dom/events/event_target.cc', 'EventTarget') });
def('new', 'TextEncoder TextDecoder', '1', '1', { blink: BL('modules/encoding/text_encoder.cc', 'Create') });
def('new', 'URL URLSearchParams Blob MutationObserver IntersectionObserver ResizeObserver', 'sized', 'sized', { est: true, note: 'parses or copies what it is given' });

// DOM methods are matched by name alone, before the JavaScript methods, so none may share a name with one of those
// time `tree`: walks the tree the receiver is in
def('dom', 'createElement', '1', '1', { blink: BL('core/dom/document.cc', 'CreateElementForBinding'), note: 'allocates one node' });
def('dom', 'createTextNode createComment createDocumentFragment', '1', '1', { blink: BL('core/dom/document.cc', 'createTextNode'), note: 'allocates one node' });
def('dom', 'getElementById', '1', '1', { blink: BL('core/dom/tree_scope.cc', 'getElementById'), note: 'a hash lookup in the tree scope\'s id map' });
def('dom', 'appendChild insertBefore removeChild replaceChild', 'subtree', 'subtree', {
  blink: BL('core/dom/container_node.cc', 'AppendChild'),
  steps: [['visit the subtree being moved', 'subtree', '1'], ['link it in', '1', '1']],
  note: 'constant for a lone node, linear for a fragment or a populated element'
});
def('dom', 'append prepend before after replaceWith', 'subtree', 'subtree', { blink: BL('core/dom/node.cc', 'append'), steps: [['visit the nodes being inserted', 'subtree', '1'], ['link them in', '1', '1']] });
def('dom', 'remove', 'subtree', '1', { blink: BL('core/dom/node.cc', 'remove'), note: 'detaching a subtree notifies every node in it' });
def('dom', 'insertAdjacentHTML', 'markup', 'markup', { blink: BL('core/dom/element.cc', 'insertAdjacentHTML'), steps: [['parse the markup', 'markup', 'markup'], ['insert the nodes', 'markup', '1']] });
def('dom', 'querySelector querySelectorAll', 'tree', 'tree', {
  blink: BL('core/css/selector_query.cc', 'QueryAll'),
  steps: [['walk the tree', 'tree', '1'], ['match each element', 'tree', '1']],
  note: 'an `#id` selector is a hash lookup; any other walks the root\'s subtree (class and tag selectors may stop early)'
});
def('dom', 'matches', '1', '1', { blink: BL('core/css/selector_query.cc', 'Matches'), note: 'matches the one element, right to left through its ancestors for a descendant selector' });
def('dom', 'closest', 'log', '1', { blink: BL('core/dom/element.cc', 'closest'), note: 'walks the ancestors, as deep as the tree' });
def('dom', 'getElementsByClassName getElementsByTagName', '1', '1', { blink: BL('core/dom/container_node.cc', 'getElementsByClassName'), note: 'returns a live collection; the tree is walked when it is read, and cached' });
def('dom', 'cloneNode', 'tree', 'tree', { blink: BL('core/dom/node.cc', 'cloneNode'), note: 'a shallow clone is one node; deep clones the whole subtree' });
def('dom', 'getAttribute setAttribute removeAttribute hasAttribute', '1', '1', { blink: BL('core/dom/element.cc', 'getAttribute'), note: 'an element has few attributes, searched in order' });
def('dom', 'addEventListener removeEventListener', '1', '1', { blink: BL('core/dom/events/event_target.cc', 'addEventListener'), note: 'compares against the listeners already registered for the type, which are few' });
def('dom', 'dispatchEvent', '1', '1', { blink: BL('core/dom/events/event_target.cc', 'dispatchEvent'), note: 'runs the listeners synchronously; what they cost is the cost of their own code' });
def('dom', 'getBoundingClientRect getClientRects', 'tree', '1', { blink: BL('core/dom/element.cc', 'getClientRects'), note: 'forces style and layout if the page changed since the last frame' });
def('dom', 'postMessage', 'n', 'n', { blink: BL('core/frame/dom_window.cc', 'postMessage'), note: 'serializes the message with the structured clone algorithm' });
def('dom', 'pushState replaceState', 'n', 'n', { blink: BL('core/frame/history.cc', 'pushState'), note: 'serializes the state object with the structured clone algorithm' });
def('dom', 'getComputedStyle', '1', '1', { blink: BL('core/frame/local_dom_window.cc', 'getComputedStyle'), note: 'returns a live declaration; the style is resolved when a property is read' });

// ---------------------------------------------------------------------------------------------------------------
// lookups
// ---------------------------------------------------------------------------------------------------------------

const byKey = new Map(rows.map((r) => [r.key, r]));

/**
 * @param {string} key e.g. `Array.prototype.sort`
 * @returns {object|undefined} the row
 */
const get = (key) => byKey.get(key);

/**
 * @param {string} name a method name such as `sort`
 * @param {string[]} [hints] owner prefixes to prefer (`Array.prototype`, `String.prototype`), best first
 * @returns {object|null} the row of the method called `name` on the best matching owner
 */
const method = (name, hints = []) => {
  const matches = rows.filter((r) => r.kind === 'method' && r.name === name);
  for (const hint of hints) {
    const hit = matches.find((r) => r.owner === hint);
    if (hit) {
      return hit;
    }
  }

  return matches.find((r) => r.primary) || matches[0] || null;
};

/**
 * @param {string} name a DOM method such as `appendChild`
 * @returns {object|null}
 */
const dom = (name) => rows.find((r) => r.kind === 'dom' && r.name === name) || null;

module.exports = { rows, get, method, dom, TA };
