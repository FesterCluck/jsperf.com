'use strict';

// Generates the benchmark pages owned by `testuser` into server/lib/db/seeds/testuser/.
// Usage: node tools/generate-testuser-seeds.js
const fs = require('fs');
const path = require('path');

const outDir = path.resolve(__dirname, '..', 'server', 'lib', 'db', 'seeds', 'testuser');

const sizes = [10, 50, 100, 500, 1000, 10000, 100000, 1000000];

// Each family describes one benchmark topic. `variants` are the parameter sets
// that produce one page each; `tests` returns the competing snippets.
const families = [
  {
    key: 'array-iteration',
    title: (p) => `Array iteration over ${p.n} items`,
    info: (p) => `Compares ways of visiting every element of an array with ${p.n} numbers.`,
    variants: sizes.map((n) => ({ n })),
    setup: (p) => [
      `var size = ${p.n};`,
      'var data = new Array(size);',
      'for (var i = 0; i < size; i++) {',
      '  data[i] = i * 2;',
      '}',
      'var sum = 0;'
    ],
    tests: (p) => [
      {
        title: 'for loop',
        code: [
          'sum = 0;',
          'for (var i = 0; i < data.length; i++) {',
          '  sum += data[i];',
          '}'
        ]
      },
      {
        title: 'for loop with cached length',
        code: [
          'sum = 0;',
          'for (var i = 0, len = data.length; i < len; i++) {',
          '  sum += data[i];',
          '}'
        ]
      },
      {
        title: 'reverse while loop',
        code: [
          'sum = 0;',
          'var i = data.length;',
          'while (i--) {',
          '  sum += data[i];',
          '}'
        ]
      },
      {
        title: 'forEach',
        code: [
          'sum = 0;',
          'data.forEach(function (value) {',
          '  sum += value;',
          '});'
        ]
      },
      {
        title: 'for...of',
        code: [
          'sum = 0;',
          'for (const value of data) {',
          '  sum += value;',
          '}'
        ]
      },
      {
        title: 'reduce',
        code: [
          'sum = data.reduce(function (acc, value) {',
          '  return acc + value;',
          '}, 0);'
        ]
      }
    ]
  },
  {
    key: 'string-concat',
    title: (p) => `String building with ${p.n} pieces`,
    info: (p) => `Compares concatenation strategies when joining ${p.n} short strings.`,
    variants: sizes.slice(0, 5).map((n) => ({ n })),
    setup: (p) => [
      `var count = ${p.n};`,
      'var pieces = [];',
      'for (var i = 0; i < count; i++) {',
      "  pieces.push('item-' + i);",
      '}'
    ],
    tests: () => [
      {
        title: '+= operator',
        code: [
          "var result = '';",
          'for (var i = 0; i < pieces.length; i++) {',
          '  result += pieces[i];',
          '}'
        ]
      },
      {
        title: 'Array#join',
        code: [
          "var result = pieces.join('');"
        ]
      },
      {
        title: 'String#concat',
        code: [
          "var result = '';",
          'for (var i = 0; i < pieces.length; i++) {',
          '  result = result.concat(pieces[i]);',
          '}'
        ]
      },
      {
        title: 'reduce',
        code: [
          'var result = pieces.reduce(function (acc, piece) {',
          '  return acc + piece;',
          "}, '');"
        ]
      },
      {
        title: 'template literal',
        code: [
          "var result = '';",
          'for (var i = 0; i < pieces.length; i++) {',
          '  result = `$' + '{result}$' + '{pieces[i]}`;',
          '}'
        ]
      }
    ]
  },
  {
    key: 'object-keys',
    title: (p) => `Enumerating an object with ${p.n} keys`,
    info: (p) => `Different ways to walk the own enumerable properties of an object with ${p.n} keys.`,
    variants: sizes.slice(0, 5).map((n) => ({ n })),
    setup: (p) => [
      `var total = ${p.n};`,
      'var obj = {};',
      'for (var i = 0; i < total; i++) {',
      "  obj['key' + i] = i;",
      '}',
      'var acc = 0;'
    ],
    tests: () => [
      {
        title: 'for...in with hasOwnProperty',
        code: [
          'acc = 0;',
          'for (var key in obj) {',
          '  if (Object.prototype.hasOwnProperty.call(obj, key)) {',
          '    acc += obj[key];',
          '  }',
          '}'
        ]
      },
      {
        title: 'Object.keys',
        code: [
          'acc = 0;',
          'var keys = Object.keys(obj);',
          'for (var i = 0; i < keys.length; i++) {',
          '  acc += obj[keys[i]];',
          '}'
        ]
      },
      {
        title: 'Object.values',
        code: [
          'acc = 0;',
          'var values = Object.values(obj);',
          'for (var i = 0; i < values.length; i++) {',
          '  acc += values[i];',
          '}'
        ]
      },
      {
        title: 'Object.entries',
        code: [
          'acc = 0;',
          'Object.entries(obj).forEach(function (entry) {',
          '  acc += entry[1];',
          '});'
        ]
      }
    ]
  },
  {
    key: 'array-search',
    title: (p) => `Searching an array of ${p.n} items for a ${p.where} element`,
    info: (p) => `Looks up a value located at the ${p.where} of ${p.n} numbers using several built-ins.`,
    variants: [10, 100, 1000, 10000, 100000, 1000000].reduce((all, n) => all.concat(['start', 'middle', 'end', 'missing'].map((where) => ({ n, where }))), []),
    setup: (p) => [
      `var size = ${p.n};`,
      'var haystack = [];',
      'for (var i = 0; i < size; i++) {',
      '  haystack.push(i);',
      '}',
      `var needle = ${{ start: '0', middle: 'Math.floor(size / 2)', end: 'size - 1', missing: '-1' }[p.where]};`
    ],
    tests: () => [
      {
        title: 'indexOf',
        code: [
          'var found = haystack.indexOf(needle) !== -1;'
        ]
      },
      {
        title: 'includes',
        code: [
          'var found = haystack.includes(needle);'
        ]
      },
      {
        title: 'find',
        code: [
          'var found = haystack.find(function (item) {',
          '  return item === needle;',
          '}) !== undefined;'
        ]
      },
      {
        title: 'some',
        code: [
          'var found = haystack.some(function (item) {',
          '  return item === needle;',
          '});'
        ]
      },
      {
        title: 'manual loop',
        code: [
          'var found = false;',
          'for (var i = 0; i < haystack.length; i++) {',
          '  if (haystack[i] === needle) {',
          '    found = true;',
          '    break;',
          '  }',
          '}'
        ]
      }
    ]
  },
  {
    key: 'number-parse',
    title: (p) => `Converting ${p.kind} strings to numbers`,
    info: (p) => `Compares string-to-number conversions for ${p.kind} input.`,
    variants: [
      { kind: 'integer', sample: "'12345'" },
      { kind: 'decimal', sample: "'123.456'" },
      { kind: 'negative', sample: "'-9876'" },
      { kind: 'padded', sample: "'  42  '" },
      { kind: 'exponent', sample: "'1.5e3'" },
      { kind: 'hexadecimal', sample: "'0xFF'" }
    ],
    setup: (p) => [
      `var input = ${p.sample};`,
      'var out;'
    ],
    tests: () => [
      {
        title: 'Number()',
        code: ['out = Number(input);']
      },
      {
        title: 'parseFloat',
        code: ['out = parseFloat(input);']
      },
      {
        title: 'parseInt radix 10',
        code: ['out = parseInt(input, 10);']
      },
      {
        title: 'unary plus',
        code: ['out = +input;']
      },
      {
        title: 'multiply by one',
        code: ['out = input * 1;']
      },
      {
        title: 'bitwise or zero',
        code: ['out = input | 0;']
      }
    ]
  },
  {
    key: 'array-copy',
    title: (p) => `Copying an array of ${p.n} items`,
    info: (p) => `Ways of producing a shallow copy of an array with ${p.n} elements.`,
    variants: sizes.map((n) => ({ n })),
    setup: (p) => [
      `var source = new Array(${p.n});`,
      'for (var i = 0; i < source.length; i++) {',
      '  source[i] = i;',
      '}',
      'var copy;'
    ],
    tests: () => [
      {
        title: 'slice',
        code: ['copy = source.slice();']
      },
      {
        title: 'spread',
        code: ['copy = [...source];']
      },
      {
        title: 'Array.from',
        code: ['copy = Array.from(source);']
      },
      {
        title: 'concat',
        code: ['copy = [].concat(source);']
      },
      {
        title: 'manual loop',
        code: [
          'copy = new Array(source.length);',
          'for (var i = 0; i < source.length; i++) {',
          '  copy[i] = source[i];',
          '}'
        ]
      },
      {
        title: 'map identity',
        code: [
          'copy = source.map(function (value) {',
          '  return value;',
          '});'
        ]
      }
    ]
  },
  {
    key: 'array-sort',
    title: (p) => `Sorting ${p.n} ${p.order} numbers`,
    info: (p) => `Sorting ${p.n} numbers that start out ${p.order}.`,
    variants: [100, 1000, 10000].reduce((all, n) => all.concat(['random', 'ascending', 'descending'].map((order) => ({ n, order }))), []),
    setup: (p) => [
      `var size = ${p.n};`,
      'var base = [];',
      'for (var i = 0; i < size; i++) {',
      `  base.push(${{ random: 'Math.floor(Math.random() * size)', ascending: 'i', descending: 'size - i' }[p.order]});`,
      '}',
      'var work;'
    ],
    tests: () => [
      {
        title: 'sort with comparator',
        code: [
          'work = base.slice();',
          'work.sort(function (a, b) {',
          '  return a - b;',
          '});'
        ]
      },
      {
        title: 'sort with arrow comparator',
        code: [
          'work = base.slice();',
          'work.sort((a, b) => a - b);'
        ]
      },
      {
        title: 'typed array sort',
        code: [
          'work = Float64Array.from(base);',
          'work.sort();'
        ]
      },
      {
        title: 'insertion sort',
        code: [
          'work = base.slice();',
          'for (var i = 1; i < work.length; i++) {',
          '  var current = work[i];',
          '  var j = i - 1;',
          '  while (j >= 0 && work[j] > current) {',
          '    work[j + 1] = work[j];',
          '    j--;',
          '  }',
          '  work[j + 1] = current;',
          '}'
        ]
      }
    ]
  },
  {
    key: 'map-vs-object',
    title: (p) => `Map vs object as a dictionary with ${p.n} entries`,
    info: (p) => `Reads, writes and deletes against a dictionary holding ${p.n} entries.`,
    variants: sizes.slice(0, 5).map((n) => ({ n })),
    setup: (p) => [
      `var n = ${p.n};`,
      'var map = new Map();',
      'var obj = {};',
      'for (var i = 0; i < n; i++) {',
      "  map.set('k' + i, i);",
      "  obj['k' + i] = i;",
      '}',
      'var hit;'
    ],
    tests: () => [
      {
        title: 'Map#get',
        code: [
          'for (var i = 0; i < n; i++) {',
          "  hit = map.get('k' + i);",
          '}'
        ]
      },
      {
        title: 'object property read',
        code: [
          'for (var i = 0; i < n; i++) {',
          "  hit = obj['k' + i];",
          '}'
        ]
      },
      {
        title: 'Map#has',
        code: [
          'for (var i = 0; i < n; i++) {',
          "  hit = map.has('k' + i);",
          '}'
        ]
      },
      {
        title: 'in operator',
        code: [
          'for (var i = 0; i < n; i++) {',
          "  hit = ('k' + i) in obj;",
          '}'
        ]
      }
    ]
  },
  {
    key: 'regex-vs-string',
    title: (p) => `Testing for "${p.needle}" in a ${p.len} character string`,
    info: (p) => `Substring detection for the needle "${p.needle}" in text of ${p.len} characters.`,
    variants: [
      { needle: 'fox', len: 50 },
      { needle: 'fox', len: 500 },
      { needle: 'fox', len: 5000 },
      { needle: 'zebra', len: 50 },
      { needle: 'zebra', len: 500 },
      { needle: 'zebra', len: 5000 }
    ],
    setup: (p) => [
      "var sentence = 'the quick brown fox jumps over the lazy dog ';",
      `var text = sentence.repeat(Math.ceil(${p.len} / sentence.length)).slice(0, ${p.len});`,
      `var needle = '${p.needle}';`,
      'var pattern = new RegExp(needle);',
      'var result;'
    ],
    tests: () => [
      {
        title: 'indexOf',
        code: ['result = text.indexOf(needle) > -1;']
      },
      {
        title: 'includes',
        code: ['result = text.includes(needle);']
      },
      {
        title: 'RegExp#test',
        code: ['result = pattern.test(text);']
      },
      {
        title: 'String#match',
        code: ['result = text.match(pattern) !== null;']
      },
      {
        title: 'String#search',
        code: ['result = text.search(pattern) !== -1;']
      }
    ]
  },
  {
    key: 'dom-build',
    title: (p) => `Building a list of ${p.n} DOM nodes`,
    info: (p) => `Creates ${p.n} list items using different DOM construction techniques.`,
    variants: [10, 100, 1000, 5000].map((n) => ({ n })),
    html: '<div id="host"></div>',
    setup: (p) => [
      `var count = ${p.n};`,
      "var host = document.getElementById('host');"
    ],
    teardown: () => [
      "host.innerHTML = '';"
    ],
    tests: () => [
      {
        title: 'innerHTML string',
        code: [
          "var html = '<ul>';",
          'for (var i = 0; i < count; i++) {',
          "  html += '<li>' + i + '</li>';",
          '}',
          "html += '</ul>';",
          'host.innerHTML = html;'
        ]
      },
      {
        title: 'createElement and appendChild',
        code: [
          "var list = document.createElement('ul');",
          'for (var i = 0; i < count; i++) {',
          "  var item = document.createElement('li');",
          '  item.textContent = i;',
          '  list.appendChild(item);',
          '}',
          'host.appendChild(list);'
        ]
      },
      {
        title: 'DocumentFragment',
        code: [
          'var fragment = document.createDocumentFragment();',
          'for (var i = 0; i < count; i++) {',
          "  var item = document.createElement('li');",
          '  item.textContent = i;',
          '  fragment.appendChild(item);',
          '}',
          "var list = document.createElement('ul');",
          'list.appendChild(fragment);',
          'host.appendChild(list);'
        ]
      },
      {
        title: 'insertAdjacentHTML',
        code: [
          "var markup = '';",
          'for (var i = 0; i < count; i++) {',
          "  markup += '<li>' + i + '</li>';",
          '}',
          "host.insertAdjacentHTML('beforeend', '<ul>' + markup + '</ul>');"
        ]
      }
    ]
  },
  {
    key: 'closure-vs-class',
    title: (p) => `Calling ${p.n} counters built with ${p.style}`,
    info: (p) => `Measures ${p.n} increments on counters created through ${p.style}.`,
    variants: [1000, 100000].reduce((all, n) => all.concat(['closures', 'prototypes', 'classes'].map((style) => ({ n, style }))), []),
    setup: (p) => [
      `var n = ${p.n};`,
      'function makeClosureCounter() {',
      '  var value = 0;',
      '  return {',
      '    inc: function () { value++; },',
      '    get: function () { return value; }',
      '  };',
      '}',
      'function ProtoCounter() {',
      '  this.value = 0;',
      '}',
      'ProtoCounter.prototype.inc = function () { this.value++; };',
      'ProtoCounter.prototype.get = function () { return this.value; };',
      'class ClassCounter {',
      '  constructor() { this.value = 0; }',
      '  inc() { this.value++; }',
      '  get() { return this.value; }',
      '}'
    ],
    tests: () => [
      {
        title: 'closure counter',
        code: [
          'var counter = makeClosureCounter();',
          'for (var i = 0; i < n; i++) {',
          '  counter.inc();',
          '}',
          'counter.get();'
        ]
      },
      {
        title: 'prototype counter',
        code: [
          'var counter = new ProtoCounter();',
          'for (var i = 0; i < n; i++) {',
          '  counter.inc();',
          '}',
          'counter.get();'
        ]
      },
      {
        title: 'class counter',
        code: [
          'var counter = new ClassCounter();',
          'for (var i = 0; i < n; i++) {',
          '  counter.inc();',
          '}',
          'counter.get();'
        ]
      }
    ]
  },
  {
    key: 'json-clone',
    title: (p) => `Deep cloning an object with ${p.depth} levels`,
    info: (p) => `Different deep clone techniques on a nested structure ${p.depth} levels deep.`,
    variants: [2, 4, 8, 16].map((depth) => ({ depth })),
    setup: (p) => [
      `var depth = ${p.depth};`,
      'function build(level) {',
      '  if (level === 0) {',
      "    return { leaf: true, values: [1, 2, 3], label: 'end' };",
      '  }',
      '  return { level: level, left: build(level - 1), tags: ["a", "b"] };',
      '}',
      'var original = build(depth);',
      'var clone;',
      'function manualClone(value) {',
      "  if (value === null || typeof value !== 'object') {",
      '    return value;',
      '  }',
      '  if (Array.isArray(value)) {',
      '    return value.map(manualClone);',
      '  }',
      '  var out = {};',
      '  Object.keys(value).forEach(function (key) {',
      '    out[key] = manualClone(value[key]);',
      '  });',
      '  return out;',
      '}'
    ],
    tests: () => [
      {
        title: 'JSON round trip',
        code: ['clone = JSON.parse(JSON.stringify(original));']
      },
      {
        title: 'recursive clone',
        code: ['clone = manualClone(original);']
      },
      {
        title: 'Object.assign (shallow baseline)',
        code: ['clone = Object.assign({}, original);']
      }
    ]
  },
  {
    key: 'math-ops',
    title: (p) => `Rounding with ${p.label}`,
    info: (p) => `Ways to truncate or round ${p.label}.`,
    variants: [
      { label: 'positive floats', sample: '12345.6789' },
      { label: 'negative floats', sample: '-12345.6789' },
      { label: 'small floats', sample: '0.000123' },
      { label: 'large floats', sample: '98765432.1' }
    ],
    setup: (p) => [
      `var x = ${p.sample};`,
      'var r;'
    ],
    tests: () => [
      { title: 'Math.floor', code: ['r = Math.floor(x);'] },
      { title: 'Math.round', code: ['r = Math.round(x);'] },
      { title: 'Math.trunc', code: ['r = Math.trunc(x);'] },
      { title: 'bitwise or', code: ['r = x | 0;'] },
      { title: 'double bitwise not', code: ['r = ~~x;'] },
      { title: 'toFixed', code: ['r = Number(x.toFixed(0));'] }
    ]
  },
  {
    key: 'function-calls',
    title: (p) => `Invoking a function ${p.n} times via different call forms`,
    info: (p) => `Direct call, call, apply and bind compared over ${p.n} invocations.`,
    variants: [1000, 100000, 1000000].map((n) => ({ n })),
    setup: (p) => [
      `var n = ${p.n};`,
      'function add(a, b) {',
      '  return a + b;',
      '}',
      'var bound = add.bind(null, 1);',
      'var total;'
    ],
    tests: () => [
      {
        title: 'direct call',
        code: [
          'total = 0;',
          'for (var i = 0; i < n; i++) {',
          '  total += add(i, 1);',
          '}'
        ]
      },
      {
        title: 'Function#call',
        code: [
          'total = 0;',
          'for (var i = 0; i < n; i++) {',
          '  total += add.call(null, i, 1);',
          '}'
        ]
      },
      {
        title: 'Function#apply',
        code: [
          'total = 0;',
          'for (var i = 0; i < n; i++) {',
          '  total += add.apply(null, [i, 1]);',
          '}'
        ]
      },
      {
        title: 'bound function',
        code: [
          'total = 0;',
          'for (var i = 0; i < n; i++) {',
          '  total += bound(i);',
          '}'
        ]
      },
      {
        title: 'arrow function',
        code: [
          'var arrow = (a, b) => a + b;',
          'total = 0;',
          'for (var i = 0; i < n; i++) {',
          '  total += arrow(i, 1);',
          '}'
        ]
      }
    ]
  },
  {
    key: 'array-merge',
    title: (p) => `Merging two arrays of ${p.n} items`,
    info: (p) => `Concatenating two arrays that each hold ${p.n} items.`,
    variants: [10, 1000, 100000].map((n) => ({ n })),
    setup: (p) => [
      `var n = ${p.n};`,
      'var a = [];',
      'var b = [];',
      'for (var i = 0; i < n; i++) {',
      '  a.push(i);',
      '  b.push(i + n);',
      '}',
      'var merged;'
    ],
    tests: () => [
      { title: 'concat', code: ['merged = a.concat(b);'] },
      { title: 'spread', code: ['merged = [...a, ...b];'] },
      {
        title: 'push loop',
        code: [
          'merged = a.slice();',
          'for (var i = 0; i < b.length; i++) {',
          '  merged.push(b[i]);',
          '}'
        ]
      },
      {
        title: 'push apply',
        code: [
          'merged = a.slice();',
          'Array.prototype.push.apply(merged, b);'
        ]
      }
    ]
  },
  {
    key: 'string-case',
    title: (p) => `Normalising ${p.len} character strings`,
    info: (p) => `Case conversion and trimming of strings that are ${p.len} characters long.`,
    variants: [16, 256, 4096].map((len) => ({ len })),
    setup: (p) => [
      `var len = ${p.len};`,
      "var raw = '  ' + 'MiXeD CaSe '.repeat(Math.ceil(len / 11)).slice(0, len) + '  ';",
      'var out;'
    ],
    tests: () => [
      { title: 'toLowerCase', code: ['out = raw.toLowerCase();'] },
      { title: 'toUpperCase', code: ['out = raw.toUpperCase();'] },
      { title: 'trim', code: ['out = raw.trim();'] },
      { title: 'trim then lower', code: ['out = raw.trim().toLowerCase();'] },
      { title: 'replace with regex', code: ["out = raw.replace(/^\\s+|\\s+$/g, '');"] }
    ]
  },
  {
    key: 'typed-arrays',
    title: (p) => `Filling ${p.n} numbers with ${p.kind}`,
    info: (p) => `Writes ${p.n} values into a ${p.kind}.`,
    variants: [1000, 100000, 1000000].reduce((all, n) => all.concat(['Array', 'Float64Array', 'Int32Array', 'Uint8Array'].map((kind) => ({ n, kind }))), []),
    setup: (p) => [
      `var n = ${p.n};`,
      `var Kind = ${p.kind};`
    ],
    tests: () => [
      {
        title: 'preallocated',
        code: [
          'var buf = new Kind(n);',
          'for (var i = 0; i < n; i++) {',
          '  buf[i] = i & 255;',
          '}'
        ]
      },
      {
        title: 'Kind.from with map',
        code: [
          'var buf = Kind.from({ length: n }, function (_, i) {',
          '  return i & 255;',
          '});'
        ]
      },
      {
        title: 'fill',
        code: [
          'var buf = new Kind(n);',
          'buf.fill(7);'
        ]
      }
    ]
  },
  {
    key: 'promise-chains',
    title: (p) => `Resolving ${p.n} promises ${p.mode}`,
    info: (p) => `Scheduling ${p.n} resolved promises ${p.mode}.`,
    variants: [10, 100, 1000].reduce((all, n) => all.concat(['sequentially', 'in parallel'].map((mode) => ({ n, mode }))), []),
    setup: (p) => [
      `var n = ${p.n};`,
      'function work(i) {',
      '  return Promise.resolve(i);',
      '}'
    ],
    tests: () => [
      {
        title: 'Promise.all',
        defer: 'y',
        code: [
          'var jobs = [];',
          'for (var i = 0; i < n; i++) {',
          '  jobs.push(work(i));',
          '}',
          'Promise.all(jobs).then(function () {',
          '  deferred.resolve();',
          '});'
        ]
      },
      {
        title: 'reduce chain',
        defer: 'y',
        code: [
          'var chain = Promise.resolve();',
          'for (var i = 0; i < n; i++) {',
          '  chain = chain.then(work.bind(null, i));',
          '}',
          'chain.then(function () {',
          '  deferred.resolve();',
          '});'
        ]
      }
    ]
  },
  {
    key: 'destructuring',
    title: (p) => `Reading ${p.fields} fields from an object`,
    info: (p) => `Destructuring versus direct property access for ${p.fields} fields.`,
    variants: [2, 4, 8, 16].map((fields) => ({ fields })),
    setup: (p) => {
      const lines = ['var source = {'];
      for (let i = 0; i < p.fields; i++) {
        lines.push(`  f${i}: ${i}${i < p.fields - 1 ? ',' : ''}`);
      }
      lines.push('};');
      return lines;
    },
    tests: (p) => {
      const names = Array.from({ length: p.fields }, (_, i) => `f${i}`);
      return [
        {
          title: 'destructuring',
          code: [`var { ${names.join(', ')} } = source;`]
        },
        {
          title: 'property access',
          code: names.map((name) => `var ${name} = source.${name};`)
        },
        {
          title: 'bracket access',
          code: names.map((name) => `var ${name} = source['${name}'];`)
        }
      ];
    }
  },
  {
    key: 'set-operations',
    title: (p) => `Removing duplicates from ${p.n} numbers (${p.dupes}% repeats)`,
    info: (p) => `Deduplicating an array of ${p.n} numbers where about ${p.dupes}% repeat.`,
    variants: [100, 10000, 100000].reduce((all, n) => all.concat([10, 90].map((dupes) => ({ n, dupes }))), []),
    setup: (p) => [
      `var n = ${p.n};`,
      `var range = Math.max(1, Math.floor(n * ${(100 - p.dupes) / 100}));`,
      'var input = [];',
      'for (var i = 0; i < n; i++) {',
      '  input.push(Math.floor(Math.random() * range));',
      '}',
      'var unique;'
    ],
    tests: () => [
      { title: 'Set spread', code: ['unique = [...new Set(input)];'] },
      { title: 'Array.from Set', code: ['unique = Array.from(new Set(input));'] },
      {
        title: 'filter indexOf',
        code: [
          'unique = input.filter(function (value, index) {',
          '  return input.indexOf(value) === index;',
          '});'
        ]
      },
      {
        title: 'object lookup',
        code: [
          'var seen = {};',
          'unique = [];',
          'for (var i = 0; i < input.length; i++) {',
          '  if (!seen[input[i]]) {',
          '    seen[input[i]] = true;',
          '    unique.push(input[i]);',
          '  }',
          '}'
        ]
      }
    ]
  },
  {
    key: 'chained-array-methods',
    title: (p) => `Filter, map and sum over ${p.n} items`,
    info: (p) => `A filter/map/reduce pipeline over ${p.n} numbers compared with hand written loops.`,
    variants: sizes.map((n) => ({ n })),
    setup: (p) => [
      `var n = ${p.n};`,
      'var numbers = [];',
      'for (var i = 0; i < n; i++) {',
      '  numbers.push(i);',
      '}',
      'var answer;'
    ],
    tests: () => [
      {
        title: 'chained methods',
        code: [
          'answer = numbers',
          '  .filter(function (x) { return x % 2 === 0; })',
          '  .map(function (x) { return x * 3; })',
          '  .reduce(function (acc, x) { return acc + x; }, 0);'
        ]
      },
      {
        title: 'chained arrow functions',
        code: [
          'answer = numbers',
          '  .filter((x) => x % 2 === 0)',
          '  .map((x) => x * 3)',
          '  .reduce((acc, x) => acc + x, 0);'
        ]
      },
      {
        title: 'single reduce',
        code: [
          'answer = numbers.reduce(function (acc, x) {',
          '  return x % 2 === 0 ? acc + x * 3 : acc;',
          '}, 0);'
        ]
      },
      {
        title: 'single loop',
        code: [
          'answer = 0;',
          'for (var i = 0; i < numbers.length; i++) {',
          '  if (numbers[i] % 2 === 0) {',
          '    answer += numbers[i] * 3;',
          '  }',
          '}'
        ]
      }
    ]
  },
  {
    key: 'string-split',
    title: (p) => `Splitting a ${p.n} field CSV line`,
    info: (p) => `Parsing a comma separated line with ${p.n} fields.`,
    variants: sizes.slice(0, 5).map((n) => ({ n })),
    setup: (p) => [
      `var fields = ${p.n};`,
      'var parts = [];',
      'for (var i = 0; i < fields; i++) {',
      "  parts.push('value' + i);",
      '}',
      "var line = parts.join(',');",
      'var result;'
    ],
    tests: () => [
      { title: 'split', code: ["result = line.split(',');"] },
      {
        title: 'regex split',
        code: ['result = line.split(/,/);']
      },
      {
        title: 'indexOf scanning',
        code: [
          'result = [];',
          'var start = 0;',
          'var end;',
          "while ((end = line.indexOf(',', start)) !== -1) {",
          '  result.push(line.slice(start, end));',
          '  start = end + 1;',
          '}',
          'result.push(line.slice(start));'
        ]
      },
      {
        title: 'match',
        code: ['result = line.match(/[^,]+/g);']
      },
      {
        title: 'replace callback',
        code: [
          'result = [];',
          'line.replace(/[^,]+/g, function (field) {',
          '  result.push(field);',
          '});'
        ]
      }
    ]
  },
  {
    key: 'power-of-two',
    title: (p) => `Checking ${p.kind} integers for ${p.check}`,
    info: (p) => `Predicates that test ${p.kind} integers for ${p.check}.`,
    variants: [
      { kind: 'small', check: 'evenness', limit: 100 },
      { kind: 'large', check: 'evenness', limit: 1000000 },
      { kind: 'small', check: 'oddness', limit: 100 },
      { kind: 'large', check: 'oddness', limit: 1000000 },
      { kind: 'small', check: 'divisibility by three', limit: 100 },
      { kind: 'large', check: 'divisibility by three', limit: 1000000 }
    ],
    setup: (p) => [
      `var limit = ${p.limit};`,
      'var hits;'
    ],
    tests: (p) => {
      const expr = {
        evenness: ['i % 2 === 0', '(i & 1) === 0', '!(i % 2)', 'i / 2 === Math.floor(i / 2)'],
        oddness: ['i % 2 === 1', '(i & 1) === 1', '!!(i % 2)', 'i / 2 !== Math.floor(i / 2)'],
        'divisibility by three': ['i % 3 === 0', '!(i % 3)', 'i / 3 === Math.floor(i / 3)', 'Number.isInteger(i / 3)']
      }[p.check];
      const names = ['modulo', 'bitwise or negation', 'logical not', 'division'];
      return expr.map((e, idx) => ({
        title: names[idx],
        code: [
          'hits = 0;',
          'for (var i = 0; i < limit; i++) {',
          `  if (${e}) {`,
          '    hits++;',
          '  }',
          '}'
        ]
      }));
    }
  },
  {
    key: 'array-fill-methods',
    title: (p) => `Creating an array of ${p.n} zeros`,
    info: (p) => `Allocation strategies for an array of ${p.n} zeros.`,
    variants: sizes.map((n) => ({ n })),
    setup: (p) => [
      `var n = ${p.n};`,
      'var zeros;'
    ],
    tests: () => [
      { title: 'new Array fill', code: ['zeros = new Array(n).fill(0);'] },
      { title: 'Array.from', code: ['zeros = Array.from({ length: n }, function () { return 0; });'] },
      {
        title: 'push loop',
        code: [
          'zeros = [];',
          'for (var i = 0; i < n; i++) {',
          '  zeros.push(0);',
          '}'
        ]
      },
      {
        title: 'indexed loop',
        code: [
          'zeros = new Array(n);',
          'for (var i = 0; i < n; i++) {',
          '  zeros[i] = 0;',
          '}'
        ]
      },
      {
        title: 'spread keys',
        code: ['zeros = [...Array(n).keys()].map(function () { return 0; });']
      },
      { title: 'Float64Array', code: ['zeros = new Float64Array(n);'] }
    ]
  },
  {
    key: 'event-dispatch',
    title: (p) => `Dispatching ${p.n} events to ${p.listeners} listeners`,
    info: (p) => `Emitting ${p.n} events to ${p.listeners} registered handlers.`,
    variants: [100, 10000].reduce((all, n) => all.concat([1, 5, 25].map((listeners) => ({ n, listeners }))), []),
    setup: (p) => [
      `var n = ${p.n};`,
      `var listenerCount = ${p.listeners};`,
      'var handlers = [];',
      'var seen = 0;',
      'for (var i = 0; i < listenerCount; i++) {',
      '  handlers.push(function (payload) { seen += payload; });',
      '}',
      'var target = new EventTarget();',
      'handlers.forEach(function (h) {',
      "  target.addEventListener('tick', function (event) { h(event.detail); });",
      '});'
    ],
    tests: () => [
      {
        title: 'array of callbacks',
        code: [
          'for (var i = 0; i < n; i++) {',
          '  for (var j = 0; j < handlers.length; j++) {',
          '    handlers[j](1);',
          '  }',
          '}'
        ]
      },
      {
        title: 'forEach callbacks',
        code: [
          'for (var i = 0; i < n; i++) {',
          '  handlers.forEach(function (h) { h(1); });',
          '}'
        ]
      },
      {
        title: 'EventTarget',
        code: [
          'for (var i = 0; i < n; i++) {',
          "  target.dispatchEvent(new CustomEvent('tick', { detail: 1 }));",
          '}'
        ]
      }
    ]
  },
  {
    key: 'array-reverse',
    title: (p) => `Reversing an array of ${p.n} items`,
    info: (p) => `Reversing ${p.n} elements in place and into a new array.`,
    variants: sizes.map((n) => ({ n })),
    setup: (p) => [
      `var n = ${p.n};`,
      'var base = [];',
      'for (var i = 0; i < n; i++) {',
      '  base.push(i);',
      '}',
      'var work;'
    ],
    tests: () => [
      {
        title: 'Array#reverse',
        code: [
          'work = base.slice();',
          'work.reverse();'
        ]
      },
      {
        title: 'swap loop',
        code: [
          'work = base.slice();',
          'for (var lo = 0, hi = work.length - 1; lo < hi; lo++, hi--) {',
          '  var tmp = work[lo];',
          '  work[lo] = work[hi];',
          '  work[hi] = tmp;',
          '}'
        ]
      },
      {
        title: 'reverse fill',
        code: [
          'work = new Array(base.length);',
          'for (var i = 0, j = base.length - 1; j >= 0; i++, j--) {',
          '  work[i] = base[j];',
          '}'
        ]
      },
      {
        title: 'reduceRight',
        code: [
          'work = base.reduceRight(function (acc, value) {',
          '  acc.push(value);',
          '  return acc;',
          '}, []);'
        ]
      },
      {
        title: 'unshift loop',
        code: [
          'work = [];',
          'for (var i = 0; i < base.length; i++) {',
          '  work.unshift(base[i]);',
          '}'
        ]
      }
    ]
  },
  {
    key: 'array-flatten',
    title: (p) => `Flattening ${p.rows} rows of ${p.cols} items`,
    info: (p) => `Flattening a nested array of ${p.rows} rows with ${p.cols} items each.`,
    variants: [[10, 10], [100, 10], [10, 100], [100, 100], [1000, 10], [10, 1000], [1000, 100], [100, 1000]].map((d) => ({ rows: d[0], cols: d[1] })),
    setup: (p) => [
      `var rows = ${p.rows};`,
      `var cols = ${p.cols};`,
      'var nested = [];',
      'for (var r = 0; r < rows; r++) {',
      '  var row = [];',
      '  for (var c = 0; c < cols; c++) {',
      '    row.push(r * cols + c);',
      '  }',
      '  nested.push(row);',
      '}',
      'var flat;'
    ],
    tests: () => [
      { title: 'Array#flat', code: ['flat = nested.flat();'] },
      { title: 'concat apply', code: ['flat = [].concat.apply([], nested);'] },
      { title: 'spread concat', code: ['flat = [].concat(...nested);'] },
      {
        title: 'reduce concat',
        code: [
          'flat = nested.reduce(function (acc, row) {',
          '  return acc.concat(row);',
          '}, []);'
        ]
      },
      {
        title: 'nested loops',
        code: [
          'flat = [];',
          'for (var r = 0; r < nested.length; r++) {',
          '  for (var c = 0; c < nested[r].length; c++) {',
          '    flat.push(nested[r][c]);',
          '  }',
          '}'
        ]
      }
    ]
  },
  {
    key: 'string-padding',
    title: (p) => `Padding numbers to ${p.width} digits`,
    info: (p) => `Left padding integers with zeros up to a width of ${p.width}.`,
    variants: [2, 4, 8, 16, 32].map((width) => ({ width })),
    setup: (p) => [
      `var width = ${p.width};`,
      'var value = 42;',
      'var out;'
    ],
    tests: () => [
      { title: 'padStart', code: ["out = String(value).padStart(width, '0');"] },
      {
        title: 'repeat and slice',
        code: [
          "out = ('0'.repeat(width) + value).slice(-width);"
        ]
      },
      {
        title: 'while loop',
        code: [
          'out = String(value);',
          'while (out.length < width) {',
          "  out = '0' + out;",
          '}'
        ]
      },
      {
        title: 'array join',
        code: [
          'var text = String(value);',
          "out = new Array(Math.max(0, width - text.length) + 1).join('0') + text;"
        ]
      },
      {
        title: 'toLocaleString',
        code: [
          "out = value.toLocaleString('en-US', { minimumIntegerDigits: width, useGrouping: false });"
        ]
      }
    ]
  },
  {
    key: 'optional-access',
    title: (p) => `Reading a ${p.depth} level deep property that is ${p.state}`,
    info: (p) => `Safe property access on a path ${p.depth} levels deep when the value is ${p.state}.`,
    variants: [2, 4, 6].reduce((all, depth) => all.concat(['present', 'missing'].map((state) => ({ depth, state }))), []),
    setup: (p) => {
      const lines = ['var root = {};', 'var node = root;'];
      for (let i = 0; i < p.depth - 1; i++) {
        lines.push(`node.p${i} = {};`, `node = node.p${i};`);
      }
      if (p.state === 'present') {
        lines.push(`node.p${p.depth - 1} = 'found';`);
      }
      lines.push('var result;');
      return lines;
    },
    tests: (p) => {
      const names = Array.from({ length: p.depth }, (_, i) => `p${i}`);
      return [
        {
          title: 'optional chaining',
          code: [`result = root?.${names.join('?.')};`]
        },
        {
          title: 'logical and chain',
          code: [`result = root && ${names.map((n, i) => 'root.' + names.slice(0, i + 1).join('.')).join(' && ')};`]
        },
        {
          title: 'try catch',
          code: [
            'try {',
            `  result = root.${names.join('.')};`,
            '} catch (e) {',
            '  result = undefined;',
            '}'
          ]
        },
        {
          title: 'reduce path',
          code: [
            `var path = ${JSON.stringify(names).replace(/"/g, "'")};`,
            'result = path.reduce(function (acc, key) {',
            '  return acc == null ? undefined : acc[key];',
            '}, root);'
          ]
        }
      ];
    }
  },
  {
    key: 'number-to-string',
    title: (p) => `Converting ${p.kind} numbers to strings`,
    info: (p) => `Turning ${p.kind} numbers into their string form.`,
    variants: [
      { kind: 'small integer', sample: '7' },
      { kind: 'large integer', sample: '9007199254740991' },
      { kind: 'fractional', sample: '3.14159' },
      { kind: 'negative', sample: '-273.15' },
      { kind: 'tiny', sample: '1e-7' },
      { kind: 'huge', sample: '1e21' }
    ],
    setup: (p) => [
      `var num = ${p.sample};`,
      'var text;'
    ],
    tests: () => [
      { title: 'String()', code: ['text = String(num);'] },
      { title: 'toString', code: ['text = num.toString();'] },
      { title: 'empty string concat', code: ["text = '' + num;"] },
      { title: 'template literal', code: ['text = `' + '$' + '{num}`;'] },
      { title: 'toString radix 10', code: ['text = num.toString(10);'] }
    ]
  },
  {
    key: 'date-formatting',
    title: (p) => `Formatting dates as ${p.format}`,
    info: (p) => `Producing ${p.format} output from a Date.`,
    variants: [
      { format: 'ISO 8601', expr: ['out = stamp.toISOString();'] },
      { format: 'YYYY-MM-DD', expr: ['out = stamp.toISOString().slice(0, 10);'] },
      { format: 'locale strings', expr: ["out = stamp.toLocaleDateString('en-US');"] },
      { format: 'UTC strings', expr: ['out = stamp.toUTCString();'] },
      { format: 'epoch milliseconds', expr: ['out = String(stamp.getTime());'] }
    ],
    setup: () => [
      'var stamp = new Date(Date.UTC(2020, 5, 15, 12, 30, 45));',
      'var out;'
    ],
    tests: (p) => [
      { title: p.format, code: p.expr },
      {
        title: 'manual padding',
        code: [
          'function pad(v) {',
          "  return v < 10 ? '0' + v : String(v);",
          '}',
          "out = stamp.getUTCFullYear() + '-' + pad(stamp.getUTCMonth() + 1) + '-' + pad(stamp.getUTCDate());"
        ]
      },
      { title: 'JSON.stringify', code: ['out = JSON.stringify(stamp);'] }
    ]
  }
];

const quote = (s) => "'" + s.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";

const block = (lines, indent) => {
  if (!lines || lines.length === 0) {
    return quote('');
  }
  const pad = ' '.repeat(indent);
  return '[\n' + lines.map((l) => `${pad}  ${quote(l)}`).join(',\n') + `\n${pad}].join('\\n')`;
};

const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

fs.mkdirSync(outDir, { recursive: true });
fs.readdirSync(outDir).forEach((f) => fs.unlinkSync(path.join(outDir, f)));

const files = [];

families.forEach((family) => {
  family.variants.forEach((variant) => {
    const title = family.title(variant);
    const slug = ('testuser-' + slugify(title)).slice(0, 55).replace(/-+$/, '');
    const tests = family.tests(variant);

    const out = [];
    out.push("'use strict';");
    out.push('');
    out.push('/* eslint no-template-curly-in-string: 0 */');
    out.push('module.exports = {');
    out.push(`  slug: ${quote(slug)},`);
    out.push(`  title: ${quote(title)},`);
    out.push(`  info: ${quote(family.info(variant))},`);
    out.push(`  initHTML: ${quote(family.html || '')},`);
    out.push(`  setup: ${block(family.setup(variant), 2)},`);
    out.push(`  teardown: ${block(family.teardown ? family.teardown(variant) : [], 2)},`);
    out.push('  test: [');
    tests.forEach((t, i) => {
      out.push('    {');
      out.push(`      title: ${quote(t.title)},`);
      out.push(`      defer: ${quote(t.defer || 'n')},`);
      out.push(`      code: ${block(t.code, 6)}`);
      out.push('    }' + (i < tests.length - 1 ? ',' : ''));
    });
    out.push('  ]');
    out.push('};');

    const file = `${slug}.js`;
    if (files.indexOf(file) !== -1) {
      throw new Error('duplicate slug ' + slug);
    }
    files.push(file);
    fs.writeFileSync(path.join(outDir, file), out.join('\n') + '\n');
  });
});

fs.writeFileSync(path.join(outDir, 'index.js'), [
  "'use strict';",
  '',
  '// Generated by tools/generate-testuser-seeds.js; do not edit by hand.',
  'module.exports = [',
  files.map((f) => `  require('./${f}')`).join(',\n'),
  '];',
  ''
].join('\n'));

console.log('wrote ' + files.length + ' pages');
