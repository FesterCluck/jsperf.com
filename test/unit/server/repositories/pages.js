const Lab = require('@hapi/lab');
const Code = require('@hapi/code');
const Support = require('../../../support/server');
const sinon = require('sinon');

const Pages = require('../../../../server/repositories/pages');

const MockDb = Support.mock('db', ['genericQuery']);

const lab = exports.lab = Lab.script();

lab.experiment('Pages Repository', function () {
  const table = 'pages';
  let server, pages, genericQueryStub;

  lab.before(async () => {
    server = await Support.createServer({ views: false, plugins: [MockDb, Pages] });

    pages = server.plugins['repositories/pages'];
  });

  lab.beforeEach(async () => {
    genericQueryStub = sinon.stub(server.plugins.db, 'genericQuery');
  });

  lab.afterEach(async () => {
    genericQueryStub.restore();
  });

  lab.experiment('create', function () {
    let payload;
    let insertId;

    lab.before(async function () {
      payload = {
        browserscopeID: 123
      };

      insertId = 1;
    });

    lab.test('inserts payload', async function () {
      genericQueryStub.returns(Promise.resolve({ insertId }));

      const newId = await pages.create(payload);
      Code.expect(
        genericQueryStub.calledWithExactly(
          'INSERT INTO ?? SET ?',
          [
            'pages',
            payload
          ]
        )
      ).to.be.true();
      Code.expect(newId).to.equal(insertId);
    });

    lab.test('returns an error when query fails', async function () {
      const testErrMsg = 'testing';
      const testErr = new Error(testErrMsg);

      genericQueryStub.returns(Promise.reject(testErr));

      const err = await Code.expect(pages.create(payload)).to.reject();
      Code.expect(err).to.be.instanceof(Error);
      Code.expect(err.message).to.equal(testErrMsg);
    });
  });

  lab.experiment('get', function () {
    let testFields;
    let testWhere;
    let id;

    lab.before(async function () {
      testFields = 'id';
      testWhere = { slug: 'test' };
      id = 1;
    });

    lab.test('returns single row', async function () {
      genericQueryStub.returns(Promise.resolve([{ id }]));

      const row = await pages.get(testFields, testWhere);
      Code.expect(
        genericQueryStub.calledWithExactly(
          'SELECT ?? FROM ?? WHERE ? LIMIT 1',
          [
            testFields,
            'pages',
            testWhere
          ]
        )
      ).to.be.true();
      Code.expect(row).to.be.object();
      Code.expect(row.id).to.equal(id);
    });

    lab.test('returns an error when query fails', async function () {
      const testErrMsg = 'testing';
      const testErr = new Error(testErrMsg);

      genericQueryStub.returns(Promise.reject(testErr));

      const err = await Code.expect(pages.get(testFields, testWhere)).to.reject();
      Code.expect(err).to.be.instanceof(Error);
      Code.expect(err.message).to.equal(testErrMsg);
    });
  });

  lab.experiment('getLatestVisible', function () {
    lab.test('returns number of rows of latest, visible pages', async function () {
      genericQueryStub.returns(Promise.resolve([]));

      const rows = await pages.getLatestVisible(250);
      Code.expect(rows).to.be.array();
    });

    lab.test('returns an error when query fails', async function () {
      const testErrMsg = 'testing';
      const testErr = new Error(testErrMsg);

      genericQueryStub.returns(Promise.reject(testErr));

      const err = await Code.expect(pages.getLatestVisible(250)).to.reject();
      Code.expect(err).to.be.instanceof(Error);
      Code.expect(err.message).to.equal(testErrMsg);
    });
  });

  lab.experiment('getLatestVisibleForAuthor', function () {
    lab.test('returns number of rows of latest, visible pages for author', async function () {
      genericQueryStub.returns(Promise.resolve([]));

      const rows = await pages.getLatestVisibleForAuthor('test-author');
      Code.expect(rows).to.be.array();
    });

    lab.test('returns an error when query fails', async function () {
      const testErrMsg = 'testing';
      const testErr = new Error(testErrMsg);

      genericQueryStub.returns(Promise.reject(testErr));

      const err = await Code.expect(pages.getLatestVisibleForAuthor('test-author')).to.reject();
      Code.expect(err).to.be.instanceof(Error);
      Code.expect(err.message).to.equal(testErrMsg);
    });
  });

  lab.experiment('getBySlug', function () {
    lab.test('returns page given slug', async function () {
      const slug = 'test-slug';
      const rev = 1;
      genericQueryStub.returns(Promise.resolve({}));

      const page = await pages.getBySlug(slug, rev);
      Code.expect(page).to.be.object();
      Code.expect(genericQueryStub.calledWithExactly(
        'SELECT *, (SELECT MAX(revision) FROM ?? WHERE slug = ? ) AS maxRev FROM ?? WHERE slug = ? AND revision = ?',
        [table, slug, table, slug, rev]
      )).to.be.true();
    });
  });

  lab.experiment('getVisibleBySlug', () => {
    lab.test('returns page given slug and rev', async () => {
      const slug = 'test-slug';
      const rev = 1;
      genericQueryStub.returns(Promise.resolve({}));

      const page = await pages.getVisibleBySlug(slug, rev);
      Code.expect(page).to.be.object();
      Code.expect(genericQueryStub.calledWithExactly(
        'SELECT *, (SELECT MAX(revision) FROM ?? WHERE slug = ? ) AS maxRev FROM ?? WHERE slug = ? AND revision = ? AND visible = ?',
        [table, slug, table, slug, rev, 'y']
      )).to.be.true();
    });
  });

  lab.experiment('find', function () {
    lab.test('returns search results', async function () {
      const searchTerms = 'test query';
      const wc = '%' + searchTerms + '%';
      genericQueryStub.returns(Promise.resolve([]));

      const page = await pages.find(searchTerms);
      Code.expect(page).to.be.array();
      Code.expect(genericQueryStub.calledWithExactly(
        'SELECT * FROM (SELECT x.id AS pID, x.slug AS url, x.revision, x.title, x.published, x.updated, COUNT(x.slug) AS revisionCount FROM pages x WHERE x.title LIKE ? OR x.info LIKE ? GROUP BY x.slug ORDER BY updated DESC LIMIT 0, 50) y LEFT JOIN (SELECT t.pageID, COUNT(t.pageID) AS testCount FROM tests t GROUP BY t.pageID) z ON z.pageID = y.pID;',
        [wc, wc]
      )).to.be.true();
    });
  });

  lab.experiment('findBySlug', function () {
    lab.test('returns query results', async function () {
      const slug = 'oh-yea';
      genericQueryStub.returns(Promise.resolve([]));

      const p = await pages.findBySlug(slug);
      Code.expect(p).to.be.array();
      Code.expect(genericQueryStub.calledWithExactly(
        'SELECT published, updated, author, authorGitHub, authorEmail, authorURL, revision, visible, title FROM pages WHERE slug = ? ORDER BY published ASC',
        [slug]
      )).to.be.true();
    });
  });

  lab.experiment('findVisibleBySlug', () => {
    lab.test('returns query results', async () => {
      const slug = 'oh-yea';
      genericQueryStub.returns(Promise.resolve([]));

      const p = await pages.findVisibleBySlug(slug);
      Code.expect(p).to.be.array();
      Code.expect(genericQueryStub.calledWithExactly(
        'SELECT published, updated, author, authorGitHub, authorEmail, revision, visible, title FROM pages WHERE slug = ? AND visible = ? ORDER BY published ASC',
        [slug, 'y']
      )).to.be.true();
    });
  });

  lab.experiment('deleteOneRevisionBySlug', () => {
    lab.test('returns query results', async () => {
      const slug = 'oh-yea';
      const rev = 2;
      genericQueryStub.onFirstCall().resolves({});
      genericQueryStub.onSecondCall().resolves({ affectedRows: 1 });

      const affected = await pages.deleteOneRevisionBySlug(slug, rev);
      Code.expect(affected).to.equal(1);
      Code.expect(genericQueryStub.onFirstCall().stub.calledWithExactly(
        'DELETE FROM tests WHERE pageID IN (SELECT id FROM pages WHERE slug = ? AND revision = ?)',
        [slug, rev]
      )).to.be.true();

      Code.expect(genericQueryStub.onSecondCall().stub.calledWithExactly(
        'DELETE FROM pages WHERE slug = ? AND revision = ?',
        [slug, rev]
      )).to.be.true();
    });
  });

  lab.experiment('deleteAllRevisionsBySlug', () => {
    lab.test('returns query results', async () => {
      const slug = 'oh-yea';
      genericQueryStub.onFirstCall().resolves({});
      genericQueryStub.onSecondCall().resolves({ affectedRows: 3 });

      const affected = await pages.deleteAllRevisionsBySlug(slug);
      Code.expect(affected).to.equal(3);
      Code.expect(genericQueryStub.onFirstCall().stub.calledWithExactly(
        'DELETE FROM tests WHERE pageID IN (SELECT id FROM pages WHERE slug = ?)',
        [slug]
      )).to.be.true();

      Code.expect(genericQueryStub.onSecondCall().stub.calledWithExactly(
        'DELETE FROM pages WHERE slug = ?',
        [slug]
      )).to.be.true();
    });
  });

  lab.experiment('getSitemap', function () {
    lab.test('returns an error when query fails', async function () {
      const testErrMsg = 'testing';
      const testErr = new Error(testErrMsg);

      genericQueryStub.returns(Promise.reject(testErr));

      const err = await Code.expect(pages.getSitemap()).to.reject();
      Code.expect(err).to.be.instanceof(Error);
      Code.expect(err.message).to.equal(testErrMsg);
    });

    lab.test('returns tests to use for sitemap', async function () {
      genericQueryStub.returns(Promise.resolve([]));

      const results = await pages.getSitemap();
      Code.expect(results).to.be.array();
    });
  });

  lab.experiment('getPopularRecent', function () {
    lab.test('returns an error when query fails', async function () {
      const testErrMsg = 'testing';
      const testErr = new Error(testErrMsg);

      genericQueryStub.returns(Promise.reject(testErr));

      const err = await Code.expect(pages.getPopularRecent()).to.reject();
      Code.expect(err).to.be.instanceof(Error);
      Code.expect(err.message).to.equal(testErrMsg);
    });

    lab.test('returns at most 30 recent popular tests', async function () {
      genericQueryStub.returns(Promise.resolve(new Array(30)));

      const results = await pages.getPopularRecent();
      Code.expect(results).to.be.array();
    });
  });

  lab.experiment('getPopularAllTime', function () {
    lab.test('returns an error when query fails', async function () {
      const testErrMsg = 'testing';
      const testErr = new Error(testErrMsg);

      genericQueryStub.returns(Promise.reject(testErr));

      const err = await Code.expect(pages.getPopularAllTime()).to.reject();
      Code.expect(err).to.be.instanceof(Error);
      Code.expect(err.message).to.equal(testErrMsg);
    });

    lab.test('returns at most 30 recent popular tests', async function () {
      genericQueryStub.returns(Promise.resolve(new Array(30)));

      const results = await pages.getPopularAllTime();
      Code.expect(results).to.be.array();
    });
  });

  lab.experiment('updateHits', function () {
    lab.test('update query for hits + 1', async function () {
      const pageID = 1;
      genericQueryStub.returns(Promise.resolve());

      await pages.updateHits(pageID);
      Code.expect(genericQueryStub.calledWithExactly(
        'UPDATE ?? SET hits = hits + 1 WHERE id = ?',
        [table, pageID]
      )).to.be.true();
    });
  });

  lab.experiment('updateById', function () {
    lab.test('generic update query', async function () {
      const modify = { browserscopeID: 'abc123' };
      const pageID = 1;
      genericQueryStub.returns(Promise.resolve());

      await pages.updateById(modify, pageID);
      Code.expect(genericQueryStub.calledWithExactly(
        'UPDATE ?? SET ? WHERE id = ?',
        [table, modify, pageID]
      )).to.be.true();
    });

    lab.test('returns updated pageId', async function () {
      const modify = { browserscopeID: 'abc123' };
      const pageID = 1;
      genericQueryStub.returns(Promise.resolve());

      const newId = await pages.updateById(modify, pageID);
      Code.expect(newId).to.equal(pageID);
    });
  });
});
