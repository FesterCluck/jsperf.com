const Lab = require('@hapi/lab');
const Code = require('@hapi/code');
const markdown = require('../../../../templates/helpers/markdown');

const { experiment, test } = exports.lab = Lab.script();

experiment('Template Helper markdown', function () {
  test('returns marked safe string', async function () {
    const res = markdown('hello **world**');

    Code.expect(res.toString()).to.equal('<p>hello <strong>world</strong></p>\n');
  });

  test('remove script tags', async function () {
    const res = markdown('<script language="javascript">window.location.href = "http://example.com"</script>');

    Code.expect(res.toString()).to.equal('');
  });

  test('remove CDATA scripts', async function () {
    const res = markdown(`<script type="text/javascript">// <![CDATA[
           window.location = "http://example.com/"
// ]]></script>`);

    Code.expect(res.toString()).to.equal('');
  });

  test('remove malicious img tag', async function () {
    const res = markdown('<img alt="" onerror="document.location=\'http://example.com/\';" src="goodlion80_files/sfs.htm" />');

    Code.expect(res.toString()).to.equal('<img alt="" src="goodlion80_files/sfs.htm" />');
  });

  test('remove meta refresh tag', async function () {
    const res = markdown('<meta http-equiv="refresh" content="0;http://example.com"/>');

    Code.expect(res.toString()).to.equal('');
  });
});

experiment('Template Helper markdown code', function () {
  test('highlights known languages', async function () {
    const res = markdown('```js\nconst a = 1;\n```');

    Code.expect(res.toString()).to.include('hljs-keyword');
  });

  test('leaves unknown languages unhighlighted', async function () {
    const res = markdown('```nope-lang\nx\n```');

    Code.expect(res.toString()).to.include('<code');
  });

  test('handles empty content', async function () {
    Code.expect(markdown().toString()).to.equal('');
  });

  test('handles code blocks without a language', async function () {
    Code.expect(markdown('```\nx\n```').toString()).to.include('<code>');
  });
});
