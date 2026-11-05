'use strict';

// Copies third-party browser assets from node_modules into public/_vendor
// so they are self-hosted instead of loaded from a CDN.

const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const out = path.join(root, 'public', '_vendor');

const modulePath = (spec) => path.dirname(require.resolve(`${spec}/package.json`, { paths: [root] }));

const hljs = modulePath('highlight.js');
const fa = modulePath('font-awesome');
const jquery = modulePath('jquery');

const files = [
  [path.join(jquery, 'dist', 'jquery.min.js'), 'jquery/jquery.min.js'],
  [path.join(hljs, 'styles', 'default.min.css'), 'highlight.js/default.min.css'],
  [path.join(fa, 'css', 'font-awesome.min.css'), 'font-awesome/css/font-awesome.min.css']
];

for (const f of fs.readdirSync(path.join(fa, 'fonts'))) {
  files.push([path.join(fa, 'fonts', f), `font-awesome/fonts/${f}`]);
}

for (const [src, dest] of files) {
  const target = path.join(out, dest);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(src, target);
}

console.log(`Copied ${files.length} vendor files to ${path.relative(root, out)}`);
