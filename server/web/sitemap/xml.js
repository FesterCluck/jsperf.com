'use strict';

const register = (server) => {
  const pagesRepo = server.plugins['repositories/pages'];

  server.route({
    method: 'GET',
    path: '/sitemap.xml',
    handler: async (request, h) => {
      const items = await pagesRepo.getSitemap();

      return h
        .view('sitemap/xml', { items }, { layout: false })
        .header('Content-Type', 'application/xml;charset=UTF-8');
    }
  });
};

exports.plugin = {
  name: 'web/sitemap',
  dependencies: ['repositories/pages'],
  register
};
