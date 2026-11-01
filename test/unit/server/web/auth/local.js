const Lab = require('@hapi/lab');
const Code = require('@hapi/code');
const sinon = require('sinon');
const Qs = require('qs');
const Support = require('../../../../support/server');
const password = require('../../../../../server/lib/password');
const LocalPlugin = require('../../../../../server/web/auth/local');
const QsPayloadPlugin = require('../../../../../server/lib/qsPayload');

const MockUsersRepo = Support.mock('repositories/users', ['create', 'getByUsername']);

const lab = exports.lab = Lab.script();
let server, usersRepo;

const form = { 'content-type': 'application/x-www-form-urlencoded' };
const post = (url, data, headers = {}) => server.inject({ method: 'POST', url, payload: Qs.stringify(data), headers: { ...form, ...headers } });

lab.beforeEach(async () => {
  server = await Support.createServer({ yar: true, auth: true, plugins: [MockUsersRepo, QsPayloadPlugin, LocalPlugin] });
  // auth strategy cookie settings that the app uses
  usersRepo = server.plugins['repositories/users'];
  sinon.stub(usersRepo, 'getByUsername').resolves(undefined);
  sinon.stub(usersRepo, 'create').resolves(7);
});

lab.experiment('auth/local', () => {
  lab.experiment('login', () => {
    lab.test('renders the login form', async () => {
      const res = await server.inject('/login');

      Code.expect(res.statusCode).to.equal(200);
      Code.expect(res.result).to.include(['<form action="/login"', 'type="password"']);
    });

    lab.test('redirects away if already logged in', async () => {
      const res = await server.inject({ url: '/login', auth: { strategy: 'session', credentials: { username: 'a' } } });

      Code.expect(res.statusCode).to.equal(302);
      Code.expect(res.headers.location).to.equal('/');
    });

    lab.test('logs in with valid credentials and sets a session cookie', async () => {
      usersRepo.getByUsername.resolves({ id: 3, username: 'Alice', passwordHash: await password.hash('correct horse') });

      const res = await post('/login', { username: 'alice', password: 'correct horse' });

      Code.expect(res.statusCode).to.equal(302);
      Code.expect(res.headers.location).to.equal('/');
      const cookie = res.headers['set-cookie'].find((c) => c.startsWith('sid-jsperf='));
      Code.expect(cookie).to.include('HttpOnly');
      Code.expect(cookie).to.include('SameSite=Lax');

      // credentials are used by the rest of the app
      const home = await server.inject({ url: '/login', headers: { cookie: cookie.split(';')[0] } });
      Code.expect(home.statusCode).to.equal(302);
    });

    lab.test('rejects a wrong password', async () => {
      usersRepo.getByUsername.resolves({ id: 3, username: 'alice', passwordHash: await password.hash('correct horse') });

      const res = await post('/login', { username: 'alice', password: 'wrong horse!!' });

      Code.expect(res.statusCode).to.equal(400);
      Code.expect(res.result).to.include('Invalid username or password.');
      Code.expect((res.headers['set-cookie'] || []).some((c) => c.startsWith('sid-jsperf='))).to.be.false();
    });

    lab.test('rejects an unknown user the same way', async () => {
      const res = await post('/login', { username: 'nobody', password: 'whatever12' });

      Code.expect(res.statusCode).to.equal(400);
      Code.expect(res.result).to.include('Invalid username or password.');
    });

    lab.test('rejects a second unknown user too', async () => {
      await post('/login', { username: 'nobody', password: 'whatever12' });
      const res = await post('/login', { username: 'nobody2', password: 'whatever12' });

      Code.expect(res.statusCode).to.equal(400);
    });

    lab.test('rejects an invalid payload', async () => {
      const res = await post('/login', { username: 'nobody' });

      Code.expect(res.statusCode).to.equal(400);
    });

    lab.test('rejects a missing payload', async () => {
      const res = await server.inject({ method: 'POST', url: '/login' });

      Code.expect(res.statusCode).to.equal(400);
    });
  });

  lab.experiment('register', () => {
    lab.test('renders the registration form', async () => {
      const res = await server.inject('/register');

      Code.expect(res.statusCode).to.equal(200);
      Code.expect(res.result).to.include('<form action="/register"');
    });

    lab.test('redirects away if already logged in', async () => {
      const res = await server.inject({ url: '/register', auth: { strategy: 'session', credentials: { username: 'a' } } });

      Code.expect(res.statusCode).to.equal(302);
    });

    lab.test('creates a user with a hashed password and logs them in', async () => {
      const res = await post('/register', { username: 'alice', password: 'correct horse' });

      Code.expect(res.statusCode).to.equal(302);
      Code.expect(res.headers.location).to.equal('/');
      Code.expect(res.headers['set-cookie'].some((c) => c.startsWith('sid-jsperf='))).to.be.true();

      const created = usersRepo.create.firstCall.args[0];
      Code.expect(created.username).to.equal('alice');
      Code.expect(created.passwordHash).to.startWith('scrypt$');
      Code.expect(created.passwordHash).to.not.include('correct horse');
      Code.expect(await password.verify('correct horse', created.passwordHash)).to.be.true();
    });

    lab.test('rejects a bad username', async () => {
      const res = await post('/register', { username: 'a b!', password: 'correct horse' });

      Code.expect(res.statusCode).to.equal(400);
      Code.expect(res.result).to.include('Usernames may only contain');
      Code.expect(usersRepo.create.called).to.be.false();
    });

    lab.test('rejects a short password', async () => {
      const res = await post('/register', { username: 'alice', password: 'short' });

      Code.expect(res.statusCode).to.equal(400);
      Code.expect(res.result).to.include('Passwords must be between');
    });

    lab.test('rejects unexpected fields with a general error', async () => {
      const res = await post('/register', { username: 'alice', password: 'correct horse', admin: 'y' });

      Code.expect(res.statusCode).to.equal(400);
      Code.expect(res.result).to.include('Please review the form');
    });

    lab.test('rejects a missing payload', async () => {
      const res = await server.inject({ method: 'POST', url: '/register' });

      Code.expect(res.statusCode).to.equal(400);
    });

    lab.test('rejects a taken username', async () => {
      usersRepo.getByUsername.resolves({ id: 1, username: 'alice' });

      const res = await post('/register', { username: 'alice', password: 'correct horse' });

      Code.expect(res.statusCode).to.equal(400);
      Code.expect(res.result).to.include('already taken');
    });

    lab.test('rejects a username taken in a race', async () => {
      usersRepo.create.rejects(Object.assign(new Error('dupe'), { code: 'ER_DUP_ENTRY' }));

      const res = await post('/register', { username: 'alice', password: 'correct horse' });

      Code.expect(res.statusCode).to.equal(400);
      Code.expect(res.result).to.include('already taken');
    });

    lab.test('responds with an error if the user cannot be created', async () => {
      usersRepo.create.rejects(new Error('db down'));

      const res = await post('/register', { username: 'alice', password: 'correct horse' });

      Code.expect(res.statusCode).to.equal(500);
    });
  });

  lab.experiment('logout', () => {
    lab.test('clears the session cookie', async () => {
      const res = await server.inject({ method: 'POST', url: '/logout', auth: { strategy: 'session', credentials: { username: 'a' } } });

      Code.expect(res.statusCode).to.equal(302);
      Code.expect(res.headers.location).to.equal('/');
    });
  });

  lab.experiment('onPreResponse', () => {
    lab.test('adds credentials to views when logged in', async () => {
      server.route({ method: 'GET', path: '/v', options: { auth: { mode: 'try', strategy: 'session' } }, handler: (request, h) => h.view('auth/login') });

      const res = await server.inject({ url: '/v', auth: { strategy: 'session', credentials: { username: 'alice' } } });

      Code.expect(res.result).to.include('Logged in as');
      Code.expect(res.result).to.include('@alice');
    });

    lab.test('shows log in links when anonymous and keeps an existing context', async () => {
      server.route({ method: 'GET', path: '/v', handler: (request, h) => h.view('auth/login', { genError: 'oops' }) });

      const res = await server.inject('/v');

      Code.expect(res.result).to.include('oops');
      Code.expect(res.result).to.include('href="/register"');
    });
  });
});
