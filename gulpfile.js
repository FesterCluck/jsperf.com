'use strict';

// Derived from https://github.com/jsperf/benchmark.js-wrapper (gulpfile.js)

const fs = require('node:fs/promises');
const path = require('node:path');
const { series, parallel, src, dest } = require('gulp');
const cleanCSS = require('gulp-clean-css');
const rename = require('gulp-rename');

const root = __dirname;

// each entry is [pattern, replacement]; applied in order, like gulp-replace did
const replacements = [
  // jsPerf is browser-only. Ensure we are detected as a browser environment,
  // even if this is an AMD test, for example.
  [/freeDefine = (?:[^;]+)/, 'freeDefine = false'],
  [/freeExports = (?:[^;]+)/, 'freeExports = false'],
  [/freeModule = (?:[^;]+)/, 'freeModule = false'],
  [/freeRequire = (?:[^;]+)/, 'freeRequire = false'],
  [/(if\s*\()(typeof define|freeDefine)\b/, '$1false'],

  // Specify the correct path to our CSS file.
  ['href = \'main.css\'', 'href = \'/public/_css/main.src.css\''],

  // Avoid exposing `_` and `platform` as global variables.
  ['root.platform = parse()', 'platform = parse()'],
  ['var _ = runInContext()', '_ = runInContext()'],
  ['var _ = context && context._ || require(\'lodash\') || root._;', ''],
  ['(freeWindow || freeSelf || {})._ = _', ''],
  ['root._ = _', ''],

  // Ensure that Benchmark.js uses the local copies of lodash and Platform.js.
  ['var _ = context && context._ || req(\'lodash\') || root._;', ''],
  ['\'platform\': context.platform', '\'platform\': platform']
];

// Builds public/_js/frame.js, which runs inside the sandboxed test frame: lodash + platform + benchmark +
// client/runner.js
async function frameJs () {
  const files = [
    require.resolve('lodash'),
    require.resolve('platform'),
    require.resolve('benchmark'),
    path.join(root, 'client', 'runner.js')
  ];
  const parts = await Promise.all(files.map((f) => fs.readFile(f, 'utf8')));
  // gulp-concat joined with a newline
  let code = parts.join('\n');

  for (const [pattern, value] of replacements) {
    // string patterns replace every occurrence (current lodash has two `root._ = _`)
    code = typeof pattern === 'string' ? code.replaceAll(pattern, value) : code.replace(pattern, value);
  }

  code = `(function(){var _,platform;${code}}.call(this))`;

  const out = path.join(root, 'public', '_js');
  await fs.mkdir(out, { recursive: true });
  await fs.writeFile(path.join(out, 'frame.js'), code);
}

// Builds public/_js/test.js, the test page's side: client/ui.js on its own, it never runs user code
async function pageJs () {
  const out = path.join(root, 'public', '_js');
  await fs.mkdir(out, { recursive: true });
  await fs.copyFile(path.join(root, 'client', 'ui.js'), path.join(out, 'test.js'));
}

const js = parallel(frameJs, pageJs);

function css () {
  return src('public/_css/main.src.css')
    .pipe(cleanCSS({ rebase: false }))
    .pipe(rename('main.css'))
    .pipe(dest('public/_css/'));
}

exports.js = js;
exports.css = css;
exports.default = series(parallel(js, css));
