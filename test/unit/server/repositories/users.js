const Lab = require('@hapi/lab');
const Code = require('@hapi/code');
const sinon = require('sinon');
const Support = require('../../../support/server');

const Users = require('../../../../server/repositories/users');

const MockDb = Support.mock('db', ['genericQuery']);

const lab = exports.lab = Lab.script();

lab.experiment('Users Repository', () => {
  let server, users, genericQueryStub;

  lab.before(async () => {
    server = await Support.createServer({ views: false, plugins: [MockDb, Users] });
    users = server.plugins['repositories/users'];
  });

  lab.beforeEach(() => {
    genericQueryStub = sinon.stub(server.plugins.db, 'genericQuery');
  });

  lab.afterEach(() => {
    genericQueryStub.restore();
  });

  lab.test('create inserts a user and returns the new id', async () => {
    const payload = { username: 'alice', passwordHash: 'scrypt$a$b', created: new Date() };
    genericQueryStub.resolves({ insertId: 5 });

    const id = await users.create(payload);

    Code.expect(id).to.equal(5);
    Code.expect(genericQueryStub.calledWithExactly('INSERT INTO ?? SET ?', ['users', payload])).to.be.true();
  });

  lab.test('getByUsername returns the first row', async () => {
    genericQueryStub.resolves([{ id: 1, username: 'alice' }]);

    const user = await users.getByUsername('alice');

    Code.expect(user.username).to.equal('alice');
    Code.expect(genericQueryStub.calledWithExactly('SELECT * FROM ?? WHERE username = ? LIMIT 1', ['users', 'alice'])).to.be.true();
  });

  lab.test('getByUsername returns undefined when not found', async () => {
    genericQueryStub.resolves([]);

    Code.expect(await users.getByUsername('nobody')).to.be.undefined();
  });
});
