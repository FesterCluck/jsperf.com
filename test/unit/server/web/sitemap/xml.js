const Lab = require('@hapi/lab');
const Code = require('@hapi/code');
const Support = require('../../../../support/server');
const sinon = require('sinon');

const SitemapPlugin = require('../../../../../server/web/sitemap/xml');

const MockRepo = Support.mock('repositories/pages', ['getSitemap']);

const lab = exports.lab = Lab.script();
let request, server, getSitemapStub;

lab.beforeEach(async () => {
  server = await Support.createServer({ plugins: [MockRepo, SitemapPlugin] });
  getSitemapStub = sinon.stub(server.plugins['repositories/pages'], 'getSitemap');
});

lab.experiment('sitemap', function () {
  lab.beforeEach(async function () {
    request = {
      method: 'GET',
      url: '/sitemap.xml'
    };
  });

  lab.test('it responds with sitemap XML', async function () {
    getSitemapStub.returns(Promise.resolve([]));

    const response = await server.inject(request);
    Code.expect(response.statusCode).to.equal(200);
    Code.expect(response.result).to.include([
      'urlset',
      'url>',
      'loc'
    ]);
  });

  lab.test('it responds with error', async function () {
    getSitemapStub.returns(Promise.reject(new Error()));

    const response = await server.inject(request);
    Code.expect(response.statusCode).to.equal(500);
  });
});
