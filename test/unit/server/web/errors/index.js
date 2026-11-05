const Lab = require('@hapi/lab');
const Code = require('@hapi/code');
const Boom = require('@hapi/boom');
const Support = require('../../../../support/server');
const ErrorHandlerPlugin = require('../../../../../server/web/errors');

const RoutesPlugin = {
  plugin: {
    name: 'test/routes',
    register: (server) => {
      server.route({ method: 'GET', path: '/web/400', handler: () => { throw Boom.badRequest('invalid query'); } });
      server.route({ method: 'GET', path: '/web/403', handler: () => { throw Boom.forbidden('not authorized'); } });
      server.route({ method: 'GET', path: '/web/405', handler: () => { throw Boom.methodNotAllowed('not allowed'); } });
      server.route({ method: 'GET', path: '/web/bypass', handler: () => 'bypassed any boom errors' });
    }
  }
};

const lab = exports.lab = Lab.script();
let server;

lab.beforeEach(async () => {
  server = await Support.createServer({ plugins: [ErrorHandlerPlugin, RoutesPlugin] });
});

lab.experiment('errors', () => {
  lab.test('display a custom 403 page', async () => {
    const response = await server.inject('/web/403');

    Code.expect(response.statusCode).to.equal(403);
    Code.expect(response.result).to.include('You don’t have permission to view this document');
  });

  lab.test('display a custom 400 page', async () => {
    const response = await server.inject('/web/400');

    Code.expect(response.statusCode).to.equal(400);
    Code.expect(response.result).to.include('The request cannot be fulfilled due to bad syntax');
  });

  lab.test('display a custom 404 page', async () => {
    const response = await server.inject('/silly/no/way/this/is/a/route');

    Code.expect(response.statusCode).to.equal(404);
    Code.expect(response.result).to.include('The requested document could not be found');
  });

  lab.test('display a general error page', async () => {
    const response = await server.inject('/web/405');

    Code.expect(response.statusCode).to.equal(500);
    Code.expect(response.result).to.include('something went wrong');
  });

  lab.test('bypass custom error pages for all allowed routes', async () => {
    const response = await server.inject('/web/bypass');

    Code.expect(response.statusCode).to.equal(200);
    Code.expect(response.result).to.include('bypassed any boom errors');
  });
});
