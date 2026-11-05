const Lab = require('@hapi/lab');
const Code = require('@hapi/code');

const indent = require('../../../../templates/helpers/indent');

const lab = exports.lab = Lab.script();

lab.experiment('Template Helper indent', function () {
  lab.test('indents each new line two spaces', async function () {
    Code.expect(indent('some\nplain\ntext')).to.equal('  some\n  plain\n  text');
  });
});
