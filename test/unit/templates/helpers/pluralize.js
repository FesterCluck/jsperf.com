const Lab = require('@hapi/lab');
const Code = require('@hapi/code');

const pluralize = require('../../../../templates/helpers/pluralize');

const lab = exports.lab = Lab.script();

lab.experiment('Template Helper pluralize', function () {
  lab.test('pluralizes term when num is zero', async function () {
    Code.expect(pluralize(0, 'thing')).to.equal('0 things');
  });

  lab.test('keep term when num is one', async function () {
    Code.expect(pluralize(1, 'thing')).to.equal('1 thing');
  });

  lab.test('pluralizes term when num is greater than one', async function () {
    Code.expect(pluralize(2, 'thing')).to.equal('2 things');
  });
});
