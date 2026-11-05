const Lab = require('@hapi/lab');
const Code = require('@hapi/code');
const Support = require('../../../../support/server');

const HomePlugin = require('../../../../../server/web/faq/index');

const lab = exports.lab = Lab.script();
let request, server;

lab.beforeEach(async () => {
  server = await Support.createServer({ plugins: [HomePlugin] });
});

lab.experiment('faq', function () {
  lab.beforeEach(async function () {
    request = {
      method: 'GET',
      url: '/faq'
    };
  });

  lab.test('it responds with the faq page', async function () {
    const response = await server.inject(request);
    Code.expect(response.statusCode).to.equal(200);
    Code.expect(response.result).to.include([
      'what',
      'engine',
      'script-warnings',
      'firebug-warning',
      'calibration',
      'java-applet',
      'ie9-java',
      'lion-java',
      'chrome',
      'run-single-test',
      'autorun',
      'setup-teardown',
      'async',
      'add-edit',
      'remove-snippet',
      'test-case-feed',
      'author-feed',
      'test-availability',
      'additional-features'
    ]);
  });

  lab.test('it shows the title specified in the route', async function () {
    const response = await server.inject(request);
    Code.expect(response.payload).to.include('<title>Frequently asked questions · jsPerf</title>');
  });
});
