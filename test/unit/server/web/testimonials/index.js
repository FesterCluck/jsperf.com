const Lab = require('@hapi/lab');
const Code = require('@hapi/code');
const Support = require('../../../../support/server');

const HomePlugin = require('../../../../../server/web/testimonials/index');

const lab = exports.lab = Lab.script();
let request, server;

lab.beforeEach(async () => {
  server = await Support.createServer({ plugins: [HomePlugin] });
});

lab.experiment('testimonials', function () {
  lab.beforeEach(async function () {
    request = {
      method: 'GET',
      url: '/testimonials'
    };
  });

  lab.test('it responds with the testimonials page', async function () {
    const response = await server.inject(request);
    Code.expect(response.statusCode).to.equal(200);
    Code.expect(response.result).to.include([
      'biggest',
      'second',
      'waste',
      'personal',
      'worse',
      'U',
      'allowed'
    ]);
  });
});
