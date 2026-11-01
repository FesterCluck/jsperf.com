const Lab = require('@hapi/lab');
const Code = require('@hapi/code');
const Support = require('../../../../support/server');
const sinon = require('sinon');

const PopularPlugin = require('../../../../../server/web/popular/index');

const MockPagesService = Support.mock('services/pages', ['getPopular']);

const lab = exports.lab = Lab.script();
let request, server, pagesServiceStub;

lab.beforeEach(async () => {
  server = await Support.createServer({ plugins: [MockPagesService, PopularPlugin] });

  pagesServiceStub = {
    getPopular: sinon.stub(server.plugins['services/pages'], 'getPopular')
  };
});

lab.experiment('popular', function () {
  lab.beforeEach(async function () {
    request = {
      method: 'GET',
      url: '/popular'
    };
  });

  lab.test('it responds with popular pages', async function () {
    pagesServiceStub.getPopular.returns(Promise.resolve([]));

    const response = await server.inject(request);
    Code.expect(response.statusCode).to.equal(200);
    Code.expect(response.result).to.include([
      'Popular',
      'recent',
      'all-time'
    ]);
  });

  lab.test('it responds with error', async function () {
    server.plugins['services/pages'].getPopular = function () {
      return Promise.reject(new Error());
    };

    const response = await server.inject(request);
    Code.expect(response.statusCode).to.equal(500);
  });
});
