'use strict';

const name = 'services/pages';

const register = (server, options) => {
  const pagesRepo = server.plugins['repositories/pages'];
  const testsRepo = server.plugins['repositories/tests'];
  const commentsRepo = server.plugins['repositories/comments'];

  server.expose('checkIfSlugAvailable', async (server, slug) => {
    // routes registered by the app should be considered reserved
    if (server.table().some((route) => route.path.substr(1) === slug)) {
      return false;
    }

    // does it exist in table?
    const row = await pagesRepo.get('id', { slug });
    return !row;
  });

  server.expose('create', async (payload) => {
    const page = Object.assign({}, payload);
    delete page.test;
    page.published = new Date();

    const pageID = await pagesRepo.create(page);
    await testsRepo.bulkCreate(pageID, payload.test);
    return pageID;
  });

  server.expose('edit', async (payload, isOwn, maxRev, pageId) => {
    const page = Object.assign({}, payload);
    delete page.test;

    let resultingRevision = maxRev;
    if (!isOwn) {
      resultingRevision = maxRev + 1;
    }

    let currentPageID;
    if (isOwn) {
      currentPageID = await pagesRepo.updateById(page, pageId);
    } else {
      // someone is effectively forking your page so create a new one
      page.published = new Date();
      // FIXME: if slug has changed from original page, revision needs to be set to 1 or else can't fetch page by slug root
      page.revision = resultingRevision;
      currentPageID = await pagesRepo.create(page);
    }

    await testsRepo.bulkUpdate(currentPageID, payload.test, isOwn);
    return resultingRevision;
  });

  server.expose('getPopular', async () => {
    const [recent, allTime] = await Promise.all([
      pagesRepo.getPopularRecent(),
      pagesRepo.getPopularAllTime()
    ]);

    return { recent, allTime };
  });

  server.expose('find', (...args) => pagesRepo.find(...args));

  server.expose('updateHits', (...args) => pagesRepo.updateHits(...args));

  server.expose('getBySlug', async function (slug, rev) {
    server.log(['debug'], `${name}::getBySlug: ${JSON.stringify(arguments)}`);

    // can we find the page?
    const pages = await pagesRepo.getBySlug(slug, rev);
    if (pages.length === 0) {
      throw new Error('Not found');
    }

    const page = pages[0];

    // find its tests, other revisions of page and comments for page
    const tests = await testsRepo.findByPageID(page.id);
    const revisions = await pagesRepo.findBySlug(slug);
    const comments = await commentsRepo.findByPageID(page.id);

    return [page, tests, revisions, comments];
  });

  server.expose('getVisibleBySlugWithRevisions', async function (slug) {
    server.log(['debug'], `${name}::getVisibleBySlugWithRevisions ${JSON.stringify(arguments)}`);

    // can we find the page?
    const pages = await pagesRepo.getVisibleBySlug(slug, 1);
    if (pages.length === 0) {
      throw new Error('Not found');
    }

    // find other revisions of page
    const revisions = await pagesRepo.findVisibleBySlug(slug);
    return [pages[0], revisions];
  });

  server.expose('deleteBySlug', function (slug, rev) {
    server.log(['debug'], `${name}::deleteBySlug ${JSON.stringify(arguments)}`);

    if (rev > 1) {
      return pagesRepo.deleteOneRevisionBySlug(slug, rev);
    } else {
      return pagesRepo.deleteAllRevisionsBySlug(slug);
    }
  });

  server.expose('publish', function (pageID) {
    const now = new Date();
    const modify = {
      visible: 'y',
      updated: now,
      published: now
    };

    server.log(['debug'], `${name}::publish ${pageID} ${modify}`);
    return pagesRepo.updateById(modify, pageID);
  });
};

exports.plugin = {
  name,
  dependencies: [
    'repositories/comments',
    'repositories/pages',
    'repositories/tests'
  ],
  register
};
