const Lab = require('@hapi/lab');
const Code = require('@hapi/code');
const Support = require('../../../support/server');

const PublicPlugin = require('../../../../server/web/public');

const lab = exports.lab = Lab.script();
let request, server;

lab.beforeEach(async () => {
  server = await Support.createServer({ views: false, plugins: [require('@hapi/inert'), PublicPlugin] });
});

lab.experiment('Public', function () {
  lab.beforeEach(async function () {
    request = {
      method: 'GET'
    };
  });

  lab.test('it serves apple-touch-icon.png', async function () {
    request.url = '/public/apple-touch-icon.png';
    const response = await server.inject(request);
    Code.expect(response.statusCode).to.equal(200);
  });

  lab.test('it serves favicon.ico', async function () {
    request.url = '/public/favicon.ico';
    const response = await server.inject(request);
    Code.expect(response.statusCode).to.equal(200);
  });

  lab.experiment('_css', function () {
    lab.test('it serves main.css', async function () {
      request.url = '/public/_css/main.css';
      const response = await server.inject(request);
      Code.expect(response.statusCode).to.equal(200);
    });
  });

  lab.experiment('_js', function () {
    lab.test('it serves main.js', async function () {
      request.url = '/public/_js/main.js';
      const response = await server.inject(request);
      Code.expect(response.statusCode).to.equal(200);
    });
  });

  lab.test('it serves robots.txt', async function () {
    request.url = '/robots.txt';
    const response = await server.inject(request);
    Code.expect(response.statusCode).to.equal(200);
  });
});
