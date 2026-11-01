'use strict';

const Path = require('node:path');
const Hapi = require('@hapi/hapi');
const Handlebars = require('handlebars');

const root = Path.join(__dirname, '..', '..');

exports.cookiePass = 'password-should-be-32-characters';

// creates a plugin that exposes no-op functions so tests can stub them
exports.mock = (name, methods) => ({
  plugin: {
    name,
    register: (server) => {
      // `methods` is a list of names or an object of name -> implementation
      const impls = Array.isArray(methods) ? Object.fromEntries(methods.map((m) => [m, () => {}])) : methods;
      for (const [method, impl] of Object.entries(impls)) {
        server.expose(method, impl);
      }
    }
  }
});

exports.createServer = async ({ views = true, yar = false, auth = false, scooter = false, plugins = [] } = {}) => {
  const server = Hapi.server();

  if (auth) {
    await server.register(require('@hapi/cookie'));
    await server.register({
      plugin: require('../../server/web/auth/strategies'),
      options: { session: { cookie: 'sid-jsperf', password: exports.cookiePass, isSecure: false } }
    });
  }

  if (views) {
    await server.register({
      plugin: require('@hapi/vision'),
      options: {
        engines: { hbs: Handlebars },
        path: './server/web',
        layout: true,
        helpersPath: 'templates/helpers',
        partialsPath: 'templates/partials',
        relativeTo: root,
        context: (request) => ({
          credentials: request && request.auth ? request.auth.credentials : null,
          scheme: 'http',
          domain: 'jsperf.test'
        })
      }
    });
  }

  if (yar) {
    await server.register({
      plugin: require('@hapi/yar'),
      options: { cookieOptions: { password: exports.cookiePass, isSecure: false } }
    });
  }

  if (scooter) {
    await server.register(require('@hapi/scooter'));
  }

  await server.register(plugins);
  await server.initialize();

  return server;
};

// returns the value of the cookie to send back in a request header after hitting `url`
exports.sessionCookie = async (server, url) => {
  const res = await server.inject(url);
  return res.headers['set-cookie'].map((c) => c.split(';')[0]).join('; ');
};
