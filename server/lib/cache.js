'use strict';

const Catbox = require('@hapi/catbox');
const CatboxRedis = require('@hapi/catbox-redis');

exports.plugin = {
  name: 'cache',
  register: async (server, options) => {
    if (options.host) {
      server.log('info', 'connecting to redis cache');
      const client = new Catbox.Client(CatboxRedis.Engine, {
        partition: options.partition,
        host: options.host,
        port: options.port,
        password: options.password
      });

      server.expose('get', (key) => client.get(key));
      server.expose('set', (key, value, ttl) => client.set(key, value, ttl));
      server.expose('drop', (key) => client.drop(key));

      server.ext('onPostStop', () => client.stop());

      await client.start();
    } else {
      server.log('info', 'no redis config provided. caching disabled');
      server.expose('get', async () => null);
      server.expose('set', async () => {});
      server.expose('drop', async () => {});
    }
  }
};
