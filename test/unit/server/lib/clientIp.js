const Lab = require('@hapi/lab');
const Code = require('@hapi/code');
const clientIp = require('../../../../server/lib/clientIp');

const lab = exports.lab = Lab.script();

const requestWith = (trustProxy, headers) => ({
  server: { settings: { app: { trustProxy } } },
  headers,
  info: { remoteAddress: '10.0.0.1' }
});

lab.experiment('clientIp', () => {
  lab.test('uses the connection address by default', () => {
    Code.expect(clientIp(requestWith(false, {}))).to.equal('10.0.0.1');
  });

  lab.test('ignores x-forwarded-for unless the proxy is trusted', () => {
    Code.expect(clientIp(requestWith(false, { 'x-forwarded-for': '6.6.6.6' }))).to.equal('10.0.0.1');
  });

  lab.test('uses the entry the trusted proxy appended', () => {
    Code.expect(clientIp(requestWith(true, { 'x-forwarded-for': '6.6.6.6, 203.0.113.9' }))).to.equal('203.0.113.9');
  });

  lab.test('falls back to the connection address without the header', () => {
    Code.expect(clientIp(requestWith(true, {}))).to.equal('10.0.0.1');
  });
});
