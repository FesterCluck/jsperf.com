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
});
