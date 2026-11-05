const Lab = require('@hapi/lab');
const Code = require('@hapi/code');
const Hapi = require('@hapi/hapi');
const proxyquire = require('proxyquire');
const sinon = require('sinon');

const mysqlStub = { escape: (v) => '`' + v + '`' };
const umzugStub = {};
let queryStub, endStub, umzugOptions;

const Db = proxyquire('../../../../../server/lib/db', {
  mysql2: mysqlStub,
  umzug: {
    Umzug: function (opts) {
      umzugOptions = opts;
      return umzugStub;
    }
  }
});

const lab = exports.lab = Lab.script();

const register = (server, options) => server.register({ plugin: Db, options });

lab.experiment('Database Plugin', () => {
  lab.beforeEach(() => {
    queryStub = sinon.stub().resolves([[], []]);
    endStub = sinon.stub().resolves();
    mysqlStub.createPool = () => ({ promise: () => ({ query: queryStub, end: endStub }) });
  });

  lab.test('registers successfully', async () => {
    umzugStub.up = () => Promise.resolve([]);

    const server = Hapi.server();
    await register(server);

    Code.expect(server.plugins).to.include('db');
  });

  lab.test('registers UNsuccessfully', async () => {
    umzugStub.up = () => Promise.reject(new Error('umzugtesting'));

    const server = Hapi.server();

    await Code.expect(register(server)).to.reject('umzugtesting');
  });

  lab.test('ends the pool when the server stops', async () => {
    umzugStub.up = () => Promise.resolve([]);

    const server = Hapi.server();
    await register(server);
    await server.initialize();
    await server.stop();

    Code.expect(endStub.calledOnce).to.be.true();
  });

  lab.test('configures umzug logger and resolver', async () => {
    umzugStub.up = () => Promise.resolve([]);

    const server = Hapi.server();
    await register(server, { connectionLimit: 2 });

    ['info', 'warn', 'error', 'debug'].forEach((level) => umzugOptions.logger[level]('msg'));

    const calls = [];
    const migration = umzugOptions.migrations.resolve({
      name: 'sub/20150101_create_world.js',
      path: require('path').resolve(__dirname, '../../../../../server/lib/db/migrations/20150101_create_world.js'),
      context: { genericQuery: (q) => calls.push(q) }
    });
    Code.expect(migration.name).to.equal('20150101_create_world.js');
    await migration.up();
    await migration.down();
    Code.expect(calls).to.have.length(2);
  });

  lab.test('queries without debug logging', async () => {
    umzugStub.up = () => Promise.resolve([]);

    const server = Hapi.server();
    await register(server);
    await server.plugins.db.genericQuery('SELECT 1;');
  });

  lab.experiment('escape', () => {
    lab.test('exports mysql.escape', async () => {
      umzugStub.up = () => Promise.resolve([]);

      const server = Hapi.server();
      await register(server, { debug: true });

      Code.expect(server.plugins.db.escape).to.be.a.function();
    });
  });

  lab.experiment('genericQuery', () => {
    let server;

    lab.beforeEach(async () => {
      umzugStub.up = () => Promise.resolve([]);
      server = Hapi.server();
      await register(server, { debug: true });
    });

    lab.test('exposes genericQuery', () => {
      Code.expect(server.plugins.db.genericQuery).to.be.a.function();
    });

    lab.test('queries the pool and returns rows', async () => {
      queryStub.resolves([[{ a: 1 }], []]);

      const rows = await server.plugins.db.genericQuery('SELECT ?;', [1]);
      Code.expect(rows).to.equal([{ a: 1 }]);
    });

    lab.test('rejects when query errors', async () => {
      queryStub.rejects(new Error('boom'));

      await Code.expect(server.plugins.db.genericQuery('SELECT ?;', [1])).to.reject('boom');
    });

    lab.test('values param is optional', async () => {
      await server.plugins.db.genericQuery('SELECT 1;');
      Code.expect(queryStub.args[0][1]).to.equal([]);
    });
  });
});
