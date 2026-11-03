'use strict';

const Boom = require('@hapi/boom');

const register = (server) => {
  const pagesService = server.plugins['services/pages'];

  server.route({
    method: 'GET',
    path: '/search{ext?}',
    handler: async (request, h) => {
      if (request.params.ext && request.params.ext !== '.atom') {
        throw Boom.notFound();
      }

      const context = {
        headTitle: 'Search'
      };

      const q = request.query.q;
      if (!(q && q.length > 0)) {
        return h.view('search/form', context);
      }

      context.q = q;
      const results = await pagesService.find(q);
      let updated;
      if (results.length > 0) {
        context.pages = results;
        updated = results[0].updated;
      } else {
        context.genError = `No results found for query: ${q}`;
        updated = new Date();
      }

      if (request.params.ext === '.atom') {
        return h.view('search/atom', context, { layout: false })
          .header('Content-Type', 'application/atom+xml;charset=UTF-8')
          .header('Last-Modified', updated.toString());
      }

      return h.view('search/results', context);
    }
  });
};

exports.plugin = {
  name: 'web/search',
  dependencies: ['services/pages'],
  register
};
