const Lab = require('@hapi/lab');
const Code = require('@hapi/code');
const Hapi = require('@hapi/hapi');
const Proxyquire = require('proxyquire');

const lab = exports.lab = Lab.script();

lab.experiment('cache plugin', () => {
  lab.test('is a no-op cache without redis config', async () => {
    const Cache = require('../../../../server/lib/cache');
    const server = Hapi.server();
    await server.register({ plugin: Cache, options: {} });

    const cache = server.plugins.cache;
    Code.expect(await cache.get('k')).to.be.null();
    Code.expect(await cache.set('k', 'v', 1)).to.be.undefined();
    Code.expect(await cache.drop('k')).to.be.undefined();
  });

  lab.test('uses catbox-redis when a host is configured', async () => {
    const calls = [];
    class Client {
      constructor (engine, options) {
        calls.push(['new', engine, options]);
      }

      async start () { calls.push(['start']); }
      async stop () { calls.push(['stop']); }
      async get (key) { return { item: key }; }
      async set (key, value, ttl) { calls.push(['set', key, value, ttl]); }
      async drop (key) { calls.push(['drop', key]); }
    }

    const Cache = Proxyquire('../../../../server/lib/cache', {
      '@hapi/catbox': { Client },
      '@hapi/catbox-redis': { Engine: 'engine' }
    });

    const server = Hapi.server();
    await server.register({ plugin: Cache, options: { host: 'redis', port: 6379, password: 'pw', partition: 'jsperf' } });

    const cache = server.plugins.cache;
    Code.expect(await cache.get('a')).to.equal({ item: 'a' });
    await cache.set('a', 1, 10);
    await cache.drop('a');
    await server.initialize();
    await server.stop();

    Code.expect(calls[0]).to.equal(['new', 'engine', { partition: 'jsperf', host: 'redis', port: 6379, password: 'pw' }]);
    Code.expect(calls.map((c) => c[0])).to.equal(['new', 'start', 'set', 'drop', 'stop']);
  });
});
