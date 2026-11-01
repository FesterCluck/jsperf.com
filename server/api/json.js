'use strict';

const mapTest = function (test) {
  return {
    testID: test.testID,
    title: test.title,
    code: test.code,
    defer: test.defer
  };
};

const mapPage = function (page) {
  return {
    id: page.id,
    slug: page.slug,
    revision: page.revision,
    title: page.title,
    info: page.info,
    setup: page.setup,
    teardown: page.teardown,
    published: page.published,
    updated: page.updated,
    maxRev: page.maxRev
  };
};

const mapRevision = function (revision) {
  return {
    author: revision.author,
    revision: revision.revision,
    published: revision.published,
    updated: revision.updated,
    maxRev: revision.maxRev,
    title: revision.title
  };
};

const mapComment = function (comment) {
  return {
    id: comment.id,
    author: comment.author,
    published: comment.published,
    content: comment.content
  };
};

const register = (server, options) => {
  const pagesService = server.plugins['services/pages'];

  server.route({
    method: 'GET',
    path: '/{slug}/{revision}.json',
    handler: async (request, h) => {
      const results = await pagesService.getBySlug(request.params.slug, request.params.revision);

      return h.response({
        page: mapPage(results[0]),
        tests: results[1].map(mapTest),
        revisions: results[2].map(mapRevision),
        comments: results[3].map(mapComment)
      })
        .type('application/json')
        .code(200);
    }
  });
};

exports.plugin = {
  name: 'api/json',
  dependencies: ['services/pages'],
  register
};
