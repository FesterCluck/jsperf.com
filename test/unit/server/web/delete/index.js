const Lab = require('@hapi/lab');
const sinon = require('sinon');
const Code = require('@hapi/code');
const Support = require('../../../../support/server');
const DeletePlugin = require('../../../../../server/web/delete/index');

const MockPagesService = Support.mock('services/pages', ['deleteBySlug']);

const lab = exports.lab = Lab.script();
let request, server;

lab.beforeEach(async () => {
  server = await Support.createServer({ yar: true, auth: true, plugins: [MockPagesService, DeletePlugin] });

  request = {
    method: 'GET',
    url: '/test-slug/1/delete'
  };
});

lab.experiment('deleting', () => {
  const adminCookie = async () => {
    server.route({
      method: 'GET',
      path: '/setsession',
      handler: (req) => {
        req.yar.set('admin', true);
        return 'session set';
      }
    });

    return Support.sessionCookie(server, '/setsession');
  };

  lab.test('while being unauthorized', async () => {
    const response = await server.inject(request);

    Code.expect(response.statusCode).to.equal(401);
  });

  lab.test('multiple revisions while being admin', async () => {
    sinon.stub(server.plugins['services/pages'], 'deleteBySlug').resolves(3);
    request.headers = { cookie: await adminCookie() };

    const response = await server.inject(request);

    Code.expect(response.statusCode).to.equal(200);
    Code.expect(response.result).to.include('Deleted 3 revisions');
  });

  lab.test('a single revision while being admin', async () => {
    sinon.stub(server.plugins['services/pages'], 'deleteBySlug').resolves(1);
    request.headers = { cookie: await adminCookie() };

    const response = await server.inject(request);

    Code.expect(response.statusCode).to.equal(200);
    Code.expect(response.result).to.include('Deleted revision 1');
  });

  lab.test('when nothing is deleted', async () => {
    sinon.stub(server.plugins['services/pages'], 'deleteBySlug').resolves(0);
    request.headers = { cookie: await adminCookie() };

    const response = await server.inject(request);

    Code.expect(response.statusCode).to.equal(200);
    Code.expect(response.result).to.include('Could not delete');
  });
});
