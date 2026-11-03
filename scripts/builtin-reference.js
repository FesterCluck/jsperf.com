'use strict';

// Maintains and checks server/lib/builtinTable.js against its references. Nothing here runs in the app.
//
//   node scripts/builtin-reference.js generate <ecma262-checkout>
//       rewrites test/fixtures/spec-sections.json (the ids of the spec's built-in function clauses, read from the
//       spec.html of a checkout of github.com/tc39/ecma262) and test/fixtures/builtin-names.json (those plus every
//       function and accessor of the running engine, which is what the unit tests require the table to cover)
//
//   node scripts/builtin-reference.js verify <v8-checkout>
//       checks that every V8 reference of the table (file#symbol) exists in a checkout of github.com/v8/v8 (the table
//       was written against tag 12.4.254.21, the V8 of Node 22 LTS), and prints where each row's class comes from

const fs = require('fs');
const path = require('path');
const table = require('../server/lib/builtinTable');

const fixtures = path.join(__dirname, '..', 'test', 'fixtures');

// the ids the spec may give the clause a row is named after: `sec-array.prototype.sort`, `sec-get-map.prototype.size`,
// `sec-array.prototype-@@iterator`, `sec-date-constructor`
const specSections = (row) => {
  const key = row.key.replace(/^new /, '').toLowerCase();
  const symbolic = key.replace(/\.@@/, '-@@');
  if (row.kind === 'ctor') {
    return [`sec-${key}-constructor`, `sec-${key}-constructors`, 'sec-nativeerror-constructors', 'sec-typedarray-constructors'];
  }

  const wellKnown = key.replace(/\.@@(\w+)/, '-%symbol.$1%');
  return [`sec-${key}`, `sec-get-${key}`, `sec-${symbolic}`, `sec-get-${symbolic}`, `sec-${wellKnown}`, `sec-get-${wellKnown}`];
};

// does the spec have a clause for the row? (a global function's id ends with its parameter names: `sec-parseint-string-radix`)
const hasSection = (row, sections) => specSections(row).some((id) => sections.has(id)) ||
  (row.kind === 'global' && [...sections].some((id) => id.startsWith(`sec-${row.key.toLowerCase()}-`)));
exports.hasSection = hasSection;

const OWNERS = ['Object', 'Function', 'Boolean', 'Symbol', 'Error', 'Number', 'BigInt', 'Math', 'Date', 'String', 'RegExp', 'Array',
  'Map', 'Set', 'WeakMap', 'WeakSet', 'WeakRef', 'FinalizationRegistry', 'ArrayBuffer', 'SharedArrayBuffer', 'DataView', 'Atomics', 'JSON',
  'Promise', 'Reflect', 'Proxy', 'Iterator', ...table.TA];
const GLOBALS = ['eval', 'isFinite', 'isNaN', 'parseFloat', 'parseInt', 'decodeURI', 'decodeURIComponent', 'encodeURI', 'encodeURIComponent', 'escape', 'unescape'];
const SKIP = new Set(['length', 'name', 'prototype', 'caller', 'callee', 'arguments', 'constructor']);

// every clause of the spec that defines a function or accessor, as `{ id, head }`
const specClauses = (html) => {
  const found = [];
  const clause = /<emu-(?:clause|annex)\b[^>]*?\bid="([^"]+)"[^>]*>\s*<h1>(?:<span[^>]*><\/span>)?\s*([^<]*?)\s*<\/h1>/g;
  let match;
  while ((match = clause.exec(html))) {
    const [, id, head] = match;
    const named = /^(get |set )?([%A-Za-z_][\w%$.]*(?:\.\[\[?@@?\w+\]?\]|\s*\[\s*(?:@@|%Symbol\.)\w+%?\s*\])?)\s*(\(.*\))?$/.exec(head.replace(/&lt;/g, '<'));
    const isFunction = named && (named[3] !== undefined || named[1]) && (named[2].includes('.') || named[2].includes('@@') || named[2].includes('%Symbol.'));
    const isGlobal = /^[a-z]\w*\s*\(.*\)$/.test(head) && /^sec-(escape|unescape|eval|isfinite|isnan|parsefloat|parseint|decodeuri|encodeuri)/.test(id);
    if (isFunction || isGlobal || /-constructors?$|%symbol\./.test(id)) {
      found.push({ id, head });
    }
  }

  return found;
};

// `Owner.name` of every function and accessor the running engine defines on the standard built-ins
const runtimeNames = () => {
  const names = new Set(GLOBALS);
  const list = (obj, label) => {
    for (const key of Reflect.ownKeys(obj)) {
      const desc = Object.getOwnPropertyDescriptor(obj, key);
      if (!SKIP.has(key) && (typeof desc.value === 'function' || desc.get || desc.set)) {
        names.add(`${label}.${typeof key === 'symbol' ? `@@${key.description.replace('Symbol.', '')}` : key}`);
      }
    }
  };

  OWNERS.concat('AggregateError', 'EvalError', 'RangeError', 'ReferenceError', 'SyntaxError', 'TypeError', 'URIError').forEach((owner) => {
    const target = globalThis[owner];
    if (target) {
      list(target, owner);
      if (target.prototype) {
        list(target.prototype, `${owner}.prototype`);
      }
    }
  });

  const TypedArray = Object.getPrototypeOf(Int8Array);
  list(TypedArray, '%TypedArray%');
  list(TypedArray.prototype, '%TypedArray%.prototype');
  list(Object.getPrototypeOf([][Symbol.iterator]()), '%ArrayIteratorPrototype%');
  list(Object.getPrototypeOf(new Map()[Symbol.iterator]()), '%MapIteratorPrototype%');
  list(Object.getPrototypeOf(new Set()[Symbol.iterator]()), '%SetIteratorPrototype%');
  list(Object.getPrototypeOf(''[Symbol.iterator]()), '%StringIteratorPrototype%');
  list(Object.getPrototypeOf(/a/[Symbol.matchAll]('a')), '%RegExpStringIteratorPrototype%');
  list(Object.getPrototypeOf(function * () {}).prototype, '%GeneratorPrototype%');
  list(Object.getPrototypeOf(async function * () {}).prototype, '%AsyncGeneratorPrototype%');
  return names;
};

const generate = (specDir) => {
  const html = fs.readFileSync(path.join(specDir, 'spec.html'), 'utf8');
  const clauses = specClauses(html);
  const names = runtimeNames();
  for (const { head } of clauses) {
    if (head.includes('.') || head.includes('@@') || /^[a-z]/.test(head)) {
      names.add(head.replace(/ \(.*$/, '').replace(/^(get|set) /, '').replace(/\.\[\[?@@(\w+)\]?\]/, '.@@$1').replace(/\s*\[\s*(?:@@|%Symbol\.)(\w+)%?\s*\]/, '.@@$1'));
    }
  }

  fs.writeFileSync(path.join(fixtures, 'spec-sections.json'), `${JSON.stringify(clauses.map((c) => c.id).sort(), null, 1)}\n`);
  const covered = [...names].filter((n) => !n.endsWith('.constructor') && !n.endsWith('.@@toStringTag') && !n.endsWith('.@@unscopables') && !n.startsWith('%Symbol.')).sort();
  fs.writeFileSync(path.join(fixtures, 'builtin-names.json'), `${JSON.stringify(covered, null, 1)}\n`);
  console.log(`${clauses.length} spec clauses, ${covered.length} names (${process.version}, V8 ${process.versions.v8})`);
};

const verify = (v8Dir) => {
  const sections = new Set(JSON.parse(fs.readFileSync(path.join(fixtures, 'spec-sections.json'), 'utf8')));
  const counts = { v8: 0, spec: 0, est: 0 };
  const problems = [];
  for (const row of table.rows) {
    if (row.ref) {
      const [file, symbol] = row.ref.split('#');
      const full = path.join(v8Dir, file);
      if (!fs.existsSync(full)) {
        problems.push(`${row.key}: ${file} does not exist`);
      } else if (!fs.readFileSync(full, 'utf8').includes(symbol)) {
        problems.push(`${row.key}: ${symbol} is not in ${file}`);
      }
    }

    const source = row.est ? 'est' : (row.ref ? 'v8' : (hasSection(row, sections) ? 'spec' : 'est'));
    counts[source]++;
  }

  console.log(`${table.rows.length} rows: ${counts.v8} with a V8 reference, ${counts.spec} read off the spec, ${counts.est} estimates`);
  problems.forEach((p) => console.log(`PROBLEM ${p}`));
  process.exitCode = problems.length ? 1 : 0;
};

if (require.main === module) {
  const [command, dir] = process.argv.slice(2);
  if (!dir || !['generate', 'verify'].includes(command)) {
    console.log('usage: node scripts/builtin-reference.js generate <ecma262-dir> | verify <v8-dir>');
    process.exitCode = 2;
  } else {
    (command === 'generate' ? generate : verify)(dir);
  }
}
