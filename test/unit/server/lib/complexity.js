const Fs = require('node:fs');
const Path = require('node:path');
const Lab = require('@hapi/lab');
const Code = require('@hapi/code');

const complexity = require('../../../../server/lib/complexity');

const lab = exports.lab = Lab.script();
const { analyzeTest, analyzePage, present, classify } = complexity;

const fixture = (name) => Fs.readFileSync(Path.join(__dirname, '../../../fixtures', name), 'utf8');
const examplePage = {
  initHTML: fixture('complexity-init.html'),
  setup: fixture('complexity-setup.js.txt'),
  teardown: 'if (sink === -1) { console.log(sink); }'
};

const none = {};
// overall class of a snippet that has no page code
const overall = (code, page = none, options) => analyzeTest(page, code, options).overall;
const calls = (code, page = none) => analyzeTest(page, code, none).calls.map((c) => `${c.code} => ${c.cls}`);

lab.experiment('complexity analyzer', () => {
  lab.experiment('the example page', () => {
    lab.test('hash lookup + binary search is O(n) overall, with per-call classes', () => {
      const result = analyzeTest(examplePage, fixture('complexity-test-4.js.txt'));
      Code.expect(result.estimate).to.be.true();
      Code.expect(result.overall).to.equal('on');
      Code.expect(result.calls).to.equal([
        { code: 'buildLookupTable(sharedData)', cls: 'on' },
        { code: 'checksum(sharedData)', cls: 'on' },
        { code: 'constantLookup(lookup, targetKeys[k])', cls: 'o1' },
        { code: 'binarySearch(sortedData, targetKeys[k])', cls: 'ologn' }
      ]);
    });

    lab.test('merge sort is O(n log n) overall', () => {
      const result = analyzeTest(examplePage, fixture('complexity-test-5.js.txt'));
      Code.expect(result.overall).to.equal('onlogn');
      Code.expect(result.calls.find((c) => c.code === 'mergeSort(sharedData)').cls).to.equal('onlogn');
      Code.expect(result.calls.find((c) => c.code === 'linearFind(sharedData, targetKeys[k])').cls).to.equal('on');
    });

    lab.test('insertion sort is O(n^2) overall and the capped pairwise loop is constant', () => {
      const result = analyzeTest(examplePage, fixture('complexity-test-6.js.txt'));
      Code.expect(result.overall).to.equal('on2');
      Code.expect(result.calls.find((c) => c.code === 'insertionSort(sharedData)').cls).to.equal('on2');
      Code.expect(result.calls.find((c) => c.code === 'pairwiseDistanceSum(sortedQuad)').cls).to.equal('o1');
    });

    lab.test('analyzePage returns one result per test', () => {
      const results = analyzePage(examplePage, [{ code: 'checksum(sharedData)' }, { code: 'hashValue(3)' }]);
      Code.expect(results.map((r) => r.overall)).to.equal(['on', 'o1']);
    });
  });

  lab.experiment('loops', () => {
    lab.test('a body without loops or calls is constant', () => {
      Code.expect(overall('var a = 1 + 2; a++;')).to.equal('o1');
      Code.expect(overall('')).to.equal('o1');
      Code.expect(calls('var a = 1;')).to.equal([]);
    });

    lab.test('loops over input are linear', () => {
      Code.expect(overall('for (var i = 0; i < data.length; i++) { x += data[i]; }')).to.equal('on');
      Code.expect(overall('for (var i = 0; i < n; i += 2) { x++; }')).to.equal('on');
      Code.expect(overall('for (var i = data.length - 1; i >= 0; i--) { x++; }')).to.equal('on');
      Code.expect(overall('for (var i = n; i > 0; i -= 3) { x++; }')).to.equal('on');
      Code.expect(overall('for (var i = 0; i < n; i = i + 1) { x++; }')).to.equal('on');
      Code.expect(overall('for (var i = 0; i < n && !done; i++) { x++; }')).to.equal('on');
      Code.expect(overall('for (var i = 0; i < n || more; i++) { x++; }')).to.equal('on');
      Code.expect(overall('for (var i = 0; i * i < n; i++) { x++; }')).to.equal('on2'); // products of bounds are multiplied: conservative
      Code.expect(overall('for (;;) { break; }')).to.equal('on');
      Code.expect(overall('for (var p = head; p; p = p.next) { x++; }')).to.equal('on');
      Code.expect(overall('for (var i = 0; ok(i); i++) { x++; }', { setup: 'function ok() { return true; }' })).to.equal('on');
      Code.expect(overall('for (const x of list) { y += x; }')).to.equal('on');
      Code.expect(overall('for (const k in obj) { y++; }')).to.equal('on');
      Code.expect(overall('while (node) { node = node.next; }')).to.equal('on');
      Code.expect(overall('do { i++; } while (i < n);')).to.equal('on');
      Code.expect(overall('while (i < n) { i += 2; }')).to.equal('on');
      Code.expect(overall('while (i > 0) { i -= 3; }')).to.equal('on');
      Code.expect(overall('while (i < n) { i = i + 1; }')).to.equal('on');
    });

    lab.test('nested loops multiply', () => {
      Code.expect(overall('for (var i = 0; i < n; i++) for (var j = 0; j < n; j++) x++;')).to.equal('on2');
      Code.expect(overall('for (var i = 0; i < n; i++) for (var j = i + 1; j < n; j++) for (var k = 0; k < n; k++) x++;')).to.equal('on3');
      Code.expect(overall('for (var i = 0; i < n; i++) for (var j = 0; j < n; j++) for (var k = 0; k < n; k++) for (var l = 0; l < n; l++) x++;')).to.equal('higher');
      Code.expect(overall('for (var i = 0; i < n; i++) for (var j = i; j > 0; j--) x++;')).to.equal('on2');
      Code.expect(overall('for (var i = 0; i < n; i++) { for (var j = 1; j < n; j *= 2) x++; }')).to.equal('onlogn');
    });

    lab.test('doubling and halving updates are logarithmic', () => {
      Code.expect(overall('for (var i = 1; i < n; i *= 2) x++;')).to.equal('ologn');
      Code.expect(overall('for (var i = n; i > 1; i = Math.floor(i / 2)) x++;')).to.equal('ologn');
      Code.expect(overall('for (var i = n; i > 0; i >>= 1) x++;')).to.equal('ologn');
      Code.expect(overall('for (var i = n; i > 0; i >>>= 1) x++;')).to.equal('ologn');
      Code.expect(overall('for (var i = n; i > 0; i /= 2) x++;')).to.equal('ologn');
      Code.expect(overall('for (var i = 1; i < n; i = i << 1) x++;')).to.equal('ologn');
      Code.expect(overall('for (var i = 1; i < n; i = i * 0.5) x++;')).to.equal('ologn');
      Code.expect(overall('while (n > 1) { n = n / 2; }')).to.equal('ologn');
      Code.expect(overall('while (i < n) { i *= 2; }')).to.equal('ologn');
      Code.expect(overall('var lo = 0, hi = n; while (lo < hi) { var mid = (lo + hi) >> 1; if (a[mid] < t) lo = mid + 1; else hi = mid; }')).to.equal('ologn');
    });

    lab.test('a linear counter next to a shift is still linear', () => {
      Code.expect(overall('while (i < n) { h = h >>> 4; i++; }')).to.equal('on');
      Code.expect(overall('while (i < n) { h = h >>> 4; i += 1; }')).to.equal('on');
    });

    lab.test('constants are not mistaken for scaling', () => {
      Code.expect(overall('while (i < n) { h = h * 1664525; i = i + 1; }')).to.equal('on');
      Code.expect(overall('while (i < n) { h = h * 1; i = i + 1; }')).to.equal('on');
    });

    lab.test('constant bounds make a loop constant', () => {
      Code.expect(overall('for (var i = 0; i < 10; i++) x++;')).to.equal('o1');
      Code.expect(overall('for (var i = 0; i < Math.min(data.length, 24); i++) x++;')).to.equal('o1');
      Code.expect(overall('var cap = Math.min(data.length, 24); for (var i = 0; i < cap; i++) for (var j = i + 1; j < cap; j++) x++;')).to.equal('o1');
      Code.expect(overall('for (var i = 0; i < Math.min(data.length, 24) * 2 + 1; i++) x++;')).to.equal('o1');
      Code.expect(overall('for (var i = 0; i < 10 % n; i++) x++;')).to.equal('o1');
      Code.expect(overall('for (var i = 0; i < SIZE; i++) x++;', { setup: 'var SIZE = 48;' })).to.equal('o1');
      Code.expect(overall('for (var i = 0; i < SIZE / 2; i++) x++;', { setup: 'const SIZE = 48;' })).to.equal('o1');
      Code.expect(overall('for (var i = 0; i < Math.sqrt(100); i++) x++;')).to.equal('o1');
      Code.expect(overall('for (var i = 0; i < Math.log2(100); i++) x++;')).to.equal('o1');
      Code.expect(overall('for (var i = 0; i < (big ? 4 : 8); i++) x++;')).to.equal('o1');
      Code.expect(overall('for (var i = 0; i < -(-4); i++) x++;')).to.equal('o1');
      Code.expect(overall('for (var i = 0; i < keys.length; i++) x++;', { setup: 'var keys = [1, 2, 3];' })).to.equal('o1');
      Code.expect(overall('for (var i = 0; i < name.length; i++) x++;', { setup: 'var name = "abc";' })).to.equal('o1');
      Code.expect(overall('for (const k of [1, 2, 3]) x += k;')).to.equal('o1');
      Code.expect(overall('for (const k of `abc`) x += k;')).to.equal('o1');
      Code.expect(overall('for (const k of keys) x += k;', { setup: 'var keys = [1, 2, 3];' })).to.equal('o1');
      Code.expect(overall('for (var i = 0; i < 1 << 3; i++) x++;')).to.equal('o1');
      Code.expect(overall('for (var i = 0; i < 2 >>> 1; i++) x++;')).to.equal('o1');
      Code.expect(overall('for (var i = 0; i < 100 >> 1; i++) x++;')).to.equal('o1');
    });

    lab.test('a constant bound with a log update is constant, a variable bound with a log update is log', () => {
      Code.expect(overall('for (var i = 1; i < 1000; i *= 2) x++;')).to.equal('o1');
      Code.expect(overall('for (var i = 1; i < Math.log2(n); i *= 2) x++;')).to.equal('ologn');
    });

    lab.test('reassigned or non-constant variables are not constants', () => {
      Code.expect(overall('for (var i = 0; i < SIZE; i++) x++;', { setup: 'var SIZE = 48; SIZE = n;' })).to.equal('on');
      Code.expect(overall('SIZE += 1; for (var i = 0; i < SIZE; i++) x++;', { setup: 'var SIZE = 48;' })).to.equal('on');
      Code.expect(overall('for (var i = 0; i < SIZE; i++) x++;', { setup: 'var SIZE = size();' })).to.equal('on');
      Code.expect(overall('for (var i = 0; i < Math.min(a, b); i++) x++;')).to.equal('on');
      Code.expect(overall('for (var i = 0; i < Math.max(24, n); i++) x++;')).to.equal('on');
      Code.expect(overall('for (var i = 0; i < "abc"; i++) x++;')).to.equal('on');
      Code.expect(overall('for (var i = 0; i < foo(); i++) x++;')).to.equal('unknown');
      Code.expect(overall('for (var i = 0; i < foo(); i++) x++;', { setup: 'function foo() { return 1; }' })).to.equal('on');
      Code.expect(overall('for (var i = 0; i < Math.pow(2, 4); i++) x++;')).to.equal('on');
      Code.expect(overall('for (var i = 0; i < Math.min(); i++) x++;')).to.equal('on');
      Code.expect(overall('for (var i = 0; i < 2 ** 3; i++) x++;')).to.equal('on');
      Code.expect(overall('for (var i = 0; i < obj["length"]; i++) x++;')).to.equal('on');
      Code.expect(overall('for (var i = 0; i < obj.size; i++) x++;')).to.equal('on');
      Code.expect(overall('for (var i = 0; i < (n = 5); i++) x++;')).to.equal('on');
      Code.expect(overall('for (var i = 0; i < a; i++) x++;', { setup: 'var a = b; var b = c; var c = d; var d = e; var e = f; var f = g; var g = h; var h = k; var k = l; var l = 4;' })).to.equal('on');
      Code.expect(overall('for (var i = 0; i < a; i++) x++;', { setup: 'var a = 5; function g(a) { }' })).to.equal('o1');
    });

    lab.test('strided loops walking blocks of the input do not multiply with work bounded by the block', () => {
      Code.expect(overall('for (var w = 1; w < n; w *= 2) { for (var i = 0; i < n; i += 2 * w) { for (var k = i; k < i + w; k++) x++; } }')).to.equal('onlogn');
      Code.expect(overall('for (var i = 0; i < n; i += step) { x++; }')).to.equal('on');
      Code.expect(overall('for (var i = n; i > 0; i -= step) { for (var k = 0; k < n; k++) x++; }')).to.equal('on');
    });

    lab.test('statements are combined with max', () => {
      Code.expect(overall('if (a) { for (var i = 0; i < n; i++) x++; } else { x = 1; }')).to.equal('on');
      Code.expect(overall('x = a ? sortIt(b) : 1;', { setup: 'function sortIt(a) { return a.sort(); }' })).to.equal('onlogn');
      Code.expect(overall('switch (k) { case 1: x++; break; default: for (var i = 0; i < n; i++) x++; }')).to.equal('on');
      Code.expect(overall('try { x++; } catch (e) { for (var i = 0; i < n; i++) x++; } finally { y++; }')).to.equal('on');
      Code.expect(overall('outer: for (var i = 0; i < n; i++) { continue outer; }')).to.equal('on');
      Code.expect(overall('for (var i = 0; i < n; i++) { for (var j = 0; j < n; j++) { if (x) break; } }')).to.equal('on2');
    });
  });

  lab.experiment('loop shapes', () => {
    lab.test('odd loop headers', () => {
      Code.expect(overall('var a = [1, , 2]; for (x of list) y++;')).to.equal('on');
      Code.expect(overall('for (obj.k in other) y++;')).to.equal('on');
      Code.expect(overall('for (; this.i < n; this.i++) y++;')).to.equal('on');
      Code.expect(overall('for (; p.i < n; p.i += 1) y++;')).to.equal('on');
      Code.expect(overall('for (; i < n; step()) y++;', { setup: 'function step() {}' })).to.equal('on');
      Code.expect(overall('for (var i = 0; i != n; i++) y++;')).to.equal('on');
      Code.expect(overall('for (var i = 0; i === 3; i++) y++;')).to.equal('on');
      Code.expect(overall('for (var i = 0; i + 1 < n; i++) y++;')).to.equal('on');
      Code.expect(overall('for (var i = 0; i + 1 < n - 1; i++) y++;')).to.equal('on');
      Code.expect(overall('var lim; for (var i = 0; i < lim; i++) y++;')).to.equal('on');
      Code.expect(overall('for (var i = 0; i < obj.size(); i++) y++;')).to.equal('unknown');
    });

    lab.test('counting down starts at the real bound', () => {
      Code.expect(overall('for (i = n; i > 0; i--) y++;')).to.equal('on');
      Code.expect(overall('for (; i > 0; i--) y++;')).to.equal('on');
      Code.expect(overall('for (x(); i > 0; i--) y++;', { setup: 'function x() {}' })).to.equal('on');
      Code.expect(overall('for (var i = n, j = 5; i > 0; i--) y++;')).to.equal('on');
      Code.expect(overall('for (var i = n, j; i > 0; i--) y++;')).to.equal('on');
      Code.expect(overall('for (var i = n; 0 < i; i = i - 1) y++;')).to.equal('on');
      Code.expect(overall('for (var i = n; n > i; i++) y++;')).to.equal('on');
      Code.expect(overall('for (var i = 10; 0 < i; i--) y++;')).to.equal('o1');
      Code.expect(overall('for (;;i--) y++;')).to.equal('on');
      Code.expect(overall('for (var i = 3; 10 > i; i++) y++;')).to.equal('o1');
    });

    lab.test('while loops with odd tests', () => {
      Code.expect(overall('while ((a >> 1) < b) { a = a + 1; }')).to.equal('ologn');
      Code.expect(overall('while (h) { h = h * 0; }')).to.equal('on');
      Code.expect(overall('while (h) { h = h >> 0; }')).to.equal('on');
      Code.expect(overall('while (i < n) { i *= k; }')).to.equal('on');
      Code.expect(overall('while (i < n) { i *= 1; }')).to.equal('on');
      Code.expect(overall('while (i < n) { i += 0; }')).to.equal('on');
      Code.expect(overall('while (i < n) { this.count++; }')).to.equal('on');
    });

    lab.test('strided loops with unknown bodies', () => {
      Code.expect(overall('for (var i = 0; i < n; i += step) { mystery(); }')).to.equal('unknown');
    });
  });

  lab.experiment('built-ins', () => {
    lab.test('sort is n log n, sort of a literal is constant', () => {
      Code.expect(overall('data.sort();')).to.equal('onlogn');
      Code.expect(overall('data.slice().sort(function (a, b) { return a - b; });')).to.equal('onlogn');
      Code.expect(overall('data.sort((a, b) => a - b);')).to.equal('onlogn');
      Code.expect(overall('data.toSorted(cmp);', { setup: 'function cmp(a, b) { return a - b; }' })).to.equal('onlogn');
      Code.expect(overall('[3, 1, 2].sort();')).to.equal('o1');
    });

    lab.test('a comparator multiplies the sort', () => {
      Code.expect(overall('data.sort(function (a, b) { return heavy(a) - heavy(b); });', { setup: 'function heavy(x) { var s = 0; for (var i = 0; i < x.length; i++) s++; return s; }' })).to.equal('on3'); // n log n * n = n^2 log n, rounded up
    });

    lab.test('linear built-ins', () => {
      for (const code of ['data.indexOf(1)', 'data.includes(1)', 'data.slice(1)', 'str.split(",")', 'data.join("")', 'data.concat(other)', 'str.replace(/a/g, "b")', 'data.reverse()']) {
        Code.expect(overall(code), code).to.equal('on');
      }
      Code.expect(overall('"abc".indexOf("b")')).to.equal('o1');
      Code.expect(overall('[1, 2, 3].includes(2)')).to.equal('o1');
    });

    lab.test('constant time built-ins', () => {
      for (const code of ['data.push(1)', 'data.pop()', 'Math.max(a, b)', 'map.get(k)', 'set.has(k)', 'str.charCodeAt(0)', 'Date.now()', 'console.log(x)', 'parseInt(x, 10)', 'String(x)', 'Number("1")', 'Array.isArray(x)', 'Object.create(null)', 'String.fromCharCode(65)', 'performance.now()', 'Object.is(a, b)', 'fn.bind(null)']) {
        Code.expect(overall(code), code).to.equal('o1');
      }
    });

    lab.test('callbacks run once per element', () => {
      Code.expect(overall('data.forEach(function (x) { sum += x; });')).to.equal('on');
      Code.expect(overall('data.map((x) => x * 2);')).to.equal('on');
      Code.expect(overall('data.map(double);', { setup: 'function double(x) { return x * 2; }' })).to.equal('on');
      Code.expect(overall('data.map(Number);')).to.equal('on');
      Code.expect(overall('data.filter(function (x) { return other.indexOf(x) >= 0; });')).to.equal('on2');
      Code.expect(overall('data.reduce((a, b) => a + b, 0);')).to.equal('on');
      Code.expect(overall('[1, 2, 3].forEach((x) => x);')).to.equal('o1');
      Code.expect(overall('data.map(mystery);')).to.equal('unknown');
      Code.expect(overall('data.map(obj.fn);')).to.equal('unknown');
      Code.expect(overall('data.forEach();')).to.equal('on');
    });

    lab.test('static helpers', () => {
      Code.expect(overall('Object.keys(obj)')).to.equal('on');
      Code.expect(overall('Object.keys()')).to.equal('o1');
      Code.expect(overall('JSON.stringify(obj)')).to.equal('on');
      Code.expect(overall('JSON.parse("[1]")')).to.equal('o1');
      Code.expect(overall('Array.from(data)')).to.equal('on');
      Code.expect(overall('Array.from(data, function (x) { return x; })')).to.equal('on');
      Code.expect(overall('Array.from()')).to.equal('o1');
      Code.expect(overall('Array.from({ length: 3 })')).to.equal('on');
      Code.expect(overall('encodeURIComponent(s)')).to.equal('on');
      Code.expect(overall('Object.freeze([1, 2])')).to.equal('o1');
    });

    lab.test('constructors', () => {
      Code.expect(overall('new Array(n)')).to.equal('on');
      Code.expect(overall('new Array(5)')).to.equal('o1');
      Code.expect(overall('new Array()')).to.equal('o1');
      Code.expect(overall('new Array([1, 2])')).to.equal('o1');
      Code.expect(overall('new Set(data)')).to.equal('on');
      Code.expect(overall('new Map()')).to.equal('o1');
      Code.expect(overall('new Float64Array(n)')).to.equal('on');
      Code.expect(overall('new Date()')).to.equal('o1');
      Code.expect(overall('new Error("x")')).to.equal('o1');
      Code.expect(overall('new Date(data.slice())')).to.equal('on');
      Code.expect(overall('new Mystery()')).to.equal('unknown');
      Code.expect(overall('new lib.Thing()')).to.equal('unknown');
    });
  });

  lab.experiment('calls compose', () => {
    lab.test('callee cost plus argument cost', () => {
      const page = { setup: 'function one() { return 1; } function lin(a) { var s = 0; for (var i = 0; i < a.length; i++) s += a[i]; return s; }' };
      Code.expect(overall('one(lin(data))', page)).to.equal('on');
      Code.expect(overall('lin(data.slice())', page)).to.equal('on');
      Code.expect(overall('one(1)', page)).to.equal('o1');
    });

    lab.test('functions calling functions', () => {
      const page = { setup: 'function a(x) { for (var i = 0; i < x.length; i++) b(x); } function b(x) { return x.indexOf(1); }' };
      Code.expect(overall('a(data)', page)).to.equal('on2');
    });

    lab.test('functions are resolved from the test code, setup, init scripts and shadow each other', () => {
      Code.expect(overall('function f(a) { for (var i = 0; i < a.length; i++) {} } f(x)')).to.equal('on');
      Code.expect(overall('f(x)', { initHTML: '<div></div><script>function f(a) { for (var i = 0; i < a.length; i++) {} }</script>' })).to.equal('on');
      Code.expect(overall('f(x)', { setup: 'function f() {}', initHTML: '<script>function f(a) { a.sort(); }</script>' })).to.equal('o1');
      Code.expect(overall('function f(a) { a.sort(); } f(x)', { setup: 'function f() {}' })).to.equal('onlogn');
      Code.expect(overall('f(x)', { setup: 'var f = function (a) { a.sort(); };' })).to.equal('onlogn');
      Code.expect(overall('f(x)', { setup: 'var f = (a) => a.sort();' })).to.equal('onlogn');
      Code.expect(overall('f(x)', { setup: 'f = function (a) { a.sort(); };' })).to.equal('onlogn');
      Code.expect(overall('f(x)', { setup: '(function () { function f(a) { a.sort(); } })();' })).to.equal('onlogn');
      Code.expect(overall('f(x)', { teardown: 'function f(a) { a.sort(); }' })).to.equal('onlogn');
    });

    lab.test('script tags that are external or not javascript are ignored', () => {
      const body = 'function f(a) { a.sort(); }';
      Code.expect(overall('f(x)', { initHTML: `<script src="x.js">${body}</script>` })).to.equal('unknown');
      Code.expect(overall('f(x)', { initHTML: `<script type="text/template">${body}</script>` })).to.equal('unknown');
      Code.expect(overall('f(x)', { initHTML: `<script type="text/javascript">${body}</script>` })).to.equal('onlogn');
      Code.expect(overall('f(x)', { initHTML: `<script type="module">${body}</script>` })).to.equal('onlogn');
      Code.expect(overall('f(x)', { initHTML: `<script   >${body}</script>` })).to.equal('onlogn');
    });

    lab.test('methods defined on the page', () => {
      const setup = `
        var list = { each: function (a) { for (var i = 0; i < a.length; i++) {} }, ['computed']: function () {}, one: () => 1, plain: 3 };
        function Stack() { this.items = []; }
        Stack.prototype.contains = function (v) { for (var i = 0; i < this.items.length; i++) {} };
        Stack['quoted'] = function () { this.contains(1); };
        class Queue { constructor () { this.items = []; } drain () { while (this.items.length) this.items.pop(); } static make () { return new Queue(); } get size () { return 1; } ['x']() {} }
        const bag = { fill (a) { a.sort(); } };
      `;
      Code.expect(overall('list.each(data)', { setup })).to.equal('on');
      Code.expect(overall('list.one()', { setup })).to.equal('o1');
      Code.expect(overall('s.contains(1)', { setup })).to.equal('on');
      Code.expect(overall('s.quoted()', { setup })).to.equal('on');
      Code.expect(overall('s["quoted"]()', { setup })).to.equal('on');
      Code.expect(overall('q.drain()', { setup })).to.equal('on');
      Code.expect(overall('bag.fill(data)', { setup })).to.equal('onlogn');
      Code.expect(overall('new Queue()', { setup })).to.equal('o1');
      Code.expect(overall('new Stack()', { setup })).to.equal('o1');
      Code.expect(overall('q.mystery()', { setup })).to.equal('unknown');
      Code.expect(overall('q[name]()', { setup })).to.equal('unknown');
    });

    lab.test('unusual member shapes in the page code', () => {
      const setup = `
        class A { #p () { return 1; } m () { return this.#p(); } x = 1; static s = 2; ['c'] () {} 'quoted' () { for (var i = 0; i < n; i++) {} } }
        class B { m () { return 1; } }
        var o = { 'a-b': function (a) { a.sort(); }, ...rest, [k]: function () {} };
        var x;
        obj[k] = function () {};
        [y] = function () {};
        var thing = {};
      `;
      Code.expect(overall('new A().m()', { setup })).to.equal('unknown');
      Code.expect(overall('a.quoted()', { setup })).to.equal('on');
      Code.expect(overall('b.m()', { setup })).to.equal('unknown'); // two different methods named "m": the unknown private call wins
      Code.expect(overall('foo.bar()', { setup })).to.equal('unknown');
      Code.expect(overall('new B()', { setup })).to.equal('o1');
      Code.expect(overall('new thing()', { setup })).to.equal('unknown');
      Code.expect(overall('function f(thing) { return new thing(); } f(1)')).to.equal('unknown');
      Code.expect(overall('Array.foo(1)')).to.equal('unknown');
    });

    lab.test('classes with constructors and class expressions', () => {
      const setup = 'class Index { constructor (a) { for (var i = 0; i < a.length; i++) {} } } var Other = class { constructor () { this.x = 1; } };';
      Code.expect(overall('new Index(data)', { setup })).to.equal('on');
      Code.expect(overall('new Other()', { setup })).to.equal('o1');
      Code.expect(overall('Index()', { setup })).to.equal('unknown');
    });

    lab.test('call and apply run the target', () => {
      const setup = 'function lin(a) { for (var i = 0; i < a.length; i++) {} }';
      Code.expect(overall('lin.call(null, data)', { setup })).to.equal('on');
      Code.expect(overall('lin.apply(null, [data])', { setup })).to.equal('on');
      Code.expect(overall('obj.fn.call(null)', { setup })).to.equal('unknown');
    });

    lab.test('immediately invoked functions and nested definitions', () => {
      Code.expect(overall('(function () { for (var i = 0; i < n; i++) {} })();')).to.equal('on');
      Code.expect(overall('(() => 1)();')).to.equal('o1');
      Code.expect(overall('function outer(a) { function inner(b) { return b.sort(); } return inner(a); } outer(data)')).to.equal('onlogn');
      Code.expect(overall('function outer(a) { var helper = function (b) { return b.sort(); }; return helper(a); } outer(data)')).to.equal('onlogn');
      Code.expect(overall('function outer(a) { class K { constructor () { a.sort(); } } return new K(); } outer(data)')).to.equal('onlogn');
      Code.expect(overall('var { a, b: [c] } = pair; var [d = 1] = list; a + c + d;')).to.equal('o1');
      Code.expect(overall('function f({ a, b = 2 }, [c], ...rest) { return a.sort(); } f(x)')).to.equal('onlogn');
      Code.expect(overall('function f(a, b = g(a)) { return 1; } f(x)', { setup: 'function g(a) { return a.sort(); }' })).to.equal('o1');
    });

    lab.test('super and unresolvable callees', () => {
      Code.expect(overall('class A extends B { constructor () { super(); } } new A()')).to.equal('o1');
      Code.expect(overall('f()()')).to.equal('unknown');
      Code.expect(overall('missing(1)')).to.equal('unknown');
      Code.expect(overall('function g(cb) { cb(); } g(x)')).to.equal('unknown');
      Code.expect(overall('var o = 5; o()')).to.equal('unknown');
      Code.expect(overall('eval("1")')).to.equal('unknown');
      Code.expect(overall('tag`x`')).to.equal('unknown');
      Code.expect(overall('import("x")')).to.equal('unknown');
      Code.expect(overall('async function f() { await g(); } f()', { setup: 'function g() {}' })).to.equal('o1');
    });
  });

  lab.experiment('recursion', () => {
    lab.test('linear recursion costs n', () => {
      Code.expect(overall('function sum(n) { return n === 0 ? 0 : n + sum(n - 1); } sum(10)')).to.equal('on');
      Code.expect(overall('function fact(n) { if (n <= 1) return 1; return n * fact(n - 1); } fact(5)')).to.equal('on');
    });

    lab.test('linear recursion with linear work costs n^2', () => {
      Code.expect(overall('function f(a) { if (!a.length) return 0; return a.indexOf(1) + f(a.slice(1)); } f(data)')).to.equal('on2');
    });

    lab.test('branching recursion that does not shrink geometrically is exponential', () => {
      Code.expect(overall('function fib(n) { return n < 2 ? n : fib(n - 1) + fib(n - 2); } fib(20)')).to.equal('higher');
    });

    lab.test('halving recursion', () => {
      Code.expect(overall('function bs(a, t, lo, hi) { if (lo > hi) return -1; var mid = (lo + hi) >> 1; if (a[mid] === t) return mid; return a[mid] < t ? bs(a, t, mid + 1, hi) : bs(a, t, lo, mid - 1); } bs(d, 1, 0, 9)')).to.equal('ologn');
      Code.expect(overall('function bs(a, t, lo, hi) { if (lo > hi) return -1; var mid = (lo + hi) >> 1; return bs(a, t, lo, mid - 1); } bs(d, 1, 0, 9)')).to.equal('ologn');
      Code.expect(overall('function f(n) { if (n <= 1) return 0; return f(Math.floor(n / 2)) + n.toFixed(); } f(8)')).to.equal('ologn');
      Code.expect(overall('function f(a) { if (a.length < 2) return a; return f(a.slice(a.length / 2)).indexOf(1); } f(x)')).to.equal('on');
    });

    lab.test('merge sort style recursion is n log n', () => {
      const page = { setup: 'function merge(l, r) { var out = [], i = 0, j = 0; while (i < l.length && j < r.length) out.push(l[i] < r[j] ? l[i++] : r[j++]); return out.concat(l.slice(i), r.slice(j)); }' };
      Code.expect(overall('function ms(a) { if (a.length < 2) return a; var mid = Math.floor(a.length / 2); return merge(ms(a.slice(0, mid)), ms(a.slice(mid))); } ms(d)', page)).to.equal('onlogn');
    });

    lab.test('two halving calls with other amounts of work', () => {
      Code.expect(overall('function t(n) { if (n < 1) return 0; return t(n / 2) + t(n / 2); } t(8)')).to.equal('on');
      Code.expect(overall('function t(a) { for (var i = 0; i < a.length; i++) for (var j = 0; j < a.length; j++); return t(a.slice(1 / 2)) + t(a.slice(0, a.length / 2)); } t(d)')).to.equal('on2');
      Code.expect(overall('function t(n) { if (n < 1) return 0; return t(n / 2) + t(n / 2) + t(n / 2) + t(n / 2); } t(8)')).to.equal('on2');
      Code.expect(overall('function t(n) { if (n < 1) return 0; return t(n / 2) + t(n / 2) + t(n / 2); } t(8)')).to.equal('on2');
    });

    lab.test('recursion through callbacks is still direct recursion', () => {
      Code.expect(overall('function walk(node) { node.children.forEach(function (c) { walk(c); }); } walk(root)')).to.equal('on2');
      Code.expect(overall('function walk(node) { node.children.forEach((c) => walk(c)); } walk(root)')).to.equal('on2');
    });

    lab.test('mutual recursion is unknown', () => {
      Code.expect(overall('function a(n) { return n ? b(n - 1) : 0; } function b(n) { return n ? a(n - 1) : 0; } a(4)')).to.equal('unknown');
    });

    lab.test('recursion with unknown work is unknown', () => {
      Code.expect(overall('function f(n) { mystery(); return n ? f(n - 1) : 0; } f(3)')).to.equal('unknown');
    });
  });

  lab.experiment('listing calls', () => {
    lab.test('lists outermost calls in source order, including calls in loops and branches', () => {
      Code.expect(calls('var a = f(g(1)); if (a) { h(); } for (var i = 0; i < 3; i++) { k(i); }', { setup: 'function f() {} function g() {} function h() {} function k() {}' })).to.equal([
        'f(g(1)) => o1', 'h() => o1', 'k(i) => o1'
      ]);
    });

    lab.test('a call inside a loop over input carries the loop', () => {
      Code.expect(calls('for (var i = 0; i < data.length; i++) { f(i); }', { setup: 'function f() {}' })).to.equal(['f(i) => on']);
      Code.expect(calls('for (var i = 1; i < n; i *= 2) { f(i); }', { setup: 'function f() {}' })).to.equal(['f(i) => ologn']);
      Code.expect(calls('while (node) { f(node); node = node.next; }', { setup: 'function f() {}' })).to.equal(['f(node) => on']);
    });

    lab.test('definitions are not calls and new expressions are listed', () => {
      Code.expect(calls('function f() { g(); } class A { m() { g(); } } var x = new Set(data); (function () {})();')).to.equal([
        'new Set(data) => on', '(function () {})() => o1'
      ]);
    });

    lab.test('snippets are collapsed and truncated', () => {
      const result = analyzeTest(none, 'foo(\n    1,\n    2\n  );').calls[0];
      Code.expect(result.code).to.equal('foo( 1, 2 )');
      const long = analyzeTest(none, 'foo(' + '"x",'.repeat(40) + '1)').calls[0].code;
      Code.expect(long.length).to.equal(80);
      Code.expect(long).to.endWith('...');
    });

    lab.test('the list is capped and says how many were left out', () => {
      const code = new Array(20).fill('Math.abs(1);').join('\n');
      const result = analyzeTest(none, code);
      Code.expect(result.calls.length).to.equal(12);
      Code.expect(result.more).to.equal(8);
      Code.expect(analyzeTest(none, code, { maxCalls: 30 }).more).to.be.undefined();
    });

    lab.test('an unknown call makes the overall result unknown', () => {
      const result = analyzeTest(none, 'mystery(1);');
      Code.expect(result.overall).to.equal('unknown');
      Code.expect(result.calls).to.equal([{ code: 'mystery(1)', cls: 'unknown' }]);
    });
  });

  lab.experiment('safety', () => {
    lab.test('syntax errors are unknown, never throw', () => {
      Code.expect(analyzeTest(none, 'for (;;')).to.equal({ estimate: true, overall: 'unknown', calls: [] });
      Code.expect(analyzeTest(none, '<b>html</b>').overall).to.equal('unknown');
    });

    lab.test('unparsable setup code is skipped', () => {
      Code.expect(overall('Math.abs(1)', { setup: 'function (', initHTML: '<script>}{</script>' })).to.equal('o1');
    });

    lab.test('missing and odd inputs are tolerated', () => {
      Code.expect(analyzePage({}, [{}, { code: null }, { code: 5 }]).map((r) => r.overall)).to.equal(['o1', 'o1', 'o1']);
      Code.expect(analyzePage({ initHTML: null, setup: null, teardown: null }, [])).to.equal([]);
    });

    lab.test('code is never executed', () => {
      global.__complexityExecuted = false;
      analyzeTest({ setup: 'global.__complexityExecuted = true;' }, 'global.__complexityExecuted = true; (function () { global.__complexityExecuted = true; })();');
      Code.expect(global.__complexityExecuted).to.be.false();
      delete global.__complexityExecuted;
    });

    lab.test('oversized code is unknown', () => {
      Code.expect(overall('Math.abs(1);', none, { maxCodeLength: 5 })).to.equal('unknown');
      Code.expect(overall('f(1)', { setup: 'function f() {}' }, { maxCodeLength: 5 })).to.equal('unknown');
      Code.expect(overall('f(1)', { setup: 'function f() { return 1; }' }, { maxCodeLength: 10 })).to.equal('unknown');
    });

    lab.test('the step budget turns long analyses into unknown', () => {
      const code = 'for (var i = 0; i < n; i++) { ' + 'x = x + 1; '.repeat(200) + ' }';
      Code.expect(overall(code)).to.equal('on');
      const result = analyzeTest(none, code + ' foo(1);', { maxSteps: 50 });
      Code.expect(result.overall).to.equal('unknown');
      Code.expect(result.calls).to.equal([]);
    });

    lab.test('a call that runs out of budget is unknown while the others are answered', () => {
      const setup = 'function heavy() { ' + 'x = x + 1; '.repeat(100) + ' }';
      const result = analyzeTest({ setup }, 'Math.abs(1); heavy();', { maxSteps: 60 });
      Code.expect(result.overall).to.equal('unknown');
    });

    lab.test('the time budget is enforced', () => {
      Code.expect(overall('Math.abs(1);', none, { maxMs: -1 })).to.equal('unknown');
    });

    lab.test('the page time budget leaves the remaining tests unknown', () => {
      const results = analyzePage({}, [{ code: 'Math.abs(1);' }, { code: 'Math.abs(1);' }], { maxPageMs: -1 });
      Code.expect(results.map((r) => r.overall)).to.equal(['unknown', 'unknown']);
    });

    lab.test('deeply nested code gives unknown instead of a stack overflow', () => {
      const deep = '['.repeat(500) + ']'.repeat(500);
      Code.expect(overall(deep, none, { maxDepth: 50 })).to.equal('unknown');
      Code.expect(analyzeTest(none, 'f(' + deep + ')', { maxDepth: 50 }).calls[0].cls).to.equal('unknown');
      Code.expect(overall('['.repeat(200000) + ']'.repeat(200000))).to.equal('unknown');
    });

    lab.test('a call graph that fans out forever is cut off', () => {
      let setup = '';
      for (let i = 0; i < 30; i++) {
        setup += `function f${i}() { f${i + 1}(); f${i + 1}(); }\n`;
      }
      setup += 'function f30() {}';
      Code.expect(overall('f0()', { setup })).to.equal('unknown');
    });
  });

  lab.experiment('classify', () => {
    lab.test('rounds up to the next displayable class', () => {
      Code.expect(classify({ n: 0, l: 2 })).to.equal('on');
      Code.expect(classify({ n: 1, l: 2 })).to.equal('on2');
      Code.expect(classify({ n: 2, l: 1 })).to.equal('on3');
      Code.expect(classify({ n: 3, l: 0 })).to.equal('on3');
      Code.expect(classify({ n: 3, l: 1 })).to.equal('higher');
      Code.expect(classify(null)).to.equal('unknown');
    });
  });

  lab.experiment('present', () => {
    lab.test('decorates a stored result for the template', () => {
      const view = present({ estimate: true, overall: 'onlogn', calls: [{ code: 'f(x)', cls: 'o1' }], more: 2 });
      Code.expect(view.overall).to.include({ cls: 'onlogn', label: 'O(n log n)', curve: 'curve-onlogn' });
      Code.expect(view.calls[0]).to.include({ code: 'f(x)', cls: 'o1', label: 'O(1)', curve: 'curve-o1' });
      Code.expect(view.more).to.equal(2);
      Code.expect(view.unknown).to.be.false();
    });

    lab.test('accepts a JSON string', () => {
      const view = present(JSON.stringify({ overall: 'on', calls: [] }));
      Code.expect(view.overall.cls).to.equal('on');
      Code.expect(view.more).to.equal(0);
    });

    lab.test('unknown and unrecognised classes show as unknown', () => {
      const view = present({ overall: 'unknown', calls: [{ code: 'x()', cls: 'bogus' }] });
      Code.expect(view.unknown).to.be.true();
      Code.expect(view.calls[0].cls).to.equal('unknown');
      Code.expect(present({ overall: 'constructor', calls: [] }).unknown).to.be.true();
    });

    lab.test('returns null when there is nothing usable', () => {
      Code.expect(present(null)).to.be.null();
      Code.expect(present(undefined)).to.be.null();
      Code.expect(present('not json')).to.be.null();
      Code.expect(present({ overall: 'on' })).to.be.null();
      Code.expect(present('5')).to.be.null();
    });
  });
});
