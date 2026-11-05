const Lab = require('@hapi/lab');
const Code = require('@hapi/code');
const Hapi = require('@hapi/hapi');

const StrategiesPlugin = {
  plugin: require('../../../../../server/web/auth/strategies'),
  options: {
    session: {
      password: 'password-should-be-32-characters',
      cookie: 'jsperf',
      isSecure: true
    }
  }
};

const lab = exports.lab = Lab.script();

lab.experiment('strategies', () => {
  lab.test('registers auth strategies', async () => {
    const server = Hapi.server();

    await server.register([require('@hapi/cookie'), StrategiesPlugin]);

    server.route({ method: 'GET', path: '/private', options: { auth: 'session' }, handler: () => 'secret' });

    const res = await server.inject('/private');
    Code.expect(res.statusCode).to.equal(401);

    const ok = await server.inject({ url: '/private', auth: { strategy: 'session', credentials: { username: 'a' } } });
    Code.expect(ok.statusCode).to.equal(200);
  });

  lab.test('scopes the session cookie to the configured path', async () => {
    const server = Hapi.server();

    await server.register([require('@hapi/cookie'), { plugin: StrategiesPlugin.plugin, options: { session: { ...StrategiesPlugin.options.session, path: '/next' } } }]);
    server.route({ method: 'GET', path: '/login', options: { auth: 'session' }, handler: (request, h) => { request.cookieAuth.set({ id: 1 }); return 'ok'; } });
    server.route({ method: 'GET', path: '/set', options: { auth: { strategy: 'session', mode: 'try' } }, handler: (request) => { request.cookieAuth.set({ id: 1 }); return 'ok'; } });

    const res = await server.inject('/set');
    Code.expect(res.headers['set-cookie'][0]).to.contain('Path=/next');
    Code.expect(res.headers['set-cookie'][0]).to.startWith('jsperf=');
  });
});
