'use strict';

const Crypto = require('node:crypto');
const basePath = require('../../lib/basePath');
const defaults = require('../../lib/defaults');
const password = require('../../lib/password');
const clientIp = require('../../lib/clientIp');
const rateLimit = require('../../lib/rateLimit');
const schema = require('../../lib/schema');

// verified against when the username is unknown so response time doesn't reveal which usernames exist
let dummyHash;
const getDummyHash = () => {
  dummyHash = dummyHash || password.hash(Crypto.randomUUID());
  return dummyHash;
};

const tryAuth = { mode: 'try', strategy: 'session' };

const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;

exports.plugin = {
  name: 'web/auth/local',
  dependencies: ['repositories/users'],
  register: (server) => {
    const usersRepo = server.plugins['repositories/users'];
    // per client address: failed logins and registrations
    const loginLimiter = rateLimit({ max: MAX_ATTEMPTS, windowMs: ATTEMPT_WINDOW_MS });
    const registerLimiter = rateLimit({ max: MAX_ATTEMPTS, windowMs: ATTEMPT_WINDOW_MS });

    const startSession = (request, user) => {
      request.cookieAuth.set({
        id: user.id,
        username: user.username,
        displayName: user.username,
        email: ''
      });
    };

    const renderForm = (h, view, context, code = 200) => h.view(view, context).code(code);

    server.route({
      method: 'GET',
      path: '/login',
      options: { auth: tryAuth },
      handler: (request, h) => {
        if (request.auth.isAuthenticated) {
          return h.redirect(basePath.url(request, '/'));
        }

        return h.view('auth/login', { headTitle: 'Log in' });
      }
    });

    server.route({
      method: 'POST',
      path: '/login',
      options: { auth: tryAuth },
      handler: async (request, h) => {
        const ip = clientIp(request);
        const context = { headTitle: 'Log in', genError: defaults.errors.auth.invalid };
        if (loginLimiter.blocked(ip)) {
          context.genError = defaults.errors.auth.tooMany;
          return renderForm(h, 'auth/login', context, 429);
        }

        const { error, value } = schema.login.validate(request.payload);
        if (error) {
          loginLimiter.hit(ip);
          return renderForm(h, 'auth/login', context, 400);
        }

        const user = await usersRepo.getByUsername(value.username);
        const valid = await password.verify(value.password, user ? user.passwordHash : await getDummyHash());
        if (!user || !valid) {
          loginLimiter.hit(ip);
          context.username = value.username;
          return renderForm(h, 'auth/login', context, 400);
        }

        loginLimiter.reset(ip);
        startSession(request, user);
        return h.redirect(basePath.url(request, '/'));
      }
    });

    server.route({
      method: 'GET',
      path: '/register',
      options: { auth: tryAuth },
      handler: (request, h) => {
        if (request.auth.isAuthenticated) {
          return h.redirect(basePath.url(request, '/'));
        }

        return h.view('auth/register', { headTitle: 'Register' });
      }
    });

    server.route({
      method: 'POST',
      path: '/register',
      options: { auth: tryAuth },
      handler: async (request, h) => {
        const context = { headTitle: 'Register' };
        const ip = clientIp(request);
        if (registerLimiter.blocked(ip)) {
          context.genError = defaults.errors.auth.tooMany;
          return renderForm(h, 'auth/register', context, 429);
        }

        registerLimiter.hit(ip);
        const payload = request.payload;
        const { error, value } = schema.register.validate(payload);
        if (error) {
          context.username = payload.username;
          switch (error.details[0].path[0]) {
            case 'username':
              context.usernameError = defaults.errors.auth.username;
              break;
            case 'password':
              context.passwordError = defaults.errors.auth.password;
              break;
            default:
              context.genError = defaults.errors.auth.general;
          }
          return renderForm(h, 'auth/register', context, 400);
        }

        const taken = () => {
          context.username = value.username;
          context.usernameError = defaults.errors.auth.usernameTaken;
          return renderForm(h, 'auth/register', context, 400);
        };

        if (await usersRepo.getByUsername(value.username)) {
          return taken();
        }

        let id;
        try {
          id = await usersRepo.create({
            username: value.username,
            passwordHash: await password.hash(value.password),
            created: new Date()
          });
        } catch (err) {
          if (err.code === 'ER_DUP_ENTRY') {
            return taken();
          }
          throw err;
        }

        startSession(request, { id, username: value.username });
        return h.redirect(basePath.url(request, '/'));
      }
    });

    // POST (with CSRF crumb) so other sites can't log people out
    server.route({
      method: 'POST',
      path: '/logout',
      options: { auth: tryAuth },
      handler: (request, h) => {
        request.cookieAuth.clear();
        request.yar.reset();
        return h.redirect(basePath.url(request, '/'));
      }
    });

    // attach credentials to view context to let people know they are logged in
    server.ext('onPreResponse', (request, h) => {
      const response = request.response;
      if (response.variety === 'view') {
        response.source.context = response.source.context || {};
        response.source.context.credentials = request.auth.isAuthenticated ? request.auth.credentials : null;
      }

      return h.continue;
    });
  }
};
