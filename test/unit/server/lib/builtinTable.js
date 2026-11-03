const Fs = require('node:fs');
const Path = require('node:path');
const Lab = require('@hapi/lab');
const Code = require('@hapi/code');

const table = require('../../../../server/lib/builtinTable');
const builtins = require('../../../../server/lib/builtins');
const { hasSection } = require('../../../../scripts/builtin-reference');

const lab = exports.lab = Lab.script();

const fixture = (name) => JSON.parse(Fs.readFileSync(Path.join(__dirname, '../../../fixtures', name), 'utf8'));

const TIME = /^(1|log|n|nlogn|arg|sized|subtree|markup|unknown|cb)(\*cb)?$/;
const SPACE = /^(1|log|n|arg|sized|subtree|markup|cb|unknown)$/;

lab.experiment('built-in table', () => {
  lab.test('has exactly one row per built-in', () => {
    const keys = table.rows.map((r) => r.key);
    Code.expect(new Set(keys).size).to.equal(keys.length);
  });

  lab.test('covers every function and accessor of the specification and of V8 12.4', () => {
    const keys = new Set(table.rows.map((r) => r.key));
    const missing = fixture('builtin-names.json').filter((name) => !keys.has(name));
    Code.expect(missing).to.equal([]);
  });

  lab.test('every row says where its class comes from: a V8 reference, a spec section or an estimate', () => {
    const sections = new Set(fixture('spec-sections.json'));
    const unsourced = table.rows.filter((r) => !r.est && !r.ref && !hasSection(r, sections)).map((r) => r.key);
    Code.expect(unsourced).to.equal([]);
  });

  lab.test('uses the cost vocabulary, in both profiles', () => {
    for (const row of table.rows) {
      for (const profile of [row.spec, row.v8]) {
        Code.expect(profile.time, row.key).to.match(TIME);
        Code.expect(profile.space, row.key).to.match(SPACE);
        for (const [name, time, space] of profile.steps || []) {
          Code.expect(name, row.key).to.be.a.string();
          Code.expect(time, row.key).to.match(TIME);
          Code.expect(space, row.key).to.match(SPACE);
        }
      }
      if (row.ref) {
        Code.expect(row.ref, row.key).to.match(/^(src|third_party)\/[\w/.-]+#\w+$/);
      }
    }
  });

  lab.test('a profile that changes the class also changes the steps that explain it', () => {
    const stale = table.rows.filter((r) => r.spec.steps && r.v8.time !== r.spec.time && r.v8.steps === r.spec.steps).map((r) => r.key);
    Code.expect(stale).to.equal([]);
  });

  lab.test('looks rows up by key, by method name with owner hints, and by DOM name', () => {
    Code.expect(table.get('Array.prototype.sort').spec.time).to.equal('nlogn*cb');
    Code.expect(table.get('nope')).to.be.undefined();
    Code.expect(table.method('slice', ['String.prototype']).owner).to.equal('String.prototype');
    Code.expect(table.method('slice', ['Map.prototype', 'Array.prototype']).owner).to.equal('Array.prototype');
    Code.expect(table.method('set').owner).to.equal('Map.prototype');
    Code.expect(table.method('nope')).to.be.null();
    Code.expect(table.dom('appendChild').spec.time).to.equal('subtree');
    Code.expect(table.dom('nope')).to.be.null();
  });
});

lab.experiment('built-in profiles', () => {
  lab.test('V8 differs from the standard where its implementation does', () => {
    const { spec, v8 } = builtins;
    Code.expect(spec.N_METHODS.has('shift')).to.be.true();
    Code.expect(v8.O1_METHODS.has('shift')).to.be.true();
    Code.expect(spec.LOG_METHODS.has('get')).to.be.true();
    Code.expect(v8.O1_METHODS.has('get')).to.be.true();
    Code.expect(spec.N_METHODS.has('clear')).to.be.true();
    Code.expect(v8.O1_METHODS.has('clear')).to.be.true();
    Code.expect(v8.STRING_O1_METHODS.has('slice')).to.be.true();
    Code.expect(spec.STRING_O1_METHODS.size).to.equal(0);
    Code.expect(spec.ropes).to.be.false();
    Code.expect(v8.ropes).to.be.true();
    Code.expect(builtins.profile('v8')).to.shallow.equal(v8);
    Code.expect(builtins.profile()).to.shallow.equal(spec);
  });

  lab.test('derives the sets the analyzer reads', () => {
    const { spec } = builtins;
    Code.expect(spec.SORT_METHODS.has('sort')).to.be.true();
    Code.expect(spec.CALLBACK_METHODS.has('map')).to.be.true();
    Code.expect(spec.ALLOC_CALLBACK_METHODS.has('filter')).to.be.true();
    Code.expect(spec.ONCE_CALLBACK_METHODS.has('then')).to.be.true();
    Code.expect(spec.ARG_SIZED.has('repeat')).to.be.true();
    Code.expect(spec.ALLOC_METHODS.has('slice')).to.be.true();
    Code.expect(spec.O1_METHODS.has('push')).to.be.true();
    Code.expect(spec.O1_NAMESPACES.has('Math')).to.be.true();
    Code.expect(spec.N_STATICS.get('Math').has('sumPrecise')).to.be.true();
    Code.expect(spec.N_STATICS.get('Object').has('keys')).to.be.true();
    Code.expect(spec.O1_STATICS.get('Object').has('create')).to.be.true();
    Code.expect(spec.O1_STATICS.get('Int8Array').has('of')).to.be.true();
    Code.expect(spec.O1_GLOBAL_FUNCTIONS.has('parseInt')).to.be.true();
    Code.expect(spec.O1_GLOBAL_FUNCTIONS.has('String')).to.be.true();
    Code.expect(spec.N_GLOBAL_FUNCTIONS.has('encodeURIComponent')).to.be.true();
    Code.expect(spec.SIZED_CONSTRUCTORS.has('Map')).to.be.true();
    Code.expect(spec.O1_CONSTRUCTORS.has('Date')).to.be.true();
    Code.expect(spec.DOM_SUBTREE_METHODS.has('appendChild')).to.be.true();
    Code.expect(spec.DOM_MARKUP_METHODS.has('insertAdjacentHTML')).to.be.true();
    Code.expect(spec.DOM_O1_METHODS.has('createElement')).to.be.true();
  });

  lab.test('does not treat accessors or unknown cost as callable constant time methods', () => {
    const { spec } = builtins;
    for (const name of ['size', 'length', 'buffer', 'flags']) {
      Code.expect(spec.O1_METHODS.has(name), name).to.be.false();
    }
    Code.expect(spec.O1_METHODS.has('eval')).to.be.false();
    Code.expect(spec.N_STATICS.get('Atomics')).to.be.undefined();
    Code.expect(spec.O1_STATICS.get('Atomics').has('wait')).to.be.false();
  });
});
