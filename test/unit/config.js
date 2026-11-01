const Lab = require('@hapi/lab');
const Code = require('@hapi/code');
const Proxyquire = require('proxyquire').noPreserveCache();

const required = [
  'COOKIE_PASS',
  'MYSQL_USER',
  'MYSQL_PASSWORD',
  'MYSQL_DATABASE'
];

const load = () => Proxyquire('../../config', {
  dotenv: {
    config: () => {
      // set environment variables that should be in .env file
      for (const k of required) {
        process.env[k] = process.env[k] || k;
      }
    }
  }
});

const lab = exports.lab = Lab.script();
let saved;

lab.beforeEach(() => {
  saved = { ...process.env };
});

lab.afterEach(() => {
  for (const k of Object.keys(process.env)) {
    if (!(k in saved)) delete process.env[k];
  }
  Object.assign(process.env, saved);
});

lab.experiment('Config', () => {
  lab.test('it gets config data', () => {
    Code.expect(load().get('/')).to.be.an.object();
  });

  lab.test('it gets config meta data', () => {
    Code.expect(load().meta('/')).to.match(/jsPerf/i);
  });

  lab.experiment('defaults', () => {
    lab.test('it gets scheme', () => {
      Code.expect(load().get('/scheme')).to.equal('http');
    });

    lab.test('it gets port', () => {
      Code.expect(load().get('/port')).to.equal(3000);
    });

    lab.test('it gets domain', () => {
      Code.expect(load().get('/domain')).to.equal('localhost');
    });

    lab.test('it gets mysql host', () => {
      Code.expect(load().get('/mysql/host')).to.equal('localhost');
    });

    lab.test('it gets mysql port', () => {
      Code.expect(load().get('/mysql/port')).to.equal(3306);
    });
  });

  lab.experiment('Cookies', () => {
    lab.test('it secures the session cookie if the scheme is https', () => {
      Code.expect(load().get('/auth/session/secure', { scheme: 'https' })).to.equal(true);
    });

    lab.test('it does not secure the session cookie if the scheme is http', () => {
      Code.expect(load().get('/auth/session/secure', { scheme: 'http' })).to.equal(false);
    });
  });

  lab.experiment('removed settings', () => {
    lab.test('it no longer has GitHub OAuth config', () => {
      Code.expect(load().get('/auth/oauth')).to.not.exist();
    });

    lab.test('it does not require GitHub or Bell env vars', () => {
      delete process.env.GITHUB_CLIENT_ID;
      delete process.env.BELL_COOKIE_PASS;

      Code.expect(() => load()).to.not.throw();
    });
  });

  lab.experiment('loggly', () => {
    lab.test('token and subdomain are optional in production', () => {
      process.env.NODE_ENV = 'production';
      process.env.REDIS_HOST = 'localhost';
      process.env.REDIS_PORT = '6379';
      process.env.REDIS_PASSWORD = 'secret';
      delete process.env.LOGGLY_TOKEN;
      delete process.env.LOGGLY_SUBDOMAIN;

      const config = load();
      Code.expect(config.get('/loggly/token')).to.not.exist();
    });
  });

  lab.test('validates process.env', () => {
    for (const k of required) {
      process.env[k] = k;
    }
    delete process.env.MYSQL_USER;

    Code.expect(() => Proxyquire('../../config', { dotenv: { config: () => {} } })).to.throw('MYSQL_USER environment variable is missing');
  });
});
