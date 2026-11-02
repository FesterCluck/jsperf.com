exports.register = function (server, options, next) {
  server.log(['debug'], 'registering auth strategies');

  server.auth.strategy('session', 'cookie', {
    password: options.session.password,
    cookie: options.session.cookie,
    redirectTo: false,
    isSecure: options.session.isSecure
  });

  server.auth.scheme('emulated-github', function () {
    return {
      authenticate: function (request, reply) {
        return reply.continue({
          credentials: {
            provider: 'github',
            profile: {
              id: 1001,
              username: 'testuser',
              displayName: 'Test User',
              email: 'testuser@example.com',
              raw: {
                login: 'testuser',
                id: 1001,
                name: 'Test User',
                email: 'testuser@example.com',
                blog: 'https://example.com',
                html_url: 'https://example.com'
              }
            }
          }
        });
      }
    };
  });

  server.auth.strategy('github', 'emulated-github');

  return next();
};

exports.register.attributes = {
  name: 'web/auth/strategies'
};
