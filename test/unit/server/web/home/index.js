const Lab = require('@hapi/lab');
const Code = require('@hapi/code');
const Support = require('../../../../support/server');
const sinon = require('sinon');
const defaults = require('../../../../../server/lib/defaults');
const HomePlugin = require('../../../../../server/web/home/index');

const MockPagesService = Support.mock('services/pages', ['checkIfSlugAvailable', 'create']);

const lab = exports.lab = Lab.script();
let request, server;

lab.beforeEach(async () => {
  server = await Support.createServer({ yar: true, auth: true, plugins: [MockPagesService, HomePlugin] });
});

lab.experiment('home', function () {
  lab.experiment('GET', function () {
    lab.beforeEach(async function () {
      request = {
        method: 'GET',
        url: '/'
      };
    });

    lab.test('it responds with the home page', async function () {
      const response = await server.inject(request);
      Code.expect(response.statusCode).to.equal(200);
    });

    lab.test('it serves a generic title on pages that does not specify one', async function () {
      const response = await server.inject(request);
      Code.expect(response.payload).to.include('<title>jsPerf: JavaScript performance playground</title>');
    });

    lab.test('it presents a login option to a user if they have not logged in', async function () {
      const response = await server.inject(request);
      Code.expect(response.result).to.include('Log in to Create Test Cases');
    });

    lab.test('it presents a save option to a user if they have already logged in', async function () {
      request.auth = { strategy: 'session', credentials: { test: 'profile' } };

      const response = await server.inject(request);
      Code.expect(response.result).to.include('Save test case');
      Code.expect(response.payload).to.include('<script src="/public/_js/main.');
    });
  });

  lab.experiment('POST', function () {
    lab.beforeEach(async function () {
      request = {
        method: 'POST',
        url: '/',
        auth: { strategy: 'session', credentials: { username: 'koolaidman', test: 'profile' } },
        payload: {
          author: 'Pitcher Man',
          authorEmail: 'kool-aid@kraft.com',
          authorURL: 'http://kool-aid.com',
          title: 'oh',
          slug: 'oh-yea',
          info: '',
          initHTML: '',
          setup: '',
          teardown: '',
          test: [
            {
              title: 't1',
              code: 't=1'
            },
            {
              title: 't2',
              code: 't=2'
            }
          ]
        }
      };
    });

    lab.experiment('validation', function () {
      lab.test('title required', async function () {
        delete request.payload.title;

        const response = await server.inject(request);
        Code.expect(response.statusCode).to.equal(400);

        Code.expect(response.result).to.include('You must enter a title for this test case.');
      });

      lab.test('slug required', async function () {
        delete request.payload.slug;

        const response = await server.inject(request);
        Code.expect(response.statusCode).to.equal(400);

        Code.expect(response.result).to.include('The slug can only contain alphanumeric characters and hyphens.');
      });

      lab.test('test title required if code present', async function () {
        // code present in defaults above
        Code.expect(request.payload.test[0].code).to.not.be.empty();
        request.payload.test[0].title = '';

        const response = await server.inject(request);
        Code.expect(response.statusCode).to.equal(400);

        Code.expect(response.result).to.include(defaults.errors.codeTitle);
      });

      lab.test('test code required if title present', async function () {
        // title present in defaults above
        Code.expect(request.payload.test[0].title).to.not.be.empty();
        request.payload.test[0].code = '';

        const response = await server.inject(request);
        Code.expect(response.statusCode).to.equal(400);

        Code.expect(response.result).to.include(defaults.errors.code);
      });

      lab.test('test with blank title and blank code is dropped', async () => {
        sinon.stub(server.plugins['services/pages'], 'checkIfSlugAvailable').resolves(true);
        const create = sinon.stub(server.plugins['services/pages'], 'create').resolves(1);
        request.payload.test.push({ title: '', code: '' });

        const response = await server.inject(request);

        Code.expect(response.statusCode).to.equal(302);
        Code.expect(create.firstCall.args[0].test[2].title).to.equal(defaults.deleteMe);
      });

      lab.test('generic error', async function () {
        request.payload.test[0].defer = 'unexpected';

        const response = await server.inject(request);
        Code.expect(response.statusCode).to.equal(400);

        Code.expect(response.result).to.include('Please review required fields and save again.');
      });
    });

    lab.experiment('authorization', function () {
      lab.test('401 if attempting to POST without authorization', async function () {
        delete request.auth;

        const response = await server.inject(request);
        Code.expect(response.statusCode).to.equal(401);
      });
    });

    lab.experiment('slug check', function () {
      lab.test('handles error', async function () {
        const errMsg = 'testing-very-unique-msg';
        sinon.stub(server.plugins['services/pages'], 'checkIfSlugAvailable').returns(Promise.resolve(true));
        sinon.stub(server.plugins['services/pages'], 'create').throws(new Error(errMsg));

        const response = await server.inject(request);
        Code.expect(response.statusCode).to.equal(400);

        Code.expect(response.result).to.include(errMsg);
      });

      lab.test('not available', async function () {
        sinon.stub(server.plugins['services/pages'], 'checkIfSlugAvailable').returns(Promise.resolve(false));

        const response = await server.inject(request);
        Code.expect(response.statusCode).to.equal(400);

        Code.expect(response.result).to.include('This slug is already in use. Please choose another one.');
      });
    });

    lab.experiment('create page', function () {
      lab.beforeEach(async function () {
        sinon.stub(server.plugins['services/pages'], 'checkIfSlugAvailable').returns(Promise.resolve(true));
      });

      lab.test('handles error', async function () {
        const errMsg = 'testing-very-very-unique-msg';
        sinon.stub(server.plugins['services/pages'], 'create').throws(new Error(errMsg));

        const response = await server.inject(request);
        Code.expect(response.statusCode).to.equal(400);

        Code.expect(response.result).to.include(errMsg);
      });

      lab.test('redirects to slug', async function () {
        sinon.stub(server.plugins['services/pages'], 'create').returns(Promise.resolve(true));

        const response = await server.inject(request);
        Code.expect(response.statusCode).to.equal(302);
        Code.expect(response.headers.location).to.include(request.payload.slug);
      });

      lab.test('records the creator as the owner and author', async () => {
        const create = sinon.stub(server.plugins['services/pages'], 'create').returns(Promise.resolve(5));
        request.auth.credentials.id = 12;

        const response = await server.inject(request);
        Code.expect(response.statusCode).to.equal(302);
        Code.expect(create.args[0][0].userID).to.equal(12);
        Code.expect(create.args[0][0].author).to.equal('koolaidman');
      });
    });
  });
});
