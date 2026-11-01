const Lab = require('@hapi/lab');
const Code = require('@hapi/code');
const Support = require('../../../../support/server');
const sinon = require('sinon');

const SearchPlugin = require('../../../../../server/web/search/index');

const MockPagesService = Support.mock('services/pages', ['find']);

const lab = exports.lab = Lab.script();
let request, server, pagesServiceStub;

lab.beforeEach(async () => {
  server = await Support.createServer({ plugins: [MockPagesService, SearchPlugin] });

  sinon.stub(server.plugins['services/pages'], 'find').callsFake(() => pagesServiceStub);
});

lab.experiment('search', function () {
  lab.beforeEach(async function () {
    request = {
      method: 'GET',
      url: '/search'
    };
  });

  lab.test('it responds with search form', async function () {
    const response = await server.inject(request);
    Code.expect(response.statusCode).to.equal(200);
    Code.expect(response.result).to.include([
      'Search jsPerf',
      '<form'
    ]);
  });

  lab.test('it responds with search form from empty form submission', async function () {
    request.url += '?q=';

    const response = await server.inject(request);
    Code.expect(response.statusCode).to.equal(200);
    Code.expect(response.result).to.include([
      'Search jsPerf',
      '<form'
    ]);
  });

  lab.test('it responds with an error from querying', async function () {
    pagesServiceStub = Promise.reject(new Error());

    request.url += '?q=a';

    const response = await server.inject(request);
    Code.expect(response.statusCode).to.equal(500);
  });

  lab.test('it responds with no results from querying', async function () {
    pagesServiceStub = Promise.resolve([]);

    request.url += '?q=a';

    const response = await server.inject(request);
    Code.expect(response.statusCode).to.equal(200);
    Code.expect(response.result).to.include('No results found for query: ');
  });

  lab.test('it responds with search results', async function () {
    const currentTime = new Date();
    const testUrl = 'http://example.com';
    const testTitle = 'Test result';
    pagesServiceStub = Promise.resolve([{
      url: testUrl,
      revision: 1,
      title: testTitle,
      revisionCount: 1,
      testCount: 1,
      updated: currentTime
    }]);

    request.url += '?q=test';

    const response = await server.inject(request);
    Code.expect(response.statusCode).to.equal(200);
    Code.expect(response.result).to.include([
      testUrl,
      testTitle,
      currentTime.toISOString()
    ]);
  });

  lab.experiment('atom', function () {
    lab.test('it ignores non-atom extensions', async function () {
      request.url += '.php';

      const response = await server.inject(request);
      Code.expect(response.statusCode).to.equal(404);
    });

    lab.test('it responds w/ atom feed', async function () {
      const currentTime = new Date();
      const testUrl = 'http://example.com';
      const testTitle = 'Test result';
      pagesServiceStub = Promise.resolve([{
        url: testUrl,
        revision: 1,
        title: testTitle,
        revisionCount: 1,
        testCount: 1,
        updated: currentTime,
        published: currentTime
      }]);

      request.url += '.atom?q=test';

      const response = await server.inject(request);
      Code.expect(response.statusCode).to.equal(200);
      Code.expect(response.result).to.include([
        '<title>' + testTitle + '</title>'
      ]);
    });
  });
});
