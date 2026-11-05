'use strict';

exports.plugin = {
  name: 'web/health',
  dependencies: ['db'],
  register: (server) => {
    server.route({
      method: 'GET',
      path: '/health',
      handler: async (request, h) => {
        await server.plugins.db.genericQuery('SELECT 1;');
        return h.response().code(200);
      }
    });
  }
};
