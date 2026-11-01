const Lab = require('@hapi/lab');
const Code = require('@hapi/code');

const datetoISOString = require('../../../../templates/helpers/DatetoISOString');

const lab = exports.lab = Lab.script();

lab.experiment('Template Helper DatetoISOString', function () {
  lab.test('converts Date to ISO String', async function () {
    const d = new Date();
    Code.expect(datetoISOString(d)).to.equal(d.toISOString());
  });
});
