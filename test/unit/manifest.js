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

  lab.experiment('with a base path', () => {
    const find = (m, name) => m.get('/register/plugins').find((p) => p.plugin === name);
    const prefixed = () => load({ '/basePath': '/next', '/host': '127.0.0.1', '/auth/session/name': 'sid-next' });

    lab.test('it adds no prefix, host or cookie path changes by default', () => {
      const m = load();
      Code.expect(m.get('/server/host')).to.not.exist();
      Code.expect(m.get('/server/router')).to.not.exist();
      Code.expect(m.get('/server/app')).to.equal({ basePath: '' });
      Code.expect(m.get('/register/plugins').filter((p) => p.routes)).to.be.empty();
      Code.expect(find(m, '@hapi/yar').options.cookieOptions.path).to.equal('/');
      Code.expect(find(m, '@hapi/yar').options.name).to.equal('session');
    });

    lab.test('it prefixes route plugins only', () => {
      const m = prefixed();
      Code.expect(find(m, './server/web/home').routes).to.equal({ prefix: '/next' });
      Code.expect(find(m, './server/web/public').routes).to.equal({ prefix: '/next' });
      Code.expect(find(m, './server/api/json').routes).to.equal({ prefix: '/next' });
      Code.expect(find(m, '@hapi/inert').routes).to.not.exist();
      Code.expect(find(m, './server/lib/db').routes).to.not.exist();
    });

    lab.test('it binds to HOST and scopes cookies', () => {
      const m = prefixed();
      Code.expect(m.get('/server/host')).to.equal('127.0.0.1');
      Code.expect(m.get('/server/app')).to.equal({ basePath: '/next' });
      Code.expect(m.get('/server/router')).to.equal({ stripTrailingSlash: true });
      Code.expect(find(m, '@hapi/yar').options.cookieOptions.path).to.equal('/next');
      Code.expect(find(m, '@hapi/yar').options.name).to.equal('sid-next-yar');
      Code.expect(find(m, '@hapi/crumb').options.cookieOptions.path).to.equal('/next');
      const strategies = find(m, './server/web/auth/strategies').options.session;
      Code.expect(strategies.path).to.equal('/next');
      Code.expect(strategies.cookie).to.equal('sid-next');
    });

    lab.test('it skips crumb for prefixed assets and health checks', () => {
      const { skip } = find(prefixed(), '@hapi/crumb').options;
      Code.expect(skip({ path: '/next/public/x.css' })).to.be.true();
      Code.expect(skip({ path: '/next/health' })).to.be.true();
      Code.expect(skip({ path: '/public/x.css' })).to.be.false();
      Code.expect(skip({ path: '/next/' })).to.be.false();
    });

    lab.test('it exposes the base path to views', () => {
      const ctx = find(prefixed(), '@hapi/vision').options.context;
      Code.expect(ctx.base).to.equal('/next');
    });
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
