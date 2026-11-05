const Lab = require('@hapi/lab');
const Code = require('@hapi/code');
const Support = require('../../../../support/server');
const sinon = require('sinon');

const BrowsePlugin = require('../../../../../server/web/browse/index');

const MockRepo = Support.mock('repositories/pages', ['getLatestVisible', 'getLatestVisibleForAuthor']);
const MockCache = Support.mock('cache', ['get', 'set']);

const lab = exports.lab = Lab.script();
let request, server, getLatestVisibleStub, getLatestVisibleForAuthorStub;

lab.beforeEach(async () => {
  server = await Support.createServer({ plugins: [MockRepo, MockCache, BrowsePlugin] });

  sinon.stub(server.plugins.cache, 'get').resolves(null);
  sinon.stub(server.plugins.cache, 'set').resolves();
  getLatestVisibleStub = sinon.stub(server.plugins['repositories/pages'], 'getLatestVisible');
  getLatestVisibleForAuthorStub = sinon.stub(server.plugins['repositories/pages'], 'getLatestVisibleForAuthor');
});

lab.experiment('browse', function () {
  lab.experiment('page', function () {
    lab.beforeEach(async function () {
      request = {
        method: 'GET',
        url: '/browse'
      };
    });

    lab.test('it responds with the browse page', async function () {
      getLatestVisibleStub.returns(Promise.resolve([]));

      const response = await server.inject(request);
      Code.expect(response.statusCode).to.equal(200);
    });

    lab.test('it responds with generic error', async function () {
      getLatestVisibleStub.returns(Promise.reject(new Error()));

      const response = await server.inject(request);
      Code.expect(response.statusCode).to.equal(200);
    });

    lab.test('it responds with error from cache get', async () => {
      const testErr = new Error('testing get');
      server.plugins.cache.get.rejects(testErr);

      const response = await server.inject(request);
      Code.expect(response.statusCode).to.equal(500);
    });

    lab.test('it responds with items from cache get', async () => {
      server.plugins.cache.get.resolves({
        item: [
          {
            url: 'test',
            title: 'Test',
            testCount: 2,
            revisionCount: 1,
            updated: new Date().toISOString(),
            published: new Date().toISOString()
          }
        ]
      });

      const response = await server.inject(request);
      Code.expect(response.statusCode).to.equal(200);
    });

    lab.test('it responds with generic error when cache set errors', async () => {
      getLatestVisibleStub.returns(Promise.resolve([]));
      const testErr = new Error('testing set');
      server.plugins.cache.set.rejects(testErr);

      const response = await server.inject(request);
      Code.expect(response.statusCode).to.equal(200);
      Code.expect(response.result).to.contain('Sorry. Could not find tests to browse.');
    });
  });

  lab.experiment('atom', function () {
    lab.beforeEach(async function () {
      request = {
        method: 'GET',
        url: '/browse.atom'
      };
    });

    lab.test('it responds with atom feed', async function () {
      getLatestVisibleStub.returns(Promise.resolve([
        {
          updated: new Date(),
          published: new Date()
        }
      ]));

      const response = await server.inject(request);
      Code.expect(response.statusCode).to.equal(200);
      Code.expect(response.headers['content-type']).to.equal('application/atom+xml;charset=UTF-8');
      Code.expect(response.result).to.be.string().and.to.startWith('<feed').and.to.contain('<entry>');
    });

    lab.test('it responds with empty atom feed', async function () {
      getLatestVisibleStub.returns(Promise.resolve([]));

      const response = await server.inject(request);
      Code.expect(response.statusCode).to.equal(200);
      Code.expect(response.headers['content-type']).to.equal('application/atom+xml;charset=UTF-8');
      Code.expect(response.result).to.be.string().and.to.startWith('<feed').and.to.not.contain('<entry>');
    });

    lab.test('it responds with generic error', async function () {
      getLatestVisibleStub.returns(Promise.reject(new Error()));

      const response = await server.inject(request);
      Code.expect(response.statusCode).to.equal(500);
    });
  });

  lab.experiment('author page', function () {
    lab.beforeEach(async function () {
      request = {
        method: 'GET',
        url: '/browse/test-author'
      };
    });

    lab.test('it responds with the browse page', async function () {
      const testTitle = 'My First Test';
      getLatestVisibleForAuthorStub.returns(Promise.resolve([{
        updated: new Date(),
        published: new Date(),
        title: testTitle,
        testCount: 1,
        revision: 1,
        revisionCount: 1
      }]));

      const response = await server.inject(request);
      Code.expect(response.statusCode).to.equal(200);
      Code.expect(response.result).to.be.string().and.to.contain(testTitle);
    });

    lab.test('it responds with not found if no results for author', async function () {
      getLatestVisibleForAuthorStub.returns(Promise.resolve([]));
      const response = await server.inject(request);
      Code.expect(response.statusCode).to.equal(404);
    });

    lab.test('it responds with generic error', async function () {
      getLatestVisibleForAuthorStub.returns(Promise.reject(new Error()));

      const response = await server.inject(request);
      Code.expect(response.statusCode).to.equal(500);
    });
  });

  lab.experiment('author atom', function () {
    lab.beforeEach(async function () {
      request = {
        method: 'GET',
        url: '/browse/test-author.atom'
      };
    });

    lab.test('it responds with atom feed', async function () {
      getLatestVisibleForAuthorStub.returns(Promise.resolve([
        {
          updated: new Date(),
          published: new Date()
        }
      ]));

      const response = await server.inject(request);
      Code.expect(response.statusCode).to.equal(200);
      Code.expect(response.headers['content-type']).to.equal('application/atom+xml;charset=UTF-8');
      Code.expect(response.result).to.be.string().and.to.startWith('<feed').and.to.contain('<entry>');
    });

    lab.test('it responds with empty atom feed', async function () {
      getLatestVisibleForAuthorStub.returns(Promise.resolve([]));

      const response = await server.inject(request);
      Code.expect(response.statusCode).to.equal(200);
      Code.expect(response.headers['content-type']).to.equal('application/atom+xml;charset=UTF-8');
      Code.expect(response.result).to.be.string().and.to.startWith('<feed').and.to.not.contain('<entry>');
    });

    lab.test('it responds with generic error', async function () {
      getLatestVisibleForAuthorStub.returns(Promise.reject(new Error()));

      const response = await server.inject(request);
      Code.expect(response.statusCode).to.equal(500);
    });
  });
});
