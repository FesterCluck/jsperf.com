const Lab = require('@hapi/lab');
const Code = require('@hapi/code');
const sinon = require('sinon');

const migration = require('../../../../../server/lib/db/migrations/20261104_add_complexity_to_tests');

const lab = exports.lab = Lab.script();

lab.experiment('add_complexity_to_tests migration', () => {
  lab.test('adds a nullable JSON column up and drops it down', async () => {
    const genericQuery = sinon.stub().resolves();

    await migration.up({ context: { genericQuery } });
    Code.expect(genericQuery.getCall(0).args[0]).to.match(/ALTER TABLE tests ADD COLUMN complexity JSON NULL/);

    await migration.down({ context: { genericQuery } });
    Code.expect(genericQuery.getCall(1).args[0]).to.match(/ALTER TABLE tests DROP COLUMN complexity/);
  });
});
