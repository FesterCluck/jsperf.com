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
});
