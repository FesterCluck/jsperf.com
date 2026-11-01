const Lab = require('@hapi/lab');
const Code = require('@hapi/code');
const Proxyquire = require('proxyquire');

const settings = {
  '/env': 'development',
  '/port': 3000,
  '/auth/session/secure': false,
  '/auth/session/pass': 'password-should-be-32-characters',
  '/auth/session/name': 'sid-jsperf'
};

const load = (overrides = {}) => Proxyquire('../../manifest', {
  './config': {
    get: (key) => (key in overrides ? overrides[key] : settings[key]),
    '@noCallThru': true
  }
});

const lab = exports.lab = Lab.script();

lab.experiment('Manifest', () => {
  lab.test('it gets manifest data', () => {
    Code.expect(load().get('/')).to.be.an.object();
  });

  lab.test('it gets manifest meta data', () => {
    Code.expect(load().meta('/')).to.match(/jsPerf/i);
  });

  lab.test('it uses the new server and register shapes', () => {
    const manifest = load().get('/');

    Code.expect(manifest.connections).to.not.exist();
    Code.expect(manifest.server.port).to.equal(3000);
    Code.expect(manifest.register.plugins).to.be.an.array();
  });

  lab.test('it does not register bell or github auth', () => {
    const plugins = load().get('/register/plugins').map((p) => p.plugin);

    Code.expect(plugins).to.not.include(['bell', '@hapi/bell', './server/web/auth/github']);
    Code.expect(plugins).to.include(['@hapi/cookie', '@hapi/crumb', './server/web/auth/local']);
  });

  lab.test('it parses nested query strings with qs', () => {
    const { parser } = load().get('/server/query');

    Code.expect(parser('a[b]=1&c=2')).to.equal({ a: { b: '1' }, c: '2' });
  });

  lab.test('it skips crumb for assets and health checks', () => {
    const crumb = load().get('/register/plugins').find((p) => p.plugin === '@hapi/crumb');

    Code.expect(crumb.options.skip({ path: '/public/x.css' })).to.be.true();
    Code.expect(crumb.options.skip({ path: '/health' })).to.be.true();
    Code.expect(crumb.options.skip({ path: '/' })).to.be.false();
  });

  lab.test('it enables view debugging in development only', () => {
    const vision = (env) => load({ '/env': env }).get('/register/plugins').find((p) => p.plugin === '@hapi/vision');

    Code.expect(vision('development').options.context.debug).to.be.true();
    Code.expect(vision('development').options.isCached).to.be.false();
    Code.expect(vision('production').options.context.debug).to.not.exist();
    Code.expect(vision('production').options.isCached).to.be.true();
  });

  lab.test('it configures logging by environment', () => {
    const logging = (env) => load({ '/env': env }).get('/register/plugins').find((p) => p.plugin === './server/lib/logging').options;

    Code.expect(logging('production').level).to.equal('info');
    Code.expect(logging('production').pretty).to.be.false();
    Code.expect(logging('development').level).to.equal('debug');
    Code.expect(logging('development').pretty).to.be.true();
  });
});
