'use strict';

exports.plugin = {
  name: 'web/contributors',
  register: (server) => {
    server.route({
      method: 'GET',
      path: '/contributors',
      handler: (request, h) => h.view('contributors/index', {
        headTitle: 'Contributors'
      })
    });
  }
};
