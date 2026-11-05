'use strict';

exports.plugin = {
  name: 'web/assets',
  dependencies: ['@hapi/inert'],
  register: (server) => {
    // public assets like CSS and JS
    server.route({
      method: 'GET',
      path: '/public/{path*}',
      handler: {
        directory: {
          path: 'public',
          index: false,
          redirectToSlash: false
        }
      }
    });

    server.route({
      method: 'GET',
      path: '/robots.txt',
      handler: {
        file: 'public/robots.txt'
      }
    });
  }
};
