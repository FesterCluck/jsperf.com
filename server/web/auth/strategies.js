'use strict';

exports.plugin = {
  name: 'web/auth/strategies',
  dependencies: ['@hapi/cookie'],
  register: (server, options) => {
    server.log(['debug'], 'registering auth strategies');

    server.auth.strategy('session', 'cookie', {
      cookie: {
        name: options.session.cookie,
        password: options.session.password,
        isSecure: options.session.isSecure,
        isHttpOnly: true,
        isSameSite: 'Lax',
        path: '/',
        ttl: 7 * 24 * 60 * 60 * 1000
      },
      redirectTo: false
    });
  }
};
