const Lab = require('@hapi/lab');
const Code = require('@hapi/code');
const sinon = require('sinon');

const CustomStorage = require('../../../../../server/lib/db/umzugStorage');

const lab = exports.lab = Lab.script();

lab.experiment('Custom Umzug Storage', () => {
  lab.test('constructs', async () => {
    Code.expect(new CustomStorage({
      genericQuery: () => {}
    })).to.be.instanceof(CustomStorage);
  });

  lab.test('logMigration', async () => {
    const c = new CustomStorage({
      genericQuery: sinon.stub().returns(Promise.resolve())
    });

    await c.logMigration({ name: '1-test.js' });
  });

  lab.test('unlogMigration', async () => {
    const c = new CustomStorage({
      genericQuery: sinon.stub().returns(Promise.resolve())
    });

    await c.unlogMigration({ name: '1-test.js' });
  });

  lab.experiment('executed', () => {
    lab.test('returns array of completed migrations', async () => {
      const c = new CustomStorage({
        genericQuery: sinon.stub().returns(Promise.resolve([{ name: '1-test.js' }]))
      });

      const names = await c.executed();
      Code.expect(names).to.equal(['1-test.js']);
    });

    lab.test('returns empty array if table does not exist', async () => {
      const err = new Error();
      err.code = 'ER_NO_SUCH_TABLE';

      const c = new CustomStorage({
        genericQuery: sinon.stub().returns(Promise.reject(err))
      });

      const names = await c.executed();
      Code.expect(names).to.equal([]);
    });

    lab.test('passes along unknown errors', async () => {
      const testMsg = 'testingunknown';
      const c = new CustomStorage({
        genericQuery: sinon.stub().returns(Promise.reject(new Error(testMsg)))
      });

      await Code.expect(c.executed()).to.reject(testMsg);
    });
  });
});
