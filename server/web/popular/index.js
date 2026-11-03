'use strict';

const register = (server) => {
  const pagesService = server.plugins['services/pages'];

  server.route({
    method: 'GET',
    path: '/popular',
    handler: async (request, h) => {
      const popular = await pagesService.getPopular();

      return h.view('popular/index', {
        headTitle: 'Popular test cases',
        recent: popular.recent,
        allTime: popular.allTime
      });
    }
  });
};

exports.plugin = {
  name: 'web/popular',
  dependencies: ['services/pages'],
  register
};
