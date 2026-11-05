const Lab = require('@hapi/lab');
const Code = require('@hapi/code');

const defaults = require('../../../../server/lib/defaults');

const lab = exports.lab = Lab.script();

lab.experiment('Base Object Library', function () {
  lab.experiment('mediumTextLength', function () {
    lab.test('is a number', async function () {
      Code.expect(defaults.mediumTextLength).to.be.a.number();
    });
  });

  lab.experiment('default test object', function () {
    lab.test('is an object', async function () {
      Code.expect(defaults.test).to.be.a.object();
    });
  });

  lab.experiment('test page context', function () {
    lab.test('is an object', async function () {
      Code.expect(defaults.testPageContext).to.be.a.object();
    });
  });
});
