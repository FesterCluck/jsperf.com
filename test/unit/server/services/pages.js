const Lab = require('@hapi/lab');
const Code = require('@hapi/code');
const Support = require('../../../support/server');
const sinon = require('sinon');

const Pages = require('../../../../server/services/pages');
const complexity = require('../../../../server/lib/complexity');

const MockPagesRepo = Support.mock('repositories/pages', ['get', 'create', 'updateById', 'getPopularRecent', 'getPopularAllTime', 'find', 'updateHits', 'getBySlug', 'findBySlug', 'getVisibleBySlug', 'findVisibleBySlug', 'deleteOneRevisionBySlug', 'deleteAllRevisionsBySlug']);

const MockTestsRepo = Support.mock('repositories/tests', ['bulkCreate', 'bulkUpdate', 'findByPageID', 'setComplexity']);

const MockCommentsRepo = Support.mock('repositories/comments', ['findByPageID']);

const lab = exports.lab = Lab.script();

lab.experiment('Pages Service', function () {
  let s, server, pages, pagesRepoStub, testsRepoStub, commentsRepoStub;

  lab.beforeEach(async function () {
    s = sinon.createSandbox();

    server = await Support.createServer({ views: false, plugins: [MockPagesRepo, MockTestsRepo, MockCommentsRepo, Pages] });

    pages = server.plugins['services/pages'];

    pagesRepoStub = {
      get: s.stub(server.plugins['repositories/pages'], 'get'),
      create: s.stub(server.plugins['repositories/pages'], 'create'),
      updateById: s.stub(server.plugins['repositories/pages'], 'updateById'),
      getPopularRecent: s.stub(server.plugins['repositories/pages'], 'getPopularRecent'),
      getPopularAllTime: s.stub(server.plugins['repositories/pages'], 'getPopularAllTime'),
      find: s.stub(server.plugins['repositories/pages'], 'find'),
      updateHits: s.stub(server.plugins['repositories/pages'], 'updateHits'),
      getBySlug: s.stub(server.plugins['repositories/pages'], 'getBySlug'),
      findBySlug: s.stub(server.plugins['repositories/pages'], 'findBySlug'),
      getVisibleBySlug: s.stub(server.plugins['repositories/pages'], 'getVisibleBySlug'),
      findVisibleBySlug: s.stub(server.plugins['repositories/pages'], 'findVisibleBySlug'),
      deleteOneRevisionBySlug: s.stub(server.plugins['repositories/pages'], 'deleteOneRevisionBySlug'),
      deleteAllRevisionsBySlug: s.stub(server.plugins['repositories/pages'], 'deleteAllRevisionsBySlug')
    };

    testsRepoStub = {
      bulkCreate: s.stub(server.plugins['repositories/tests'], 'bulkCreate'),
      bulkUpdate: s.stub(server.plugins['repositories/tests'], 'bulkUpdate'),
      findByPageID: s.stub(server.plugins['repositories/tests'], 'findByPageID'),
      setComplexity: s.stub(server.plugins['repositories/tests'], 'setComplexity').resolves()
    };

    commentsRepoStub = {
      findByPageID: s.stub(server.plugins['repositories/comments'], 'findByPageID')
    };
  });

  lab.afterEach(async function () {
    s.restore();
  });

  lab.experiment('checkIfSlugAvailable', function () {
    let testSlug;
    let tableStub;
    let serverMock;

    lab.beforeEach(async function () {
      testSlug = 'test-slug';

      tableStub = s.stub().returns([{ path: '/' }]);

      serverMock = {
        table: tableStub,
        settings: { app: {} }
      };
    });

    lab.test('returns false if slug is reserved', async function () {
      testSlug = 'reserved';

      tableStub = s.stub().returns([{ path: '/' + testSlug }]);

      serverMock = {
        table: tableStub,
        settings: { app: {} }
      };

      const isAvail = await pages.checkIfSlugAvailable(serverMock, testSlug);
      Code.expect(isAvail).to.be.false();
      Code.expect(pagesRepoStub.get.called).to.be.false();
    });

    lab.test('treats prefixed app routes as reserved when mounted under a base path', async function () {
      serverMock = {
        table: s.stub().returns([{ path: '/next/browse' }]),
        settings: { app: { basePath: '/next' } }
      };

      Code.expect(await pages.checkIfSlugAvailable(serverMock, 'browse')).to.be.false();
    });

    lab.test('returns error if getting page fails', async function () {
      const testErrMsg = 'testing';
      const testErr = new Error(testErrMsg);

      pagesRepoStub.get.returns(Promise.reject(testErr));

      const err = await Code.expect(pages.checkIfSlugAvailable(serverMock, testSlug)).to.reject();
      Code.expect(err).to.be.instanceof(Error);
      Code.expect(err.message).to.equal(testErrMsg);
    });

    lab.test('returns false if page with slug exists', async function () {
      pagesRepoStub.get.returns(Promise.resolve({}));

      const isAvail = await pages.checkIfSlugAvailable(serverMock, testSlug);
      Code.expect(isAvail).to.be.false();
    });

    lab.test('returns true if no app route or page exists for given slug', async function () {
      pagesRepoStub.get.returns(Promise.resolve(undefined));

      const isAvail = await pages.checkIfSlugAvailable(serverMock, testSlug);
      Code.expect(isAvail).to.be.true();
    });
  });

  lab.experiment('create', function () {
    let payload;

    lab.beforeEach(async function () {
      payload = {};
    });

    lab.test('creates page and tests', async function () {
      pagesRepoStub.create.returns(Promise.resolve());
      testsRepoStub.bulkCreate.returns(Promise.resolve());

      await pages.create(payload);
    });

    lab.test('stores a complexity estimate with every test, using the page setup code', async function () {
      pagesRepoStub.create.returns(Promise.resolve(3));
      testsRepoStub.bulkCreate.returns(Promise.resolve());
      payload = {
        setup: 'function lin(a) { for (var i = 0; i < a.length; i++) {} }',
        test: [{ title: 'a', defer: 'n', code: 'lin(data)' }, { title: 'b', defer: 'n', code: 'Math.abs(1)' }]
      };

      await pages.create(payload);
      const [pageID, tests] = testsRepoStub.bulkCreate.getCall(0).args;
      Code.expect(pageID).to.equal(3);
      Code.expect(tests.map((t) => t.complexity.overall)).to.equal(['on', 'o1']);
      Code.expect(tests[0].title).to.equal('a');
      Code.expect(payload.test[0].complexity).to.be.undefined();
    });

    lab.test('returns error if page fails to create', async function () {
      const testErrMsg = 'testing';
      const testErr = new Error(testErrMsg);

      pagesRepoStub.create.returns(Promise.reject(testErr));

      const err = await Code.expect(pages.create(payload)).to.reject();
      Code.expect(err).to.be.instanceof(Error);
      Code.expect(err.message).to.equal(testErrMsg);
      Code.expect(testsRepoStub.bulkCreate.called).to.be.false();
    });

    lab.test('returns error if tests fail to create', async function () {
      const testErrMsg = 'testing';
      const testErr = new Error(testErrMsg);

      pagesRepoStub.create.returns(Promise.resolve());
      testsRepoStub.bulkCreate.returns(Promise.reject(testErr));

      const err = await Code.expect(pages.create(payload)).to.reject();
      Code.expect(err).to.be.instanceof(Error);
      Code.expect(err.message).to.equal(testErrMsg);
    });

    lab.test('forks page and tests', async function () {
      pagesRepoStub.create.returns(Promise.resolve());
      testsRepoStub.bulkCreate.returns(Promise.resolve());

      await pages.create(payload);
    });
  });

  lab.experiment('edit', function () {
    let payload;

    lab.beforeEach(async function () {
      payload = {};
    });

    lab.test('creates new revision and tests', async function () {
      pagesRepoStub.create.returns(Promise.resolve());
      testsRepoStub.bulkCreate.returns(Promise.resolve());

      const resultingRevision = await pages.edit(payload, false, 1);
      Code.expect(resultingRevision).to.equal(2);
    });

    lab.test('returns error if page fails to create', async function () {
      const testErrMsg = 'testing';
      const testErr = new Error(testErrMsg);

      pagesRepoStub.create.returns(Promise.reject(testErr));

      const err = await Code.expect(pages.edit(payload)).to.reject();
      Code.expect(err).to.be.instanceof(Error);
      Code.expect(err.message).to.equal(testErrMsg);
      Code.expect(testsRepoStub.bulkCreate.called).to.be.false();
    });

    lab.test('returns error if page fails to update', async function () {
      const testErrMsg = 'testing';
      const testErr = new Error(testErrMsg);

      pagesRepoStub.updateById.returns(Promise.reject(testErr));

      const err = await Code.expect(pages.edit(payload, true)).to.reject();
      Code.expect(err).to.be.instanceof(Error);
      Code.expect(err.message).to.equal(testErrMsg);
      Code.expect(testsRepoStub.bulkCreate.called).to.be.false();
    });

    lab.test('returns error if tests fail to update', async function () {
      const testErrMsg = 'testing';
      const testErr = new Error(testErrMsg);

      pagesRepoStub.create.returns(Promise.resolve());
      testsRepoStub.bulkUpdate.returns(Promise.reject(testErr));

      const err = await Code.expect(pages.edit(payload)).to.reject();
      Code.expect(err).to.be.instanceof(Error);
      Code.expect(err.message).to.equal(testErrMsg);
    });

    lab.test('edits (forks) page and tests', async function () {
      pagesRepoStub.create.returns(Promise.resolve());
      testsRepoStub.bulkCreate.returns(Promise.resolve());

      await pages.edit(payload);
    });

    lab.test('edits page and tests', async function () {
      pagesRepoStub.updateById.returns(Promise.resolve());
      testsRepoStub.bulkUpdate.returns(Promise.resolve());

      await pages.edit(payload, true);
    });

    lab.test('recomputes the complexity estimate when editing', async function () {
      pagesRepoStub.updateById.returns(Promise.resolve(123));
      testsRepoStub.bulkUpdate.returns(Promise.resolve());

      await pages.edit({ test: [{ testID: 1, title: 'a', defer: 'n', code: 'data.sort()' }] }, true, 1, 123);
      const [pageID, tests, isOwn] = testsRepoStub.bulkUpdate.getCall(0).args;
      Code.expect(pageID).to.equal(123);
      Code.expect(isOwn).to.be.true();
      Code.expect(tests[0].complexity.overall).to.equal('onlogn');
    });

    lab.test('edits page by calling pageRepo.updateById', async function () {
      pagesRepoStub.updateById.returns(Promise.resolve());
      testsRepoStub.bulkUpdate.returns(Promise.resolve());

      await pages.edit({ id: 222 }, true, 1, 123);
      const call1 = pagesRepoStub.updateById.getCall(0).args;
      Code.expect(call1[0].id).to.equal(222);
      Code.expect(call1[1]).to.equal(123);
    });
  });

  lab.experiment('getPopular', function () {
    lab.test('returns error if getting recent fails', async function () {
      pagesRepoStub.getPopularRecent.returns(Promise.reject(new Error()));
      pagesRepoStub.getPopularAllTime.returns(Promise.resolve());

      const err = await Code.expect(pages.getPopular()).to.reject();
      Code.expect(err).to.be.instanceof(Error);
    });

    lab.test('returns error if getting all-time fails', async function () {
      pagesRepoStub.getPopularRecent.returns(Promise.resolve([]));
      pagesRepoStub.getPopularAllTime.returns(Promise.reject(new Error()));

      const err = await Code.expect(pages.getPopular()).to.reject();
      Code.expect(err).to.be.instanceof(Error);
    });

    lab.test('returns object of recent and all-time pages', async function () {
      pagesRepoStub.getPopularRecent.returns(Promise.resolve([]));
      pagesRepoStub.getPopularAllTime.returns(Promise.resolve([]));

      const results = await pages.getPopular();
      Code.expect(results).to.be.object();
      Code.expect(results.recent).to.be.array();
      Code.expect(results.allTime).to.be.array();
    });
  });

  lab.experiment('find', function () {
    lab.test('calls through to repo method of same name', async function () {
      const testRes = [];
      pagesRepoStub.find.returns(Promise.resolve(testRes));

      const results = await pages.find('query');
      Code.expect(results).to.equal(testRes);
    });
  });

  lab.experiment('updateHits', function () {
    lab.test('calls through to repo method of same name', async function () {
      const pageID = 1;
      pagesRepoStub.updateHits.returns(Promise.resolve());

      await pages.updateHits(pageID);
      Code.expect(pagesRepoStub.updateHits.calledWith(pageID)).to.be.true();
    });
  });

  lab.experiment('getBySlug', function () {
    const slug = 'example';
    const rev = 1;

    lab.test('rejects with error from getting page by stub', async function () {
      const testErrMsg = 'testing';
      const testErr = new Error(testErrMsg);
      pagesRepoStub.getBySlug.returns(Promise.reject(testErr));

      const err = await Code.expect(pages.getBySlug(slug, rev)).to.reject();
      Code.expect(err).to.be.instanceof(Error);
      Code.expect(err.message).to.equal(testErrMsg);
    });

    lab.test('rejects with error if page not found', async function () {
      pagesRepoStub.getBySlug.returns(Promise.resolve([]));

      const err = await Code.expect(pages.getBySlug(slug, rev)).to.reject();
      Code.expect(err).to.be.instanceof(Error);
      Code.expect(err.message).to.equal('Not found');
    });

    lab.test('rejects with error from finding tests', async function () {
      const testErrMsg = 'testing';
      const testErr = new Error(testErrMsg);
      pagesRepoStub.getBySlug.returns(Promise.resolve([{ id: 1 }]));
      testsRepoStub.findByPageID.returns(Promise.reject(testErr));

      const err = await Code.expect(pages.getBySlug(slug, rev)).to.reject();
      Code.expect(err).to.be.instanceof(Error);
      Code.expect(err.message).to.equal(testErrMsg);
    });

    lab.test('rejects with error from finding other pages', async function () {
      const testErrMsg = 'testing';
      const testErr = new Error(testErrMsg);
      pagesRepoStub.getBySlug.returns(Promise.resolve([{ id: 1 }]));
      testsRepoStub.findByPageID.returns(Promise.resolve([]));
      pagesRepoStub.findBySlug.returns(Promise.reject(testErr));

      const err = await Code.expect(pages.getBySlug(slug, rev)).to.reject();
      Code.expect(err).to.be.instanceof(Error);
      Code.expect(err.message).to.equal(testErrMsg);
    });

    lab.test('rejects with error from finding comments', async function () {
      const testErrMsg = 'testing';
      const testErr = new Error(testErrMsg);
      pagesRepoStub.getBySlug.returns(Promise.resolve([{ id: 1 }]));
      testsRepoStub.findByPageID.returns(Promise.resolve([]));
      pagesRepoStub.findBySlug.returns(Promise.resolve());
      commentsRepoStub.findByPageID.returns(Promise.reject(testErr));

      const err = await Code.expect(pages.getBySlug(slug, rev)).to.reject();
      Code.expect(err).to.be.instanceof(Error);
      Code.expect(err.message).to.equal(testErrMsg);
    });

    lab.test('resolves with page, tests, revisions, and comments', async function () {
      const mockTests = [];
      const mockPages = [];
      const mockComments = [];
      pagesRepoStub.getBySlug.returns(Promise.resolve([{ id: 1 }]));
      testsRepoStub.findByPageID.returns(Promise.resolve(mockTests));
      pagesRepoStub.findBySlug.returns(Promise.resolve(mockPages));
      commentsRepoStub.findByPageID.returns(Promise.resolve(mockComments));

      const values = await pages.getBySlug(slug, rev);
      Code.expect(values[0].id).to.equal(1);
      Code.expect(values[1]).to.equal(mockTests);
      Code.expect(values[2]).to.equal(mockPages);
      Code.expect(values[3]).to.equal(mockComments);
    });

    lab.test('analyzes and stores the estimate of tests that have none yet', async function () {
      const stored = { estimate: true, version: complexity.VERSION, overall: 'ologn', calls: [], space: { overall: 'o1', items: [], variables: [] } };
      const mockTests = [
        { testID: 1, code: 'data.sort()', complexity: null },
        { testID: 2, code: 'Math.abs(1)', complexity: stored },
        { testID: 3, code: 'lin(data)', complexity: null }
      ];
      pagesRepoStub.getBySlug.returns(Promise.resolve([{ id: 1, setup: 'function lin(a) { for (var i = 0; i < a.length; i++) {} }', initHTML: '', teardown: '' }]));
      testsRepoStub.findByPageID.returns(Promise.resolve(mockTests));
      pagesRepoStub.findBySlug.returns(Promise.resolve([]));
      commentsRepoStub.findByPageID.returns(Promise.resolve([]));

      const values = await pages.getBySlug(slug, rev);
      Code.expect(values[1].map((t) => t.complexity.overall)).to.equal(['onlogn', 'ologn', 'on']);
      Code.expect(testsRepoStub.setComplexity.callCount).to.equal(2);
      Code.expect(testsRepoStub.setComplexity.getCall(0).args[0]).to.equal(1);
      Code.expect(testsRepoStub.setComplexity.getCall(1).args[0]).to.equal(3);
      Code.expect(testsRepoStub.setComplexity.getCall(1).args[1].overall).to.equal('on');
    });

    lab.test('analyzes again estimates stored by an older version of the rules', async function () {
      const mockTests = [{ testID: 1, code: 'Math.abs(1)', complexity: { version: complexity.VERSION - 1, overall: 'on', calls: [] } }];
      pagesRepoStub.getBySlug.returns(Promise.resolve([{ id: 1, setup: '', initHTML: '', teardown: '' }]));
      testsRepoStub.findByPageID.returns(Promise.resolve(mockTests));
      pagesRepoStub.findBySlug.returns(Promise.resolve([]));
      commentsRepoStub.findByPageID.returns(Promise.resolve([]));

      const values = await pages.getBySlug(slug, rev);
      Code.expect(values[1][0].complexity.overall).to.equal('o1');
      Code.expect(testsRepoStub.setComplexity.calledOnce).to.be.true();
    });

    lab.test('does not touch the database when every test already has an estimate', async function () {
      const mockTests = [{ testID: 1, code: 'x', complexity: { version: complexity.VERSION, overall: 'o1', calls: [], space: { overall: 'o1', items: [], variables: [] } } }];
      pagesRepoStub.getBySlug.returns(Promise.resolve([{ id: 1 }]));
      testsRepoStub.findByPageID.returns(Promise.resolve(mockTests));
      pagesRepoStub.findBySlug.returns(Promise.resolve([]));
      commentsRepoStub.findByPageID.returns(Promise.resolve([]));

      await pages.getBySlug(slug, rev);
      Code.expect(testsRepoStub.setComplexity.called).to.be.false();
    });

    lab.test('still resolves when the estimate cannot be stored', async function () {
      const mockTests = [{ testID: 1, code: 'Math.abs(1)', complexity: null }];
      pagesRepoStub.getBySlug.returns(Promise.resolve([{ id: 1 }]));
      testsRepoStub.findByPageID.returns(Promise.resolve(mockTests));
      pagesRepoStub.findBySlug.returns(Promise.resolve([]));
      commentsRepoStub.findByPageID.returns(Promise.resolve([]));
      testsRepoStub.setComplexity.rejects(new Error('read only'));

      const values = await pages.getBySlug(slug, rev);
      Code.expect(values[1][0].complexity.overall).to.equal('o1');
    });

    lab.test('rejects with error if page not found', async () => {
      pagesRepoStub.getVisibleBySlug.returns(Promise.resolve([]));

      const err = await Code.expect(pages.getVisibleBySlugWithRevisions(slug, rev)).to.reject();
      Code.expect(err).to.be.instanceof(Error);
      Code.expect(err.message).to.equal('Not found');
    });

    lab.test('rejects with error from finding revisions', async () => {
      const testErrMsg = 'testing';
      const testErr = new Error(testErrMsg);
      pagesRepoStub.getVisibleBySlug.returns(Promise.resolve([{ id: 1 }]));
      pagesRepoStub.findVisibleBySlug.returns(Promise.reject(testErr));

      const err = await Code.expect(pages.getVisibleBySlugWithRevisions(slug, rev)).to.reject();
      Code.expect(err).to.be.instanceof(Error);
      Code.expect(err.message).to.equal(testErrMsg);
    });

    lab.test('resolves with page and revisions', async () => {
      const mockPages = [];
      pagesRepoStub.getVisibleBySlug.returns(Promise.resolve([{ id: 1 }]));
      pagesRepoStub.findVisibleBySlug.returns(Promise.resolve(mockPages));

      const values = await pages.getVisibleBySlugWithRevisions(slug, rev);
      Code.expect(values[0].id).to.equal(1);
      Code.expect(values[1]).to.equal(mockPages);
    });
  });

  lab.experiment('deleting', () => {
    lab.test('revision 1 deletes all revisions', async () => {
      pagesRepoStub.deleteAllRevisionsBySlug.returns(Promise.resolve(3));

      const values = await pages.deleteBySlug('oh-yea', 1);
      Code.expect(values).to.equal(3);
    });

    lab.test('revisions above 1 deletes just one revision', async () => {
      pagesRepoStub.deleteOneRevisionBySlug.returns(Promise.resolve(1));

      const values = await pages.deleteBySlug('oh-yea', 2);
      Code.expect(values).to.equal(1);
    });
  });

  lab.experiment('publish', () => {
    lab.test('updates page to be visible', async () => {
      pagesRepoStub.updateById.returns(Promise.resolve());

      await pages.publish(1);
      Code.expect(pagesRepoStub.updateById.args[0][0]).to.include({
        visible: 'y'
      });
      Code.expect(pagesRepoStub.updateById.args[0][1]).to.equal(1);
    });
  });
});
