const Lab = require('@hapi/lab');
const Code = require('@hapi/code');
const Hapi = require('@hapi/hapi');
const Proxyquire = require('proxyquire');
const { Writable } = require('node:stream');

const lab = exports.lab = Lab.script();

lab.experiment('logging plugin', () => {
  lab.test('registers hapi-pino without loggly by default', async () => {
    const Logging = require('../../../../server/lib/logging');
    const server = Hapi.server();

    await server.register({ plugin: Logging, options: { level: 'silent', pretty: false } });

    Code.expect(server.logger).to.exist();
  });

  lab.test('uses the pino-pretty transport when pretty', async () => {
    const Logging = require('../../../../server/lib/logging');
    const server = Hapi.server();

    await server.register({ plugin: Logging, options: { level: 'silent', pretty: true } });

    Code.expect(server.logger).to.exist();
  });

  lab.test('ships logs to loggly in batches when a token is configured', async () => {
    const requests = [];
    const Https = {
      request: (options) => {
        const chunks = [];
        const req = new Writable({
          write (chunk, enc, cb) {
            chunks.push(chunk);
            cb();
          }
        });
        req.end = (body) => requests.push({ options, body });
        req.on = () => req;
        return req;
      }
    };

    const Logging = Proxyquire('../../../../server/lib/logging', { 'node:https': Https });
    const shipper = Logging.logglyStream({ token: 'tok', subdomain: 'jsperf', hostname: 'example.com' });

    for (let i = 0; i < 20; i++) {
      shipper.write(`{"n":${i}}\n`);
    }

    Code.expect(requests).to.have.length(1);
    Code.expect(requests[0].options.path).to.equal('/bulk/tok/tag/jsperf,example.com');
    Code.expect(requests[0].body.split('\n').filter(Boolean)).to.have.length(20);

    // below the threshold, nothing is sent until flushed
    shipper.write('{"n":21}\n');
    Code.expect(requests).to.have.length(1);
    shipper.flush();
    Code.expect(requests).to.have.length(2);

    // flushing an empty buffer is a no-op
    shipper.flush();
    Code.expect(requests).to.have.length(2);
  });

  lab.test('registers a loggly stream and flushes it on stop', async () => {
    const Logging = require('../../../../server/lib/logging');
    const server = Hapi.server();

    await server.register({
      plugin: Logging.plugin,
      options: { level: 'silent', loggly: { token: 'tok', subdomain: 'jsperf', hostname: 'example.com' } }
    });
    await server.initialize();
    await server.stop();
  });

  lab.test('falls back to default level and tags', async () => {
    const Logging = require('../../../../server/lib/logging');
    const server = Hapi.server();
    await server.register({ plugin: Logging, options: {} });
    Code.expect(server.logger).to.exist();

    const requests = [];
    const Stubbed = Proxyquire('../../../../server/lib/logging', {
      'node:https': {
        request: (options) => {
          const req = { on: () => req, end: (body) => requests.push({ options, body }) };
          return req;
        }
      }
    });
    const shipper = Stubbed.logglyStream({ token: 'tok' });
    shipper.write('{}\n');
    shipper.flush();
    Code.expect(requests[0].options.path).to.equal('/bulk/tok/tag/jsperf,jsperf');
  });
});
