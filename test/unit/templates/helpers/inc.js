const Lab = require('@hapi/lab');
const Code = require('@hapi/code');

const inc = require('../../../../templates/helpers/inc');

const lab = exports.lab = Lab.script();

lab.experiment('Template Helper inc', function () {
  lab.test('increments argument', async function () {
    Code.expect(inc(1)).to.equal(2);
  });
});
