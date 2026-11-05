const Lab = require('@hapi/lab');
const Code = require('@hapi/code');

const cleanJsString = require('../../../../templates/helpers/cleanJsString');

const lab = exports.lab = Lab.script();

lab.experiment('Template Helper cleanJsString', function () {
  lab.test('Test jsesc', async function () {
    Code.expect(cleanJsString('Ich ♥ Bücher')).to.equal('\'Ich \\u2665 B\\xFCcher\'');
  });

  lab.test('Remove <script>', async function () {
    Code.expect(cleanJsString('<script>var i=0;</script>')).to.equal('\'<script>var i=0;<\\/script>\'');
    Code.expect(cleanJsString('<script>var i=0;')).to.equal('\'<script>var i=0;\'');
    Code.expect(cleanJsString('var i=0;</script>')).to.equal('\'var i=0;<\\/script>\'');
  });

  lab.test('Real example', async function () {
    const cleanJs = 'var i = arr.length;' +
    'while (i--) {' +
    'arr[i].toLowerCase().replace(/[^a-z0-9-]+/g, \'-\').replace(/[-]+/g, \'-\').replace(/^-|-$/g, \'\');' +
    '};';
    const cleanJsExpected = '\'var i = arr.length;while (i--) {arr[i].toLowerCase().replace(/[^a-z0-9-]+/g, \\\'-\\\').replace(/[-]+/g, \\\'-\\\').replace(/^-|-$/g, \\\'\\\');};\'';
    Code.expect(cleanJsString(cleanJs)).to.equal(cleanJsExpected);
  });
});
