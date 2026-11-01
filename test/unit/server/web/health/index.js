const Lab = require('@hapi/lab');
const Code = require('@hapi/code');
const sinon = require('sinon');
const Support = require('../../../../support/server');

const HealthPlugin = require('../../../../../server/web/health/index');

const lab = exports.lab = Lab.script();
let request, server;

const MockDb = Support.mock('db', ['genericQuery']);

lab.beforeEach(async () => {
  server = await Support.createServer({ views: false, plugins: [MockDb, HealthPlugin] });

  request = {
    method: 'GET',
    url: '/health'
  };
});

lab.experiment('health', () => {
  lab.test('it responds unhealthy', async () => {
    sinon.stub(server.plugins.db, 'genericQuery').rejects(new Error());

    const response = await server.inject(request);

    Code.expect(response.statusCode).to.equal(500);
  });

  lab.test('it responds healthy', async () => {
    sinon.stub(server.plugins.db, 'genericQuery').resolves();

    const response = await server.inject(request);

    Code.expect(response.statusCode).to.equal(200);
  });
});
