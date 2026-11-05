const Lab = require('@hapi/lab');
const Code = require('@hapi/code');

const addCode = require('../../../../templates/helpers/addCode');

const lab = exports.lab = Lab.script();

lab.experiment('Template Helper addCode', function () {
  lab.test('replaces a set of backticks with code markup', async function () {
    const res = addCode('My `pretty` title');
    Code.expect(res).to.be.an.object();
    Code.expect(res.string).to.equal('My <code>pretty</code> title');
  });

  lab.test('replaces multiple sets of backticks with code markup', async function () {
    const res = addCode('My `pretty` title with multiple `code` spans');
    Code.expect(res).to.be.an.object();
    Code.expect(res.string).to.equal('My <code>pretty</code> title with multiple <code>code</code> spans');
  });

  lab.test('escapes HTML in the text and inside the code spans', async function () {
    const res = addCode('<img src=x onerror=alert(1)> & `<b>bold</b>`');
    Code.expect(res.string).to.equal('&lt;img src&#x3D;x onerror&#x3D;alert(1)&gt; &amp; <code>&lt;b&gt;bold&lt;/b&gt;</code>');
  });

  lab.test('leaves an unmatched backtick alone', async function () {
    Code.expect(addCode('a ` b').string).to.equal('a &#x60; b');
  });

  lab.test('treats a missing value as empty', async function () {
    Code.expect(addCode(undefined).string).to.equal('');
  });
});
