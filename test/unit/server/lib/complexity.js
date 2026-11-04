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
      // the helpers of the page's preparation code show up inside the loops that call them
      const hashValue = { name: 'hashValue', cls: 'o1', steps: [{ name: 'Math.imul', cls: 'o1' }], more: 0 };
      Code.expect(result.estimate).to.be.true();
      Code.expect(result.overall).to.equal('on');
      Code.expect(result.calls).to.equal([
        {
          code: 'buildLookupTable(sharedData)',
          cls: 'on',
          steps: [{ name: 'Object.create', cls: 'o1' }, { name: 'for loop', cls: 'on', perPass: true, steps: [hashValue], more: 0 }]
        },
        { code: 'checksum(sharedData)', cls: 'on', steps: [{ name: 'for loop', cls: 'on', perPass: true, steps: [hashValue], more: 0 }] },
        { code: 'constantLookup(lookup, targetKeys[k])', cls: 'o1' },
        { code: 'binarySearch(sortedData, targetKeys[k])', cls: 'ologn', steps: [{ name: 'while loop', cls: 'ologn', perPass: true, steps: [{ name: 'compareAsc', cls: 'o1' }], more: 0 }] }
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
      Code.expect(overall('for (var i = 0; i * i < n; i++) { x++; }')).to.equal('on'); // sqrt(n) iterations, rounded up to linear
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

    lab.test('a reassignment elsewhere does not affect a same-named local constant', () => {
      const page = { setup: 'function other(n) { n = n.length; return n; }\nfunction count(n) { var s = 0; for (var i = 0; i < n; i++) s++; return s; }' };
      Code.expect(overall('count(10);', page)).to.equal('o1');
      Code.expect(overall('function f() { var k = 5; return k; }\nfunction g(k) { k = k.length; for (var i = 0; i < k; i++) x++; }\nf(); g(data);', none)).to.equal('on');
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

    lab.test('a square-root bound (i * i <= n) is no worse than linear', () => {
      Code.expect(overall('for (var i = 1; i * i <= n; i++) y++;')).to.equal('on');
      Code.expect(overall('for (var i = 1; n >= i * i; i++) y++;')).to.equal('on');
      Code.expect(overall('for (var i = 1; i * j <= n; i++) y++;')).to.equal('on2');
      Code.expect(overall('for (var i = 1; j * i <= n; i++) y++;')).to.equal('on2');
      Code.expect(overall('for (var i = 1; i * 2 <= n; i++) y++;')).to.equal('on');
      Code.expect(overall('for (var i = 1; 2 * i <= n; i++) y++;')).to.equal('on');
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
    lab.test('an array literal stays constant unless it can grow', () => {
      const lit = 'var a = [3, 1, 2];';
      Code.expect(overall('a.sort();', { setup: lit })).to.equal('o1');
      Code.expect(overall('a.sort();', { setup: lit + ' a.push(4);' })).to.equal('o1'); // one-off growth at setup time
      Code.expect(overall('a.sort();', { setup: lit + ' a[5] = 1;' })).to.equal('o1');
      Code.expect(overall('a.sort();', { setup: lit + ' b.length = 1; b[0] = 1; b.push(1);' })).to.equal('o1'); // other arrays do not matter
      Code.expect(overall('a.sort();', { setup: 'var a = []; for (var i = 0; i < n; i++) { a.push(i); }' })).to.equal('onlogn');
      Code.expect(overall('a.sort();', { setup: lit + ' function f() { a.unshift(1); }' })).to.equal('onlogn');
      Code.expect(overall('a.push(1); a.sort();', { setup: lit })).to.equal('onlogn'); // test code runs repeatedly
      Code.expect(overall('a.sort();', { setup: lit + ' a[i] = 1;' })).to.equal('onlogn');
      Code.expect(overall('a.sort();', { setup: lit + ' a.length = n;' })).to.equal('onlogn');
      Code.expect(overall('a.sort();', { setup: lit + ' for (const k in o) { a.splice(0, 1); }' })).to.equal('onlogn');
      Code.expect(overall('for (var i = 0; i < a.length; i++) y++;', { setup: lit })).to.equal('o1');
      Code.expect(overall('for (var i = 0; i < a.length; i++) y++;', { setup: lit + ' while (k--) { a.push(k); }' })).to.equal('on');
    });

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
        Code.expect(overall(code, none, { engine: 'v8' }), code).to.equal('o1');
      }
    });

    lab.test('keyed collections are only promised to be sublinear by the standard', () => {
      Code.expect(overall('map.get(k); set.has(k); set.add(k); map.delete(k)')).to.equal('ologn');
      Code.expect(overall('map.get(k); set.has(k); set.add(k); map.delete(k)', none, { engine: 'v8' })).to.equal('o1');
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
      Code.expect(overall('Array.from({ length: 3 })')).to.equal('o1');
      Code.expect(overall('Array.from({ length: n })')).to.equal('on');
      Code.expect(overall('Array.from({ "length": 2, extra: 1 })')).to.equal('o1');
      Code.expect(overall('Array.from({ ...x })')).to.equal('on');
      Code.expect(overall('Array.from({ a: 1, [k]: 2, "b": 3, length: 4 })')).to.equal('o1');
      Code.expect(overall('Array.from([, 1])')).to.equal('o1');
      Code.expect(overall('Array.from([...x])')).to.equal('on');
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

  lab.experiment('callbacks', () => {
    const setup = 'function lin(x) { for (var i = 0; i < x.length; i++) {} } ' +
      'function each(l, f) { for (var i = 0; i < l.length; i++) f(l[i]); } ' +
      'function once(f) { f(); } ' +
      'function pass(l, g) { each(l, g); } ' +
      'function pair(f, g) { f(); g(); } ' +
      'var inc = function (v) { return v + 1; }; ' +
      'function viaDestructuring({ a }, f) { f(); }';

    lab.test('a callback parameter costs what the function passed at the call site costs', () => {
      Code.expect(overall('each(x, function (v) {});', { setup })).to.equal('on');
      Code.expect(overall('each(x, (v) => v);', { setup })).to.equal('on');
      Code.expect(overall('each(x, inc);', { setup })).to.equal('on');
      Code.expect(overall('each(x, lin);', { setup })).to.equal('on2');
      Code.expect(overall('each(x, function (v) { lin(x); });', { setup })).to.equal('on2');
      Code.expect(overall('once(function () { lin(x); });', { setup })).to.equal('on');
      Code.expect(overall('once(lin);', { setup })).to.equal('on');
      Code.expect(overall('pair(function () {}, function () { lin(x); });', { setup })).to.equal('on');
    });

    lab.test('callbacks can be forwarded through other functions', () => {
      Code.expect(overall('pass(x, function (v) {});', { setup })).to.equal('on');
      Code.expect(overall('pass(x, lin);', { setup })).to.equal('on2');
    });

    lab.test('callbacks that cannot be resolved stay unknown', () => {
      Code.expect(overall('each(x, mystery);', { setup })).to.equal('unknown');
      Code.expect(overall('each(x);', { setup })).to.equal('unknown');
      Code.expect(overall('each(x, obj.method);', { setup })).to.equal('unknown');
      Code.expect(overall('viaDestructuring(o, inc);', { setup })).to.equal('o1');
      Code.expect(overall('function run(g) { g(); } run(mystery);')).to.equal('unknown');
    });
  });

  lab.experiment('numeric arguments', () => {
    const setup = 'function count(n) { var s = 0; for (var i = 0; i < n; i++) { s++; } return s; } ' +
      'function grid(n, m) { for (var i = 0; i < n; i++) { for (var j = 0; j < m; j++) {} } } ' +
      'function fact(n) { return n <= 1 ? 1 : n * fact(n - 1); } ' +
      'function wrap(n) { return count(n); } ' +
      'var K = 50; var L = 5; L++;';

    lab.test('a numeric literal argument is a value, so loops bounded by it are constant', () => {
      Code.expect(overall('count(1000);', { setup })).to.equal('o1');
      Code.expect(overall('count(K);', { setup })).to.equal('o1');
      Code.expect(overall('grid(10, 20);', { setup })).to.equal('o1');
      Code.expect(overall('wrap(5);', { setup })).to.equal('o1');
    });

    lab.test('only the parameters bound to constants are constant', () => {
      Code.expect(overall('grid(10, m);', { setup })).to.equal('on');
      Code.expect(overall('grid(n, 10);', { setup })).to.equal('on');
      Code.expect(overall('grid(n, m);', { setup })).to.equal('on2');
    });

    lab.test('sizes, reassigned variables and unknown values stay linear', () => {
      Code.expect(overall('count(data.length);', { setup })).to.equal('on');
      Code.expect(overall('count(k);', { setup })).to.equal('on');
      Code.expect(overall('count(L);', { setup })).to.equal('on');
      Code.expect(overall('count(-n);', { setup })).to.equal('on');
      Code.expect(overall('wrap(k);', { setup })).to.equal('on');
    });

    lab.test('recursion on a number keeps its shape', () => {
      Code.expect(overall('fact(10);', { setup })).to.equal('on');
      Code.expect(overall('fib(30);', { setup: 'function fib(n) { return n < 2 ? n : fib(n - 1) + fib(n - 2); }' })).to.equal('oexp');
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
      Code.expect(overall('function fib(n) { return n < 2 ? n : fib(n - 1) + fib(n - 2); } fib(20)')).to.equal('oexp');
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
      Code.expect(analyzeTest(none, 'for (;;', { engine: 'spec' })).to.equal({ estimate: true, version: complexity.VERSION, overall: 'unknown', calls: [], space: { overall: 'unknown', items: [] } });
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
      Code.expect(classify({ n: 0, l: 2 })).to.equal('ologn2');
      Code.expect(classify({ n: 0, l: 3 })).to.equal('ologn2');
      Code.expect(classify({ n: 1, l: 2 })).to.equal('onlogn2');
      Code.expect(classify({ n: 99, l: 0 })).to.equal('oexp');
      Code.expect(classify({ n: 4, l: 0 })).to.equal('higher');
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
      Code.expect(view.calls[0]).to.include({ code: 'f(\n\tx\n)', cls: 'o1', label: 'O(1)', curve: 'curve-o1' });
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

  lab.experiment('engine specific built-ins', () => {
    const page = {
      setup: 'var data = []; for (var i = 0; i < 3; i++) data.push(i); var text = data.join(","); var lit = "abc"; lit = lit + text; var width = 5;'
    };
    const rate = (code, engine) => {
      const result = analyzeTest(page, code, { engine });
      return `${result.overall}/${result.space.overall}`;
    };
    const both = (code) => `${rate(code, 'spec')} ${rate(code, 'v8')}`;

    lab.test('both rule sets are analyzed and stored by default', () => {
      const result = analyzeTest(page, 'data.shift();');
      Code.expect(result.overall).to.equal('on');
      Code.expect(result.engines.v8.overall).to.equal('o1');
      Code.expect(result.engines.v8.estimate).to.not.exist();
      Code.expect(analyzeTest(page, 'data.shift();', { engine: 'v8' }).engines).to.not.exist();
    });

    lab.test('shift, trim and string slices are cheaper in V8', () => {
      Code.expect(both('data.shift();')).to.equal('on/o1 o1/o1');
      Code.expect(both('text.trim(); text.trimStart(); text.trimEnd();')).to.equal('on/on o1/o1');
      Code.expect(both('text.substring(1); text.substr(1, 2);')).to.equal('on/on o1/o1');
      Code.expect(both('lit.slice(2, 5);')).to.equal('on/on o1/o1');
      Code.expect(both('"a literal".slice(2);')).to.equal('o1/o1 o1/o1');
      Code.expect(both('`a`.slice(2);')).to.equal('o1/o1 o1/o1');
    });

    lab.test('slicing something that is not a stored string still copies', () => {
      Code.expect(both('data.slice(1);')).to.equal('on/on on/on');
      Code.expect(both('text.slice(1);')).to.equal('on/on on/on');
      Code.expect(both('(lit + width).slice(1); (lit + width).substring(1);')).to.equal('on/on on/on');
      Code.expect(both('text.concat(lit).substring(1);')).to.equal('on/on on/on');
      Code.expect(both('obj.name.substring(1); this.name.substr(1);')).to.equal('on/on o1/o1');
      Code.expect(both('mystery(text).slice(1);')).to.equal('unknown/unknown unknown/unknown');
    });

    lab.test('repeat and padding cost their length argument', () => {
      Code.expect(both('"0".repeat(32);')).to.equal('o1/o1 o1/o1');
      Code.expect(both('"0".repeat(width);')).to.equal('o1/o1 o1/o1');
      Code.expect(both('"0".repeat(data.length);')).to.equal('on/on ologn/ologn');
      Code.expect(both('text.repeat(3);')).to.equal('on/on o1/o1');
      Code.expect(both('text.padStart(data.length, "0");')).to.equal('on/on ologn/ologn');
      Code.expect(both('text.padEnd(8);')).to.equal('on/on o1/o1');
      Code.expect(both('text.padStart();')).to.equal('on/on o1/o1');
    });

    lab.test('iterators are created lazily', () => {
      Code.expect(both('data.keys(); data.values(); data.entries();')).to.equal('o1/o1 o1/o1');
      Code.expect(both('for (var k of data.keys()) { x++; }')).to.equal('on/o1 on/o1');
    });

    lab.test('spreading into a call passes every element', () => {
      Code.expect(both('Math.max(...data);')).to.equal('on/on on/on');
      Code.expect(both('Math.max(...[1, 2]);')).to.equal('o1/o1 o1/o1');
    });

    lab.test('Object.assign reads its sources', () => {
      Code.expect(both('Object.assign({}, { a: 1 });')).to.equal('o1/o1 o1/o1');
      Code.expect(both('Object.assign({}, { ...data });')).to.equal('on/on on/on');
      Code.expect(both('Object.assign({}, data);')).to.equal('on/o1 on/o1');
      Code.expect(both('Object.keys(data);')).to.equal('on/on on/on');
    });

    lab.test('regular expressions with nested quantifiers can backtrack exponentially', () => {
      Code.expect(both('/^(a+)+$/.test(text);')).to.equal('oexp/o1 oexp/o1');
      Code.expect(both('text.match(/(\\w*\\s)*end/);')).to.equal('oexp/on oexp/on');
      Code.expect(both('/(a+){2,}b/.exec(text);')).to.equal('oexp/o1 oexp/o1');
      Code.expect(both('text.replace(pattern, "b"); text.split(); lit.match(mystery);')).to.equal('on/on on/on');
      Code.expect(both('/^(ab)+$/.test(text); /a+b*/.test(text); text.replace("a", "b");')).to.equal('on/on on/on');
    });

    lab.test('sets compare in linear time', () => {
      Code.expect(both('new Set(data).union(new Set(data));')).to.equal('on/on on/on');
    });
  });

  lab.experiment('aliases, borrowed methods and stored functions', () => {
    const page = {
      setup: [
        'var data = []; for (var i = 0; i < 3; i++) data.push(i);',
        'var Kind = Float64Array; var Other = Kind; var Mine = function () {}; var Alias = Mine;',
        'function work(x) { for (var i = 0; i < data.length; i++) { x++; } return x; }',
        'var bound = work.bind(null, 1); var plain = 5;',
        'var cheap = function () { return 1; }; var costly = function () { return data.slice(); };',
        'var handlers = [cheap, costly]; var literal = [cheap]; var seen = 0;',
        'var target = new EventTarget();',
        'handlers.forEach(function (h) { target.addEventListener("tick", function (event) { h(event.detail); }); });'
      ].join('\n')
    };
    const run = (code) => {
      const result = analyzeTest(page, code, { engine: 'v8' });
      return `${result.overall}/${result.space.overall}`;
    };

    lab.test('a variable standing for a built-in is that built-in', () => {
      Code.expect(run('new Kind(data.length);')).to.equal('on/on');
      Code.expect(run('new Other(data.length);')).to.equal('on/on');
      Code.expect(run('Kind.from(data);')).to.equal('on/on');
      Code.expect(run('Kind.from(data, function (x) { return x; });')).to.equal('on/on');
      Code.expect(run('Kind.of(1, 2);')).to.equal('o1/o1');
      Code.expect(run('new Alias();')).to.equal('o1/o1');
      Code.expect(run('new plain();')).to.equal('unknown/unknown');
      Code.expect(run('new Mine();')).to.equal('o1/o1');
      Code.expect(run('var K = Float64Array; K = Int8Array; new K(data.length);')).to.equal('unknown/unknown');
      Code.expect(run('new Float64Array(3);')).to.equal('o1/o1');
    });

    lab.test('Array(n) allocates like new Array(n)', () => {
      Code.expect(run('Array(data.length);')).to.equal('on/on');
      Code.expect(run('Array(3);')).to.equal('o1/o1');
      Code.expect(run('function Array() { return 1; } Array(data.length);')).to.equal('o1/o1');
    });

    lab.test('bound functions run the original', () => {
      Code.expect(run('bound(1);')).to.equal('on/o1');
      Code.expect(run('Promise.resolve(1).then(work.bind(null, 1));')).to.equal('on/o1');
      Code.expect(run('Promise.resolve(1).then(function () { return 1; }.bind(null));')).to.equal('o1/o1');
    });

    lab.test('built-in methods can be borrowed with call and apply', () => {
      Code.expect(run('Array.prototype.push.apply(data, data);')).to.equal('on/on');
      Code.expect(run('Array.prototype.push.apply(data);')).to.equal('o1/o1');
      Code.expect(run('Object.prototype.hasOwnProperty.call(data, "x");')).to.equal('o1/o1');
      Code.expect(run('Array.prototype.slice.call(data, 1);')).to.equal('on/on');
      Code.expect(run('Array.prototype.indexOf.call();')).to.equal('o1/o1');
      Code.expect(run('Array.prototype.frobnicate.call(data);')).to.equal('unknown/unknown');
      Code.expect(run('function f() { return 1; } f.call(null); f.apply(null);')).to.equal('o1/o1');
    });

    lab.test('a call through an array of functions is the most expensive of them', () => {
      Code.expect(run('handlers[0](1);')).to.equal('on/on');
      Code.expect(run('literal[0](1);')).to.equal('o1/o1');
      Code.expect(run('handlers.forEach(function (h) { h(1); });')).to.equal('on/on');
      Code.expect(run('literal.forEach(function (h) { h(1); });')).to.equal('o1/o1');
      Code.expect(run('handlers.forEach(function () { return 1; });')).to.equal('o1/o1');
      Code.expect(run('handlers.forEach(function ([h]) { h(1); });')).to.equal('unknown/unknown');
      Code.expect(run('unknownList.forEach(function (h) { h(1); });')).to.equal('unknown/unknown');
      Code.expect(run('mystery[0](1);')).to.equal('unknown/unknown');
    });

    lab.test('dispatching an event runs the registered listeners', () => {
      Code.expect(run('target.dispatchEvent(new CustomEvent("tick", { detail: 1 }));')).to.equal('on/on');
      Code.expect(run('new Event("x"); new EventTarget();')).to.equal('o1/o1');
      Code.expect(analyzeTest({ setup: 'var t = new EventTarget();' }, 't.dispatchEvent(new Event("x"));').overall).to.equal('o1');
      Code.expect(analyzeTest({ setup: 'function dispatchEvent() { return 1; }' }, 'x.dispatchEvent(1);').overall).to.equal('o1');
    });

    lab.test('functions collected from loops, declarations and odd code', () => {
      const loops = {
        setup: [
          'var list = []; var tail = [];',
          'function declared() { return 1; }',
          'for (var i = 0; i < 3; i++) { list.push(function () { return 1; }); }',
          'list.push(declared, 5, mystery);',
          'tail = [declared, , function () { return list.slice(); }];',
          'var holder = {}; holder.run = function () { return 1; };',
          'var ok = [function () { return 1; }];',
          'var el = {}; el.addEventListener("x");',
          'el.addEventListener("x", 5);',
          'ok.forEach(5);',
          'ok.forEach();',
          'ok.forEach(function () { return 1; });',
          'ok.forEach(function ([a]) { return a; });',
          'function skipped() { ok.push(function () { return 1; }); }'
        ].join('\n')
      };
      Code.expect(analyzeTest(loops, 'list[0]();', { engine: 'v8' }).overall).to.equal('o1');
      Code.expect(analyzeTest(loops, 'tail[0]();', { engine: 'v8' }).overall).to.equal('on');
      Code.expect(analyzeTest(loops, 'el.dispatchEvent(1);', { engine: 'v8' }).overall).to.equal('o1');
    });

    lab.test('less usual shapes of calls', () => {
      Code.expect(run('plain(1);')).to.equal('unknown/unknown');
      Code.expect(run('var q; q(1);')).to.equal('unknown/unknown');
      Code.expect(run('a.b[0](1);')).to.equal('unknown/unknown');
      Code.expect(run('Promise.resolve(1).then(obj.method(1));')).to.equal('unknown/unknown');
      Code.expect(run('Promise.resolve(1).then(obj[key](1));')).to.equal('unknown/unknown');
      Code.expect(run('function run(cb) { cb(); } run(work.bind(null));')).to.equal('on/o1');
      Code.expect(run('x[y].call(1);')).to.equal('unknown/unknown');
      Code.expect(run('var a1 = Float64Array, a2 = a1, a3 = a2, a4 = a3, a5 = a4; new a5(3);')).to.equal('unknown/unknown');
      Code.expect(analyzeTest({ setup: 'var holder = {}; holder.run = function () { return 1; };' }, 'x.run.call(1);', { engine: 'v8' }).overall).to.equal('o1');
    });

    lab.test('collecting stops on hostile input', () => {
      const deep = { setup: 'var a = []; ' + '['.repeat(300) + ']'.repeat(300) + '; a.push(function () {});' };
      Code.expect(analyzeTest(deep, 'a[0]();', { engine: 'v8' }).overall).to.be.a.string();
      Code.expect(analyzeTest({ setup: 'var a = []; a.push(function () {});' }, 'a[0]();', { engine: 'v8', maxSteps: 3 }).overall).to.equal('unknown');
    });
  });

  lab.experiment('DOM methods', () => {
    const page = { setup: 'var host = document.getElementById("host"); var items = []; for (var i = 0; i < 3; i++) items.push(i); var markup = items.join("");' };
    const rate = (code, engine) => {
      const result = analyzeTest(page, code, { engine });
      return `${result.overall}/${result.space.overall}`;
    };
    const both = (code) => `${rate(code, 'spec')} ${rate(code, 'v8')}`;

    lab.test('creating nodes is constant', () => {
      Code.expect(both('document.createElement("li"); document.createTextNode("x"); document.createComment("c");')).to.equal('o1/o1 o1/o1');
      Code.expect(both('document.createDocumentFragment(); document.getElementById("a");')).to.equal('o1/o1 o1/o1');
    });

    lab.test('inserting a lone node is constant, a subtree is linear', () => {
      Code.expect(both('var li = document.createElement("li"); host.appendChild(li);')).to.equal('o1/o1 o1/o1');
      Code.expect(both('host.appendChild(document.createElement("li"));')).to.equal('o1/o1 o1/o1');
      Code.expect(both('host.insertBefore(document.createTextNode("x"), null); host.removeChild(host.firstChild);')).to.equal('on/on on/on');
      Code.expect(both('var f = document.createDocumentFragment(); host.appendChild(f);')).to.equal('on/on on/on');
      Code.expect(both('var ul = document.createElement("ul"); var li = document.createElement("li"); ul.appendChild(li); host.appendChild(ul);')).to.equal('on/on on/on');
      Code.expect(both('var ul = document.createElement("ul"); ul.innerHTML = markup; host.replaceChild(ul, host.firstChild);')).to.equal('on/on on/on');
      Code.expect(both('host.appendChild(mystery);')).to.equal('on/on on/on');
      Code.expect(both('host.appendChild();')).to.equal('o1/o1 o1/o1');
      Code.expect(both('var n = parseInt(1); host.appendChild(n);')).to.equal('on/on on/on');
    });

    lab.test('a node that gets children appended is no longer a lone node', () => {
      Code.expect(both('var a = document.createElement("a"); a.insertAdjacentHTML("beforeend", "<b></b>"); host.appendChild(a);')).to.equal('on/on on/on');
      Code.expect(both('var a = document.createElement("a"); a.append(host); a.prepend(host); host.appendChild(a);')).to.equal('on/on on/on');
      Code.expect(both('var a = document.createElement("a"); a.textContent = "x"; a.title = "t"; this.x = 1; host.appendChild(a);')).to.equal('o1/o1 o1/o1');
      Code.expect(both('var a = document.createElement("a"); a.replaceChild(host, host); host.appendChild(a);')).to.equal('on/on on/on');
      Code.expect(both('var a = document.createElement("a"); a.insertBefore(host, null); host.appendChild(a);')).to.equal('on/on on/on');
    });

    lab.test('queries walk the tree, except for an id', () => {
      Code.expect(both('host.querySelectorAll(".row");')).to.equal('on/on on/on');
      Code.expect(both('host.querySelector("#main");')).to.equal('o1/o1 o1/o1');
      Code.expect(both('host.querySelector(selector);')).to.equal('on/on on/on');
      Code.expect(both('host.querySelector();')).to.equal('on/on on/on');
      Code.expect(both('host.querySelector(1);')).to.equal('on/on on/on');
      Code.expect(both('host.matches(".row"); host.getAttribute("id"); host.getElementsByClassName("row");')).to.equal('o1/o1 o1/o1');
    });

    lab.test('closest climbs the ancestors; messages and history entries are serialized', () => {
      Code.expect(both('host.closest(".row");')).to.equal('ologn/ologn ologn/ologn');
      Code.expect(both('window.postMessage(list, "*");')).to.equal('on/on on/on');
      Code.expect(both('history.pushState(list, "");')).to.equal('on/on on/on');
      Code.expect(both('history.pushState();')).to.equal('o1/o1 o1/o1');
    });

    lab.test('markup is parsed in linear time', () => {
      Code.expect(both('host.insertAdjacentHTML("beforeend", markup);')).to.equal('on/on on/on');
      Code.expect(both('host.insertAdjacentHTML("beforeend", "<b></b>");')).to.equal('o1/o1 o1/o1');
      Code.expect(both('host.insertAdjacentHTML("beforeend");')).to.equal('o1/o1 o1/o1');
    });

    lab.test('nodes appended in a loop add up in memory', () => {
      Code.expect(both('var ul = document.createElement("ul"); for (var i = 0; i < items.length; i++) { ul.appendChild(document.createElement("li")); }')).to.equal('on/on on/on');
    });
  });

  lab.experiment('more built-ins', () => {
    const page = { setup: 'var value = 5, width = 32, data = []; for (var i = 0; i < 3; i++) data.push(i);' };
    const both = (code) => {
      const result = analyzeTest(page, code);
      return `${result.overall}/${result.space.overall}`;
    };

    lab.test('number, date and Intl formatting is constant', () => {
      Code.expect(both('value.toLocaleString("en-US", { minimumIntegerDigits: width, useGrouping: false });')).to.equal('o1/o1');
      Code.expect(both('new Intl.NumberFormat("en-US").format(value);')).to.equal('o1/o1');
      Code.expect(both('new Date().toISOString(); new Date(0).getFullYear(); value.toPrecision(3);')).to.equal('o1/o1');
    });

    lab.test('promises run their callback once', () => {
      Code.expect(both('Promise.resolve(1).then(function (x) { return x; });')).to.equal('o1/o1');
      Code.expect(both('Promise.resolve(1).then(function (x) { return data.slice(); });')).to.equal('on/on');
      Code.expect(both('Promise.reject(1).catch(function (x) { return x; }).finally(function () { return 1; });')).to.equal('o1/o1');
      Code.expect(both('Promise.all(data);')).to.equal('on/on');
      Code.expect(both('new Promise(function () { return data.slice(); });')).to.equal('on/on');
      Code.expect(both('new Promise();')).to.equal('o1/o1');
    });

    lab.test('timers, object helpers and trimming are known', () => {
      Code.expect(both('setTimeout(function () { return 1; }, 0); Object.hasOwn(data, "x"); Object.isFrozen(data);')).to.equal('o1/o1');
      Code.expect(both('" a ".trimStart();')).to.equal('o1/o1');
      Code.expect(both('data.trimStart();')).to.equal('on/on');
    });

    lab.test('unknown methods are still unknown', () => {
      Code.expect(both('mystery.frobnicate();')).to.equal('unknown/unknown');
      Code.expect(both('new a.b.C();')).to.equal('unknown/unknown');
      Code.expect(both('var Intl = {}; new Intl.NumberFormat();')).to.equal('unknown/unknown');
    });
  });

  lab.experiment('memory estimate', () => {
    const page = { setup: 'var data = []; for (var i = 0; i < 100; i++) data.push(i);\nfunction fact(n) { return n <= 1 ? 1 : n * fact(n - 1); }\nfunction half(a, lo, hi) { if (lo > hi) return -1; var m = (lo + hi) >>> 1; return half(a, lo, m - 1); }\nfunction fill(out, x) { out.push(x); }' };
    const space = (code, p = page) => analyzeTest(p, code).space;
    const names = (code, p = page) => space(code, p).items.filter((r) => r.kind === 'variable' && r.cls !== 'o1').map((v) => `${v.code}:${v.cls}`);

    lab.test('a collection that grows by copies holds every copy', () => {
      const loop = (body) => `var out = []; for (var i = 0; i < data.length; i++) { ${body} }`;
      // what is pushed decides the size of one step
      Code.expect(space(loop('out.push(data.slice(0));')).overall).to.equal('on2');
      Code.expect(space(loop('out.push(data.map(function (x) { return x; }));')).overall).to.equal('on2');
      Code.expect(space(loop('out.push([...data]);')).overall).to.equal('on2');
      Code.expect(space(loop('out.push(data.slice(0).slice(0));')).overall).to.equal('on2');
      Code.expect(space(loop('out.push(...data);')).overall).to.equal('on2');
      Code.expect(space(loop('out.push(Object.keys(data));')).overall).to.equal('on2');
      Code.expect(space(loop('out.push(new Array(i));')).overall).to.equal('on2');
      Code.expect(space(loop('out.push({ ...data });')).overall).to.equal('on2');
      Code.expect(space(loop('out.unshift(data.slice(0));')).overall).to.equal('on2');
      Code.expect(space(loop('out.add(data.slice(0));')).overall).to.equal('on2');
      Code.expect(space(loop('out.set(i, data.slice(0));')).overall).to.equal('on2');
      Code.expect(space(loop('out.splice(0, 0, data.slice(0));')).overall).to.equal('on2');
      Code.expect(space(loop('out[i] = data.slice(0);')).overall).to.equal('on2');
      Code.expect(space('var s = ""; for (var i = 0; i < data.length; i++) { s += "ab".repeat(data.length); }').overall).to.equal('on2');
      Code.expect(space('function copyOf(a) { return a.slice(0); } var out = []; for (var i = 0; i < data.length; i++) { out.push(copyOf(data)); }').overall).to.equal('on2');
      Code.expect(space('var out = []; for (var i = 0; i < data.length; i++) { out.push(parseInt(i)); out.push(String(i)); }').overall).to.equal('on');
      // a number, a reference, a short literal or a key is one slot
      Code.expect(space(loop('out.push(i); out.push(data); out.push(data.length); out.push([i, i]);')).overall).to.equal('on');
      Code.expect(space(loop('out.set(data.slice(0), i);')).overall).to.equal('on');
      Code.expect(space(loop('out.push();')).overall).to.equal('on');
      Code.expect(space(loop('out.push(data.indexOf(i));')).overall).to.equal('on');
      // one push outside any loop is a single copy
      Code.expect(space('var out = []; out.push(data.slice(0));').overall).to.equal('on');
      // the calls and the variable are rated the same
      Code.expect(space(loop('out.push(data.slice(0));')).items.map((c) => `${c.kind}:${c.cls}`)).to.equal(['variable:on2', 'loop:on2']);
      Code.expect(names(loop('out.push(data.slice(0));'))).to.equal(['out:on2']);
      Code.expect(names('var out = []; out.push(data.slice(0));')).to.equal(['out:on']);
      // loops multiply the step, whatever depth they are at
      Code.expect(space('var out = []; for (var i = 0; i < data.length; i++) { for (var j = 0; j < data.length; j++) { out.push(data.slice(0)); } }').overall).to.equal('on3');
      // a function that grows what it was given is seen by the loop that calls it
      Code.expect(space('function add(list, x) { list.push(x.slice(0)); } var out = []; for (var i = 0; i < data.length; i++) { add(out, data); }').overall).to.equal('on2');
      // growing by the biggest of several steps
      Code.expect(space(loop('out.push(i); out.push(data.slice(0));')).overall).to.equal('on2');
      Code.expect(space(loop('out.push(data.slice(0)); out.push(i);')).overall).to.equal('on2');
    });

    lab.test('constant memory stays constant', () => {
      Code.expect(space('data.indexOf(5); Math.max(1, 2); var k = [1, 2, 3].map(function (x) { return x; });').overall).to.equal('o1');
      Code.expect(space('Object.assign({}, data); Object.freeze(data);').overall).to.equal('o1');
    });

    lab.test('copies and growing collections cost their size', () => {
      Code.expect(space('var c = data.slice(); var m = data.map(function (x) { return x; });').overall).to.equal('on');
      Code.expect(space('var a = Array.from(data, function (x) { return x; });').overall).to.equal('on');
      Code.expect(space('var s = [...data]; var o = { ...data };').overall).to.equal('on');
      Code.expect(space('data.sort(); data.forEach(function (x) { return x; });').overall).to.equal('on');
      Code.expect(space('var out = []; for (var i = 0; i < data.length; i++) { out.push(i); }').overall).to.equal('on');
      Code.expect(space('var str = ""; for (var i = 0; i < data.length; i++) { str += "x"; str = str + "y"; }').overall).to.equal('on');
      Code.expect(space('var a = []; for (var i = 0; i < data.length; i++) { a = a.concat([i]); a = [...a, i]; a[i + 1] = 1; }').overall).to.equal('on');
      Code.expect(space('var m = []; for (var i = 0; i < data.length; i++) { for (var j = 0; j < data.length; j++) { m.push(i); } }').overall).to.equal('on2');
      Code.expect(space('var m = []; for (var i = 0; i < data.length; i++) { for (var j = 0; j < data.length; j++) { m.push(i); } m.splice(0, 0, 1, 2); }').overall).to.equal('on2');
    });

    lab.test('temporaries and per-iteration collections are not multiplied by the loop', () => {
      Code.expect(space('for (var i = 0; i < data.length; i++) { var t = data.slice(); }').overall).to.equal('on');
      Code.expect(space('for (var i = 0; i < data.length; i++) { var t = []; t.push(i); }').overall).to.equal('o1');
      Code.expect(space('for (var i = 0; i < data.length; i++) { var t = []; for (var j = 0; j < data.length; j++) { t.push(j); } }').overall).to.equal('on');
      Code.expect(space('for (var i = 0; i < data.length; i++) { for (var j = 0; j < data.length; j++) { var t = []; t.push(j); } }').overall).to.equal('o1');
      Code.expect(space('while (data.length > 1) { data.pop(); }').overall).to.equal('o1');
    });

    lab.test('growth through a called function reaches the calling loop', () => {
      const out = space('var r = []; for (var i = 0; i < data.length; i++) { fill(r, i); }');
      Code.expect(out.overall).to.equal('on');
      Code.expect(space('for (var i = 0; i < data.length; i++) { var q = []; fill(q, i); }').overall).to.equal('o1');
    });

    lab.test('recursion costs its depth', () => {
      Code.expect(space('fact(data.length);').overall).to.equal('on');
      Code.expect(space('half(data, 0, data.length);').overall).to.equal('ologn');
    });

    lab.test('unknown calls are unknown', () => {
      Code.expect(space('mystery(data);').overall).to.equal('unknown');
      Code.expect(analyzeTest(page, 'var = ;').space).to.equal({ overall: 'unknown', items: [] });
    });

    lab.test('lists every place the test body allocates, in the order it does', () => {
      const rows = (code, options) => analyzeTest(page, code, options).space.items.map((r) => `${r.kind}:${r.code}:${r.cls}`);
      Code.expect(rows('function a() {} var b = function () {}; var c = () => 1; var total = 0; data.sort();')).to.equal(['functions:3 functions:o1', 'variable:total:o1', 'call:data.sort():on']);
      Code.expect(rows('function a() {}')).to.equal(['functions:1 function:o1']);
      // a variable takes the size of what it was set to, and of what loops add to it
      Code.expect(rows('var a = data.slice(); var b = []; for (var i = 0; i < data.length; i++) { b.push(data.slice(0)); }')).to.equal(['variable:a:on', 'variable:b:on2', 'loop:for (var i = 0; i < data.length; i++):on2']);
      Code.expect(rows('var [x, , y = 1] = data.slice(); var { z, k: w, ...rest } = {}; var [[deep]] = [[1]];')).to.equal(['variable:x:o1', 'variable:y:o1', 'variable:z:o1', 'variable:w:o1', 'variable:rest:o1', 'variable:deep:o1']);
      // loops of every kind, with their header; a do-while is written the other way round
      Code.expect(rows('var i = 0; do { i++; } while (i < data.length); while (i--) {} for (var k in data) {} for (var v of data) {}')).to.equal([
        'variable:i:o1', 'loop:do … while (i < data.length):o1', 'loop:while (i--):o1', 'loop:for (var k in data):o1', 'loop:for (var v of data):o1']);
      const long = 'someVeryLongVariableName';
      Code.expect(rows(`for (var ${long} = 0; ${long} < data.length * data.length + data.length + data.length + data.length + data.length + data.length + data.length; ${long}++) {}`)[0]).to.match(/^loop:for \(var someVeryLongVariableName = 0; .{100,}\.\.\.:o1$/);
      // calls outside of declarations and loops
      Code.expect(rows('if (data.length) { data.slice(); } sink = data.map(function (x) { return x; });')).to.equal(['call:data.slice():on', 'call:data.map(function (x) { return x; }):on']);
      // only as many rows as fit
      const many = Array.from({ length: 30 }, (_, i) => `var v${i} = 1;`).join(' ');
      const listed = analyzeTest(page, many).space;
      Code.expect(listed.items.length).to.equal(24);
      Code.expect(listed.more).to.equal(6);
    });

    lab.test('opens a variable into the call that set it, and a loop into what a pass calls', () => {
      const items = analyzeTest(page, 'var copy = data.slice().sort(); var n = 3; for (var i = 0; i < data.length; i++) { data.indexOf(i); }').space.items;
      Code.expect(items[0].steps.map((s) => s.name)).to.equal(['copy elements to a work list', 'merge sort the runs', 'write the order back']);
      Code.expect(items[1].steps).to.be.undefined();
      Code.expect(items[2].steps.map((s) => `${s.name}:${s.cls}`)).to.equal(['data.indexOf:o1']);
    });

    lab.test('is laid out for reading when presented: one argument to a line, one clause to a line', () => {
      const laid = (code) => present({ overall: 'o1', calls: [{ code, cls: 'o1' }] }).calls[0].code;
      Code.expect(laid('copperKettle(sharedData)')).to.equal('copperKettle(\n\tsharedData\n)');
      Code.expect(laid('velvetHammer(lookup, targetKeys[k])')).to.equal('velvetHammer(\n\tlookup,\n\ttargetKeys[k]\n)');
      // the call that closes the text is the one laid out; commas inside brackets, braces, calls and strings do not split
      Code.expect(laid('data.slice(0).sort(function (a, b) { return a - b; })')).to.equal('data.slice(0).sort(\n\tfunction (a, b) { return a - b; }\n)');
      Code.expect(laid('out.set("a,b", [1, 2], { x: f(1, 2) }, \'it\\\'s, ok\', `t,x`)')).to.equal('out.set(\n\t"a,b",\n\t[1, 2],\n\t{ x: f(1, 2) },\n\t\'it\\\'s, ok\',\n\t`t,x`\n)');
      Code.expect(laid('new Map(a, b)')).to.equal('new Map(\n\ta,\n\tb\n)');
      // loops: a for loop one clause to a line, the others as one
      Code.expect(laid('for (var k = 0; k < targetKeys.length; k++)')).to.equal('for (\n\tvar k = 0;\n\tk < targetKeys.length;\n\tk++\n)');
      Code.expect(laid('for (var k in data)')).to.equal('for (\n\tvar k in data\n)');
      Code.expect(laid('while (i--)')).to.equal('while (\n\ti--\n)');
      Code.expect(laid('do … while (i < data.length)')).to.equal('do … while (\n\ti < data.length\n)');
      // nothing to lay out: no arguments, no clauses, no parentheses, a group that does not close the text, one that was cut short
      Code.expect(laid('foo()')).to.equal('foo()');
      Code.expect(laid('for (;;)')).to.equal('for (;;)');
      Code.expect(laid('lookup')).to.equal('lookup');
      Code.expect(laid('3 functions')).to.equal('3 functions');
      Code.expect(laid('a(b).c')).to.equal('a(b).c');
      Code.expect(laid('for (var i = 0; i < data....')).to.equal('for (var i = 0; i < data....');
      Code.expect(laid(')(')).to.equal(')(');
    });

    lab.test('calls and variables are rated', () => {
      const out = space('var out = []; var small = 1; var c = data.slice(); for (var i = 0; i < data.length; i++) { out.push(i); }');
      Code.expect(out.items.map((c) => `${c.kind}:${c.code}:${c.cls}`)).to.equal(['variable:out:on', 'variable:small:o1', 'variable:c:on', 'loop:for (var i = 0; i < data.length; i++):on']);
      Code.expect(names('var out = []; var small = 1; var c = data.slice(); for (var i = 0; i < data.length; i++) { out.push(i); }')).to.equal(['out:on', 'c:on']);
      Code.expect(names('function f() { var inner = data.slice(); } this.x.push(1); getList().push(1); f();')).to.equal([]);
    });

    lab.test('recognises the other ways of growing a collection', () => {
      const loop = (body) => `var a = []; var s = \`t\`; var q = 'q'; var o = {}; var u = 0; for (var i = 0; i < data.length; i++) { ${body} }`;
      Code.expect(space(loop('[a, o] = [o, a];')).overall).to.equal('o1');
      Code.expect(space(loop('o.k = 1; u += 1; u = u + 1; a.length = 0; a[0] = 1;')).overall).to.equal('o1');
      Code.expect(space(loop('s += i;')).overall).to.equal('on');
      Code.expect(space(loop('q = q + i;')).overall).to.equal('on');
      Code.expect(space(loop('q = i; a = [...[1], 1]; a = [, 1]; a = [1].concat(a);')).overall).to.equal('o1');
      Code.expect(space(loop('a = [...a, i];')).overall).to.equal('on');
      Code.expect(space(loop('a.splice(0, 0, i);')).overall).to.equal('on');
      Code.expect(space(loop('[1, 2].splice(0, 1);')).overall).to.equal('o1');
      Code.expect(space(loop('o[i] = i;')).overall).to.equal('on');
      Code.expect(space(loop('q = (q + "x") + i; q = u + q; q = q + u;')).overall).to.equal('on');
      Code.expect(space(loop('u = u + q;')).overall).to.equal('o1');
      Code.expect(space(loop('u -= 1; u *= 2; u = u.toString(); u = parseInt(u); u += i + 1;')).overall).to.equal('o1');
      Code.expect(space(loop('u += i + "x"; u += "x" + i;')).overall).to.equal('on');
      Code.expect(space('var w; for (var i = 0; i < n; i++) { w += "a"; z += "a"; z = z + "a"; }').overall).to.equal('on');
      Code.expect(space('var w; for (var i = 0; i < n; i++) { w = w + i; z = z + i; }').overall).to.equal('o1');
    });

    lab.test('writing into an array that already has its size is not growth', () => {
      const loops = (init) => `${init} for (var i = 0; i < data.length; i++) { for (var j = 0; j < data.length; j++) { a[j + 1] = a[j]; } }`;
      Code.expect(space(loops('var a = data.slice();')).overall).to.equal('on');
      Code.expect(space(loops('var a = new Array(data.length);')).overall).to.equal('on');
      Code.expect(space(loops('function f(a) {') + ' } f(data);').overall).to.equal('o1');
      Code.expect(space(loops('var a = Object.create(null);')).overall).to.equal('on2');
      Code.expect(space(loops('var a = new Array();')).overall).to.equal('on2');
      Code.expect(space(loops('var a = {};')).overall).to.equal('on2');
      Code.expect(space(loops('var a;')).overall).to.equal('on2');
      Code.expect(space(loops('')).overall).to.equal('o1');
      Code.expect(space('for (var i = 0; i < data.length; i++) { new Foo()[i] = 1; }').overall).to.equal('unknown');
      Code.expect(space(loops('var a = Math.abs(1); var b = new Array(3); var d = [].concat();')).overall).to.equal('o1');
      Code.expect(space(loops('function a() {}')).overall).to.equal('o1');
      Code.expect(space(loops('var a = new Set();')).overall).to.equal('o1');
      Code.expect(space(loops('var a = Object.is(1, 2);')).overall).to.equal('o1');
      Code.expect(space(loops('function g() { return 1; } var a = g();')).overall).to.equal('o1');
    });

    lab.test('growth inside functions is attributed to the right collection', () => {
      const grow = { setup: 'var shared = [];\nfunction keep(x) { shared.push(x); }\nfunction local(x) { var l = []; l.push(x); return l; }\nfunction into(target, x, extra) { target.push(x); }' };
      Code.expect(space('for (var i = 0; i < 9; i++) { keep(i); } for (var j = 0; j < n; j++) { keep(j); }', grow).overall).to.equal('on');
      Code.expect(space('for (var i = 0; i < n; i++) { local(i); }', grow).overall).to.equal('o1');
      Code.expect(space('var mine = []; for (var i = 0; i < n; i++) { into(mine, i); }', grow).overall).to.equal('on');
      Code.expect(space('var mine = []; for (var i = 0; i < n; i++) { into(); }', grow).overall).to.equal('on');
    });

    lab.test('stops on hostile input', () => {
      const deep = '['.repeat(300) + ']'.repeat(300);
      Code.expect(analyzeTest(page, 'var x = ' + deep + ';').space.overall).to.be.a.string();
      Code.expect(analyzeTest(page, 'var a = []; for (var i = 0; i < n; i++) { a.push(i); }', { maxSteps: 5 }).space.overall).to.equal('unknown');
    });

    lab.test('is presented with the call ratings', () => {
      const shown = present(analyzeTest(page, 'var out = []; for (var i = 0; i < data.length; i++) { out.push(i); }'));
      Code.expect(shown.space.overall.cls).to.equal('on');
      Code.expect(shown.space.items.map((v) => v.code)).to.equal(['out', 'for (\n\tvar i = 0;\n\ti < data.length;\n\ti++\n)']);
      Code.expect(shown.space.items.map((v) => v.tag)).to.equal(['variable', 'loop']);
      Code.expect(shown.space.items.map((v) => Boolean(v.perPass))).to.equal([false, true]);
      Code.expect(present({ overall: 'o1', calls: [] }).space).to.be.null();
      const stored = { overall: 'on', calls: [{ code: 'a.shift()', cls: 'on' }], engines: { v8: { overall: 'o1', calls: [{ code: 'a.shift()', cls: 'o1' }] } } };
      Code.expect(present(stored).overall.cls).to.equal('on');
      Code.expect(present(stored, 'spec').overall.cls).to.equal('on');
      Code.expect(present(stored, 'v8').overall.cls).to.equal('o1');
      Code.expect(present(stored, 'v8').calls[0].cls).to.equal('o1');
      Code.expect(present({ overall: 'on', calls: [] }, 'v8').overall.cls).to.equal('on');
      Code.expect(present(null, 'v8')).to.be.null();
      Code.expect(present({ overall: 'o1', calls: [], space: { overall: 'on', items: [] } }).space.items).to.equal([]);
    });
  });

  lab.experiment('what a call is made of', () => {
    const stepsOf = (code, page = none, options) => analyzeTest(page, code, options).calls.map((c) => (c.steps || []).map((s) => `${s.name}:${s.cls}`));
    const spaceStepsOf = (code, page = none, options) => analyzeTest(page, code, options).space.items.map((c) => (c.steps || []).map((s) => `${s.name}:${s.cls}`));

    lab.test('splits a built-in into the steps of its algorithm', () => {
      Code.expect(stepsOf('data.sort(function (a, b) { return a - b; });')).to.equal([['copy elements to a work list:on', 'merge sort the runs:onlogn', 'write the order back:on']]);
      Code.expect(stepsOf('data.map(function (x) { return x * 2; });')).to.equal([['visit elements:on', 'callback per element:on', 'store results:on']]);
      Code.expect(stepsOf('data.map(function (x) { return other.indexOf(x); });')[0][1]).to.equal('callback per element:on2');
      Code.expect(stepsOf('JSON.stringify(data);')).to.equal([['walk the value graph:on', 'build the text:on']]);
      Code.expect(stepsOf('Object.keys(data);')).to.equal([['collect own keys:on', 'copy into result array:on']]);
      Code.expect(stepsOf('Array.from(data, function (x) { return x; });')).to.equal([['iterate the source:on', 'callback per element:on', 'store:on']]);
      Code.expect(stepsOf('Int8Array.from(data, function (x) { return x; });')).to.equal([['iterate the source:on', 'callback per element:on', 'store:on']]);
    });

    lab.test('measures the steps in the sizes of this call', () => {
      Code.expect(stepsOf('[3, 1, 2].sort();')).to.equal([['copy elements to a work list:o1', 'merge sort the runs:o1', 'write the order back:o1']]);
      Code.expect(stepsOf('encodeURIComponent(data);')).to.equal([['scan characters:on', 'build result:on']]);
      Code.expect(stepsOf('encodeURIComponent();')).to.equal([['scan characters:o1', 'build result:o1']]);
    });

    lab.test('shows what V8 does differently', () => {
      const pad = 'text.padStart(width);';
      Code.expect(stepsOf(pad)).to.equal([['build the fill:on', 'join with the string:on']]);
      Code.expect(stepsOf(pad, none, { engine: 'v8' })).to.equal([['build the fill by doubling:ologn', 'join into a rope:ologn']]);
      Code.expect(stepsOf('arr.shift();', none, { engine: 'v8' })).to.equal([[]]);
      Code.expect(stepsOf('var m = new Map(); m.clear();', none, { engine: 'v8' })).to.equal([[], []]);
      Code.expect(analyzeTest(none, 'data.sort();').engines.v8.calls[0].steps.length).to.equal(3);
    });

    lab.test('picks the owner of an ambiguous method from what the receiver was made from', () => {
      Code.expect(stepsOf('"a-b".split("-");')).to.equal([['scan for the pattern:o1', 'build result:o1']]);
      Code.expect(stepsOf('/a+/.exec(text);')).to.equal([['match from lastIndex:on', 'build the match array:o1']]);
      Code.expect(stepsOf('var re = /a+/; re.test(text);')[0]).to.equal(['match from lastIndex:on', 'build the match array:o1']);
      Code.expect(stepsOf('var typed = new Float64Array(8); typed.set(data);')[1]).to.equal(['read the source:on', 'write at the offset:on']);
      Code.expect(stepsOf('var set = new Set(); set.union(other);')[1]).to.equal(['visit the values:on', 'probe the other set:on', 'store the result:on']);
      Code.expect(stepsOf('(7).toFixed(2); `x`.padStart(3);')).to.equal([[], ['build the fill:o1', 'join with the string:o1']]);
    });

    lab.test('splits a function the page defined into its loops and calls', () => {
      const page = {
        setup: 'function work(a) { var s = 0; for (var i = 0; i < a.length; i++) { s += a[i]; } a.sort(); return s; }\n' +
          'function twice(a) { return work(a) + work(a); }\nvar tools = { run: function (a) { a.slice(0); a.reverse(); } };\nvar quick = (a) => a.indexOf(1);'
      };
      Code.expect(stepsOf('work(data);', page)).to.equal([['for loop:on', 'a.sort:onlogn']]);
      Code.expect(stepsOf('twice(data);', page)).to.equal([['work:onlogn', 'work:onlogn']]);
      Code.expect(stepsOf('tools.run(data);', page)).to.equal([['a.slice:on', 'a.reverse:on']]);
      Code.expect(stepsOf('quick(data);', page)).to.equal([['a.indexOf:on']]);
      Code.expect(stepsOf('(function (a) { a.sort(); })(data);')).to.equal([['a.sort:onlogn']]);
    });

    lab.test('names loops and calls the way they are written', () => {
      const page = {
        setup: 'function loops(a, k) { for (var i in a) { k(); } for (var x of a) { k(); } while (a.length) { a.pop(); } do { a.pop(); } while (a.length); }\n' +
          'function calls(a, k) { new Map(a); new a.Thing(); a[0](); k()(); (a || b).run(); [1, 2].map(k); Math.max(1, 2); }\n' +
          'function many(a) { a.sort(); a.sort(); a.sort(); a.sort(); a.sort(); a.sort(); a.sort(); a.sort(); a.sort(); a.sort(); }'
      };
      const names = (code) => analyzeTest(page, code).calls[0].steps.map((s) => s.name);
      Code.expect(names('loops(data, f);')).to.equal(['for…in loop', 'for…of loop', 'while loop', 'do…while loop']);
      Code.expect(names('calls(data, f);')).to.equal(['new Map', 'new …', 'call', 'call', '.run', '.map', 'Math.max']);
      Code.expect(names('many(data);')).to.equal(Array(8).fill('a.sort'));
      Code.expect(analyzeTest(page, 'many(data);').calls[0].moreSteps).to.equal(2);
    });

    lab.test('opens a step that is a call into the steps of that call', () => {
      const code = 'function leaf(a) { return a.slice(0).sort(); } function mid(a) { var t = leaf(a); for (var i = 0; i < a.length; i++) { t.indexOf(a[i]); } return t; } mid(arr);';
      const nested = (steps) => steps.map((s) => (s.steps ? `${s.name}:${s.cls}[${nested(s.steps)}]` : `${s.name}:${s.cls}`)).join(', ');
      const { calls, space } = analyzeTest(none, code);
      Code.expect(nested(calls[0].steps)).to.equal(
        'leaf:onlogn[.sort:onlogn[copy elements to a work list:on, merge sort the runs:onlogn, write the order back:on]], for loop:on2[t.indexOf:on]');
      Code.expect(nested(space.items.find((r) => r.kind === 'call').steps)).to.equal(
        't:on[.sort:on[copy elements to a work list:on, merge sort the runs:on, write the order back:o1]], for loop:o1[t.indexOf:o1], return t:on');
    });

    lab.test('opens only as many steps as it shows', () => {
      const calls = Array.from({ length: 10 }, (_, i) => `h(${i});`).join(' ');
      const [row] = analyzeTest(none, `function h(x) { return x.slice(0).sort(); } function f(a) { ${calls} } f(data);`).calls;
      Code.expect(row.steps.length).to.equal(8);
      Code.expect(row.moreSteps).to.equal(2);
      Code.expect(row.steps.every((s) => s.steps.length === 1)).to.be.true();
    });

    lab.test('opens a loop into what one pass of it calls, shared functions included', () => {
      const page = { initHTML: '<script>function cheap(v) { return v + 1; } function heavy(a) { for (var i = 0; i < a.length; i++) {} }</script>' };
      const steps = (code) => analyzeTest(page, code).calls[0].steps;
      const loop = steps('function f(arr) { for (var i = 0; i < arr.length; i++) { cheap(arr[i]); heavy(arr); } } f(data);')[0];
      Code.expect(loop).to.include({ name: 'for loop', cls: 'on2', perPass: true });
      Code.expect(loop.steps.map((s) => `${s.name}:${s.cls}`)).to.equal(['cheap:o1', 'heavy:on']);
      // loops inside loops, a while with a single statement as its body, and the nesting limit
      Code.expect(steps('function f(arr) { for (var i = 0; i < arr.length; i++) { for (var j = 0; j < arr.length; j++) { cheap(j); } } } f(data);')[0].steps[0]).to.include({ name: 'for loop', perPass: true, cls: 'on' });
      Code.expect(steps('function f(arr) { var i = 0; while (i < arr.length) cheap(i++); } f(data);')[0].steps.map((s) => s.name)).to.equal(['cheap']);
      const deep = steps('function f(arr) { for (var a = 0; a < 2; a++) { for (var b = 0; b < 2; b++) { for (var c = 0; c < 2; c++) { for (var d = 0; d < 2; d++) { cheap(d); } } } } } f(data);');
      const depth = (list) => (list && list.length ? 1 + Math.max(...list.map((s) => depth(s.steps))) : 0);
      Code.expect(depth(deep)).to.equal(3);
    });

    lab.test('does not open a function inside itself, nor deeper than the nesting limit', () => {
      Code.expect(analyzeTest(none, 'function f(n) { return f(n - 1); } f(5);').calls[0].steps).to.equal([{ name: 'f', cls: 'o1' }]);
      const code = 'function a(x) { return b(x); } function b(x) { return c(x); } function c(x) { return d(x); } function d(x) { return x.sort(); } a(arr);';
      const depth = (steps) => (steps && steps.length ? 1 + Math.max(...steps.map((s) => depth(s.steps))) : 0);
      Code.expect(depth(analyzeTest(none, code).calls[0].steps)).to.equal(3);
    });

    lab.test('leaves single operations alone', () => {
      Code.expect(stepsOf('Math.max(1, 2);')).to.equal([[]]);
      Code.expect(stepsOf('data.push(1);')).to.equal([[]]);
      Code.expect(stepsOf('unknownFunction(data);')).to.equal([[]]);
      Code.expect(stepsOf('obj.size();')).to.equal([[]]);
      Code.expect(stepsOf('Math.max.apply(null, data); fn.call(data);')).to.equal([[], []]);
      Code.expect(stepsOf('var holder; holder.push(1);')).to.equal([[]]);
      Code.expect(stepsOf('helper.bind(null);', { setup: 'function helper() {}' })).to.equal([[]]);
      Code.expect(stepsOf('data[0]();')).to.equal([[]]);
      Code.expect(stepsOf('new Thing(data);')).to.equal([[]]);
      Code.expect(stepsOf('new data.Thing();')).to.equal([[]]);
    });

    lab.test('gives steps whose cost is unknown the unknown class', () => {
      Code.expect(stepsOf('eval(code);')).to.equal([['parse source:on', 'run it:unknown']]);
      Code.expect(stepsOf('data.map(callback);')[0][1]).to.equal('callback per element:unknown');
      Code.expect(stepsOf('data.sort(callback);')[0][1]).to.equal('merge sort the runs:unknown');
    });

    lab.test('shows steps for the DOM', () => {
      Code.expect(stepsOf('parent.appendChild(frag);')).to.equal([['visit the subtree being moved:on', 'link it in:o1']]);
      Code.expect(stepsOf('parent.appendChild(document.createElement("a"));')).to.equal([['visit the subtree being moved:o1', 'link it in:o1']]);
      Code.expect(stepsOf('parent.insertAdjacentHTML("beforeend", html);')).to.equal([['parse the markup:on', 'insert the nodes:on']]);
      Code.expect(stepsOf('parent.insertAdjacentHTML("beforeend");')).to.equal([['parse the markup:o1', 'insert the nodes:o1']]);
    });

    lab.test('splits memory the same way', () => {
      Code.expect(spaceStepsOf('data.sort(function (a, b) { return a - b; });')).to.equal([['copy elements to a work list:on', 'merge sort the runs:on', 'write the order back:o1']]);
      Code.expect(spaceStepsOf('data.map(function (x) { return x; });')).to.equal([['visit elements:o1', 'callback per element:o1', 'store results:on']]);
      const page = { setup: 'function build(a) { var out = []; for (var i = 0; i < a.length; i++) { out.push(a[i]); } return out.slice(0); }' };
      Code.expect(spaceStepsOf('build(data);', page)).to.equal([['out:on', 'for loop:on', 'out.slice:on']]);
    });

    lab.test('names the steps of memory after what is allocated, and says what is handed back', () => {
      const steps = (code, p = none) => {
        const walk = (list) => list.map((s) => `${s.name}:${s.cls}${s.steps ? `[${walk(s.steps)}]` : ''}`).join(', ');
        return walk(analyzeTest(p, code).space.items.find((r) => r.kind === 'variable').steps || []);
      };
      // a variable is a step with what it ends up holding; the loop that fills it, and what is returned, are steps too
      Code.expect(steps('function f(a) { var table = {}; for (var i = 0; i < a.length; i++) { table[a[i]] = i; } return table; } var r = f(data);')).to.equal('table:on, for loop:on, return table:on');
      // parameters are inputs and are not listed; a returned name that holds nothing is not a step
      Code.expect(steps('function f(a) { var n = 0; return n; } var r = f(data);')).to.equal('n:o1');
      Code.expect(steps('function f(a) { return a; } var r = f(data);')).to.equal('');
      // functions created inside are one step, and a step that is a call opens
      Code.expect(steps('function f(a) { function g() {} var h = function () {}; var k = () => 1; var c = a.slice(0); return c; } var r = f(data);')).to.equal('3 functions:o1, c:on, return c:on');
      Code.expect(steps('function f(a) { function g() {} return a.slice(0); } var r = f(data);')).to.equal('1 function:o1, a.slice:on');
      Code.expect(steps('function f(a) { var [x, { y }] = a; var c = a.slice(0).sort(); } var r = f(data);')).to.equal('x:o1, y:o1, c:on[copy elements to a work list:on, merge sort the runs:on, write the order back:o1]');
      // a declaration without a value, a constructor call, a bare return, and a return of something that is not a name
      Code.expect(steps('function f(a) { var x; var m = new Map(a); return; } var r = f(data);')).to.equal('x:o1, m:on');
      Code.expect(steps('function f(a) { var x = 1; return x + a.length; } var r = f(data);')).to.equal('x:o1');
      // a loop with a single statement for a body, and an arrow function that is its own body
      Code.expect(steps('function f(a) { var i = 0; while (i < a.length) i++; } var r = f(data);')).to.equal('i:o1, while loop:o1');
      Code.expect(steps('var f = (a) => a.slice(0); var r = f(data);')).to.equal('a.slice:on');
    });

    lab.test('is carried to the page by present(), capped and cleaned', () => {
      const shown = present(analyzeTest(none, 'data.sort();'));
      Code.expect(shown.calls[0].steps.map((s) => [s.step, s.cls, s.label])).to.equal([
        ['copy elements to a work list', 'on', 'O(n)'], ['merge sort the runs', 'onlogn', 'O(n log n)'], ['write the order back', 'on', 'O(n)']
      ]);
      Code.expect(shown.calls[0].moreSteps).to.equal(0);
      Code.expect(shown.calls[0].end).to.be.true();
      Code.expect(shown.rows).to.equal(1);
      Code.expect(shown.space.rows).to.equal(shown.space.items.length);

      const messy = present({
        overall: 'on',
        calls: [{ code: 'a()', cls: 'on', steps: [{ name: 'x'.repeat(80), cls: 'bogus' }].concat(Array(20).fill({ name: 'y', cls: 'o1' })), moreSteps: '3' }, { code: 'b()', cls: 'o1', steps: 'nope' }],
        more: 2
      });
      Code.expect(messy.calls[0].steps.length).to.equal(8);
      Code.expect(messy.calls[0].steps[0].step.length).to.equal(40);
      Code.expect(messy.calls[0].steps[0].cls).to.equal('unknown');
      Code.expect(messy.calls[0].moreSteps).to.equal(3);
      Code.expect(messy.calls[1].steps).to.not.exist();
      Code.expect(messy.rows).to.equal(3);
      Code.expect(messy.calls.map((c) => c.end)).to.equal([false, false]);
    });

    lab.test('cannot break the answer when the budget runs out', () => {
      const page = { setup: 'function work(a) { for (var i = 0; i < a.length; i++) { a.sort(); } a.map(work); }' };
      Code.expect(analyzeTest(page, 'work(data);', { maxSteps: 60 }).overall).to.be.a.string();
    });
  });

  lab.experiment('chart classes', () => {
    lab.test('every class the algebra can produce has a curve, a label and a name', () => {
      const seen = new Set();
      for (let n = 0; n <= 5; n++) {
        for (let l = 0; l <= 3; l++) {
          seen.add(classify({ n, l }));
        }
      }

      seen.add(classify({ n: 99, l: 0 }));
      seen.add(classify(null));
      Code.expect([...seen].sort()).to.equal(Object.keys(complexity.CLASSES).sort());
      for (const info of Object.values(complexity.CLASSES)) {
        Code.expect(info.curve).to.match(/^curve-[a-z0-9]+$/);
        Code.expect(info.label).to.be.a.string();
        Code.expect(info.name).to.be.a.string();
      }
    });

    lab.test('keeps exponential results apart from polynomial ones', () => {
      Code.expect(overall('function g(n) { if (n < 1) return; g(n - 1); g(n - 1); } g(10);')).to.equal('oexp');
      Code.expect(overall('for (var i = 0; i < n; i++) { for (var j = 0; j < n; j++) { for (var k = 0; k < n; k++) { for (var l = 0; l < n; l++) { y++; } } } }')).to.equal('higher');
    });
  });
});
