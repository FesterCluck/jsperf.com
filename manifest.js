'use strict';

const Confidence = require('confidence');
const Qs = require('qs');
const config = require('./config');

const basePath = config.get('/basePath') || '';
const host = config.get('/host');
const trustProxy = config.get('/trustProxy');
const cookieName = config.get('/auth/session/name');
// the cookie path is the prefix, or '/' when the app is mounted at the root
const cookiePath = basePath || '/';

const criteria = {
  env: config.get('/env')
};

const viewContextDefault = {
  cssFile: 'main.css',
  hljsCssVer: require('highlight.js/package.json').version,
  scheme: config.get('/scheme'),
  domain: config.get('/domain'),
  base: basePath
};

const manifest = {
  $meta: 'jsPerf backend',
  server: {
    port: config.get('/port'),
    // only bind to a specific interface when HOST is set (e.g. 127.0.0.1 behind nginx)
    ...(host ? { host } : {}),
    app: { basePath, trustProxy },
    // '/next/' must reach the home route mounted at '/next'
    ...(basePath ? { router: { stripTrailingSlash: true } } : {}),
    routes: {
      security: true
    },
    // replaces hapi-qs: support nested query strings (a[b]=c)
    query: {
      parser: (query) => Qs.parse(query)
    }
  },
  register: {
    plugins: [
      { plugin: '@hapi/scooter' },
      { plugin: './server/lib/qsPayload' },
      {
        plugin: './server/lib/logging',
        options: {
          level: {
            $filter: 'env',
            production: 'info',
            $default: 'debug'
          },
          pretty: {
            $filter: 'env',
            production: false,
            $default: true
          },
          // loggly is optional: logs are only shipped when a token is configured
          loggly: {
            token: config.get('/loggly/token'),
            subdomain: config.get('/loggly/subdomain'),
            hostname: config.get('/domain')
          }
        }
      },
      { plugin: '@hapi/inert' },
      {
        // replaces visionary; engine names are resolved to modules in index.js
        plugin: '@hapi/vision',
        options: {
          engines: {
            hbs: 'handlebars'
          },
          relativeTo: __dirname,
          path: './server/web',
          layout: true,
          helpersPath: 'templates/helpers',
          partialsPath: 'templates/partials',
          isCached: {
            $filter: 'env',
            development: false,
            $default: true
          },
          context: {
            $filter: 'env',
            development: Object.assign({}, viewContextDefault, {
              debug: true,
              cssFile: `main.src.css?${Date.now()}`
            }),
            $default: viewContextDefault
          }
        }
      },
      {
        plugin: '@hapi/yar',
        options: {
          cookieOptions: {
            password: config.get('/auth/session/pass'),
            isSecure: config.get('/auth/session/secure'),
            isHttpOnly: true,
            path: cookiePath
          },
          // keeps the flash/state cookie from colliding with another app on the same domain
          name: cookieName === 'sid-jsperf' ? 'session' : `${cookieName}-yar`,
        }
      },
      {
        plugin: '@hapi/crumb',
        options: {
          cookieOptions: {
            isSecure: config.get('/auth/session/secure'),
            isHttpOnly: true,
            path: cookiePath
          },
          // static assets and health checks don't need a CSRF token
          skip: (request) => request.path.startsWith(`${basePath}/public/`) || request.path === `${basePath}/health`
        }
      },
      { plugin: '@hapi/cookie' },
      {
        plugin: './server/web/auth/strategies',
        options: {
          session: {
            password: config.get('/auth/session/pass'),
            cookie: cookieName,
            path: cookiePath,
            isSecure: config.get('/auth/session/secure')
          }
        }
      },
      {
        plugin: './server/lib/db',
        options: {
          host: config.get('/mysql/host'),
          port: config.get('/mysql/port'),
          user: config.get('/mysql/user'),
          pass: config.get('/mysql/pass'),
          db: config.get('/mysql/db'),
          connectionLimit: config.get('/mysql/connectionLimit'),
          debug: criteria.env !== 'production'
        }
      },
      {
        plugin: './server/lib/cache',
        options: {
          host: config.get('/cache/host'),
          port: config.get('/cache/port'),
          password: config.get('/cache/password'),
          partition: 'jsperf'
        }
      },
      { plugin: './server/repositories/comments' },
      { plugin: './server/repositories/pages' },
      { plugin: './server/repositories/tests' },
      { plugin: './server/repositories/users' },
      { plugin: './server/services/comments' },
      { plugin: './server/services/pages' },
      { plugin: './server/api/json' },
      { plugin: './server/web/auth/local' },
      { plugin: './server/web/browse' },
      { plugin: './server/web/contributors' },
      { plugin: './server/web/errors' },
      { plugin: './server/web/faq' },
      { plugin: './server/web/health' },
      { plugin: './server/web/home' },
      { plugin: './server/web/popular' },
      { plugin: './server/web/public' },
      { plugin: './server/web/redirects' },
      { plugin: './server/web/search' },
      { plugin: './server/web/sitemap/xml' },
      { plugin: './server/web/test' },
      { plugin: './server/web/edit' }
    ]
  }
};

// serve every route under BASE_PATH: plugins that register routes get the prefix
if (basePath) {
  const withoutRoutes = ['@hapi/', './server/lib/', './server/repositories/', './server/services/'];
  for (const entry of manifest.register.plugins) {
    if (!withoutRoutes.some((p) => entry.plugin.startsWith(p))) {
      entry.routes = { prefix: basePath };
    }
  }
}

const store = new Confidence.Store(manifest);

exports.get = (key) => store.get(key, criteria);

exports.meta = (key) => store.meta(key, criteria);
