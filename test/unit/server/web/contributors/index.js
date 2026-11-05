const Lab = require('@hapi/lab');
const Code = require('@hapi/code');
const Support = require('../../../../support/server');

const HomePlugin = require('../../../../../server/web/contributors/index');

const lab = exports.lab = Lab.script();
let request, server;

lab.beforeEach(async () => {
  server = await Support.createServer({ plugins: [HomePlugin] });
});

lab.experiment('contributors', function () {
  lab.beforeEach(async function () {
    request = {
      method: 'GET',
      url: '/contributors'
    };
  });

  lab.test('it responds with the contributors page', async function () {
    const response = await server.inject(request);
    Code.expect(response.statusCode).to.equal(200);
    Code.expect(response.result).to.include([
      'Bynens',
      'Benchmark.js',
      'Kieffer',
      'Dalton'
    ]);
  });
});
