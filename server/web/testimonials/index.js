'use strict';

exports.plugin = {
  name: 'web/testimonials',
  register: (server) => {
    server.route({
      method: 'GET',
      path: '/testimonials',
      handler: (request, h) => h.view('testimonials/index', {
        headTitle: 'Testimonials'
      })
    });
  }
};
