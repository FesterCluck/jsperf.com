const Lab = require('@hapi/lab');
const sinon = require('sinon');
const Code = require('@hapi/code');
const Support = require('../../../../support/server');
const Hoek = require('@hapi/hoek');

const defaults = require('../../../../../server/lib/defaults');
const testNow = new Date();
const defaultPageData = {
  id: 1,
  slug: 'wee',
  revision: 1,
  maxRev: 22,
  title: 'Oh Yea',
  info: 'Sample test',
  setup: 'samplesetup',
  teardown: 'deletesetup',
  initHTML: 'initstring',
  visible: 'y',
  author: 'Andrew',
  authorEmail: 'a@s.co',
  authorURL: 'as.co',
  hits: 0,
  published: testNow,
  updated: testNow
};

const TestPlugin = require('../../../../../server/web/edit/index');

const MockPagesService = Support.mock('services/pages', ['getBySlug', 'edit']);

const lab = exports.lab = Lab.script();
let request, server, pagesServiceStub;

lab.beforeEach(async () => {
  server = await Support.createServer({ yar: true, auth: true, plugins: [MockPagesService, TestPlugin] });

  pagesServiceStub = {
    getBySlug: sinon.stub(server.plugins['services/pages'], 'getBySlug'),
    edit: sinon.stub(server.plugins['services/pages'], 'edit')
  };
});

lab.experiment('GET', function () {
  const slug = 'wee';

  lab.beforeEach(async function () {
    request = {
      method: 'GET',
      auth: { strategy: 'session', credentials: { test: 'profile' } },
      url: `/${slug}/1/edit`
    };
  });

  lab.test('fail to get by slug', async function () {
    pagesServiceStub.getBySlug.returns(Promise.reject(new Error('real helpful')));

    const response = await server.inject(request);
    Code.expect(response.statusCode).to.equal(500);
  });

  lab.test('responds with test page for slug', async function () {
    pagesServiceStub.getBySlug.returns(
      Promise.resolve([defaultPageData, [], [], []])
    );

    const response = await server.inject(request);
    Code.expect(response.statusCode).to.equal(200);
    Code.expect(response.payload).to.include('<title>Oh Yea · jsPerf</title>');
    Code.expect(response.payload).to.include('<script src="/public/_js/main.');
  });

  lab.test('it presents a login option to a user if they have not logged in', async function () {
    pagesServiceStub.getBySlug.returns(
      Promise.resolve([defaultPageData, [], [], []])
    );

    delete request.auth;

    const response = await server.inject(request);
    Code.expect(response.result).to.include('Log in to Edit Test Cases');
  });

  lab.test('it presents a save option to a user if they have already logged in', async function () {
    pagesServiceStub.getBySlug.returns(
      Promise.resolve([defaultPageData, [], [], []])
    );

    const response = await server.inject(request);
    Code.expect(response.result).to.include('Save test case');
  });

  lab.test('visible page warning if page is visible', async function () {
    pagesServiceStub.getBySlug.returns(
      Promise.resolve([defaultPageData, [], [], []])
    );

    const response = await server.inject(request);
    Code.expect(response.payload).to.contain('uncheck if you want to fiddle around before making the page public');
  });

  // Hapi does not support nested optional paramaters, this is the workaround
  lab.test('redirect slug/edit to slug/1/edit', async function () {
    request.url = `/${slug}/edit`;
    pagesServiceStub.getBySlug.returns(
      Promise.resolve([defaultPageData, [], [], []])
    );

    const response = await server.inject(request);
    Code.expect(response.statusCode).to.equal(302);
    Code.expect(response.headers.location).to.equal(`/${slug}/1/edit`);
  });

  lab.test('not found', async function () {
    pagesServiceStub.getBySlug.returns(Promise.reject(new Error('Not found')));

    // adding revision to url here covers true case of rev ternary
    request.url = '/wee/999/edit';

    const response = await server.inject(request);
    Code.expect(response.statusCode).to.equal(404);
  });

  lab.test('displays all pertinent page info', async function () {
    pagesServiceStub.getBySlug.returns(
      Promise.resolve([defaultPageData, [], [], []])
    );

    const response = await server.inject(request);
    Code.expect(response.payload.indexOf(defaultPageData.info)).to.be.at.least(0);
    Code.expect(response.payload.indexOf(defaultPageData.setup)).to.be.at.least(0);
    Code.expect(response.payload.indexOf(defaultPageData.teardown)).to.be.at.least(0);
    Code.expect(response.payload.indexOf(defaultPageData.initHTML)).to.be.at.least(0);
  });

  lab.test('give the user a visible page prompt if page is not visible', async function () {
    const nonVisiblePage = Hoek.applyToDefaults(defaultPageData, { visible: 'n' });
    pagesServiceStub.getBySlug.returns(
      Promise.resolve([nonVisiblePage, [], [], []])
    );

    const response = await server.inject(request);
    Code.expect(response.payload.indexOf('check when your test case is finished')).to.be.at.least(0);
  });

  lab.test('responds with "editing original" message for the original author', async function () {
    server.route({
      method: 'GET',
      path: '/setsession',
      handler: (req) => {
        const owns = { 1: true };
        req.yar.set('own', owns);
        return 'session set';
      }
    });
    const res = await server.inject('/setsession');
    const header = res.headers['set-cookie'];
    const cookie = header[0].match(/(?:[^\x00-\x20\(\)<>@\,;\:\\'\/\[\]\?\=\{\}\x7F]+)\s*=\s*(?:([^\x00-\x20\'\,\;\\\x7F]*))/); // eslint-disable-line no-control-regex, no-useless-escape
    request.headers = {};
    request.headers.cookie = 'session=' + cookie[1];
    pagesServiceStub.getBySlug.returns(
      Promise.resolve([defaultPageData, [], [], []])
    );
    const response = await server.inject(request);
    Code.expect(response.payload.indexOf('Since it’s your test case, this edit will overwrite the current revision without creating a new URL')).to.be.at.least(0);
  });

  lab.test('displays an "creating new revision" message for not the author', async function () {
    server.route({
      method: 'GET',
      path: '/setsession',
      handler: (req) => {
        const owns = { 1: false };
        req.yar.set('own', owns);
        return 'session set';
      }
    });
    const res = await server.inject('/setsession');
    const header = res.headers['set-cookie'];
    const cookie = header[0].match(/(?:[^\x00-\x20\(\)<>@\,;\:\\'\/\[\]\?\=\{\}\x7F]+)\s*=\s*(?:([^\x00-\x20\'\,\;\\\x7F]*))/); // eslint-disable-line no-control-regex, no-useless-escape
    request.headers = {};
    request.headers.cookie = 'session=' + cookie[1];
    pagesServiceStub.getBySlug.returns(
      Promise.resolve([defaultPageData, [], [], []])
    );
    const response = await server.inject(request);
    Code.expect(response.payload.indexOf('This edit will create a new revision.')).to.be.at.least(0);
  });

  lab.test("it displays the author's details name if being viewed by an admin", async function () {
    server.route({
      method: 'GET',
      path: '/setsession',
      handler: (req) => {
        req.yar.set('admin', true);
        return 'session set';
      }
    });
    const res = await server.inject('/setsession');
    const header = res.headers['set-cookie'];
    const cookie = header[0].match(/(?:[^\x00-\x20\(\)<>@\,;\:\\'\/\[\]\?\=\{\}\x7F]+)\s*=\s*(?:([^\x00-\x20\'\,\;\\\x7F]*))/); // eslint-disable-line no-control-regex, no-useless-escape
    request.headers = {};
    request.headers.cookie = 'session=' + cookie[1];
    pagesServiceStub.getBySlug.returns(
      Promise.resolve([defaultPageData, [], [], []])
    );
    const response = await server.inject(request);
    Code.expect(response.payload.indexOf('Andrew')).to.be.at.least(0);
    Code.expect(response.payload.indexOf('a@s.co')).to.be.at.least(0);
    Code.expect(response.payload.indexOf('as.co')).to.be.at.least(0);
  });

  lab.test("it displays the author's details if being viewed by the author", async function () {
    server.route({
      method: 'GET',
      path: '/setsession',
      handler: (req) => {
        const owns = { 1: true };
        req.yar.set('own', owns);
        return 'session set';
      }
    });
    const res = await server.inject('/setsession');
    const header = res.headers['set-cookie'];
    const cookie = header[0].match(/(?:[^\x00-\x20\(\)<>@\,;\:\\'\/\[\]\?\=\{\}\x7F]+)\s*=\s*(?:([^\x00-\x20\'\,\;\\\x7F]*))/); // eslint-disable-line no-control-regex, no-useless-escape
    request.headers = {};
    request.headers.cookie = 'session=' + cookie[1];
    pagesServiceStub.getBySlug.returns(
      Promise.resolve([defaultPageData, [], [], []])
    );
    const response = await server.inject(request);
    Code.expect(response.payload.indexOf('Andrew')).to.be.at.least(0);
    Code.expect(response.payload.indexOf('a@s.co')).to.be.at.least(0);
    Code.expect(response.payload.indexOf('as.co')).to.be.at.least(0);
  });

  lab.test("it does not display the author's details if not being viewed by the author or an admin", async function () {
    server.route({
      method: 'GET',
      path: '/setsession',
      handler: (req) => {
        const owns = { 1: false };
        req.yar.set('own', owns);
        return 'session set';
      }
    });
    const res = await server.inject('/setsession');
    const header = res.headers['set-cookie'];
    const cookie = header[0].match(/(?:[^\x00-\x20\(\)<>@\,;\:\\'\/\[\]\?\=\{\}\x7F]+)\s*=\s*(?:([^\x00-\x20\'\,\;\\\x7F]*))/); // eslint-disable-line no-control-regex, no-useless-escape
    request.headers = {};
    request.headers.cookie = 'session=' + cookie[1];
    pagesServiceStub.getBySlug.returns(
      Promise.resolve([defaultPageData, [], [], []])
    );
    const response = await server.inject(request);
    Code.expect(response.payload.indexOf('Andrew')).to.equal(-1);
    Code.expect(response.payload.indexOf('a@s.co')).to.be.at.least(-1);
    Code.expect(response.payload.indexOf('as.co')).to.be.at.least(-1);
  });
});

lab.experiment('POST', function () {
  lab.beforeEach(async function () {
    request = {
      method: 'POST',
      url: '/wee/1/edit',
      auth: { strategy: 'session', credentials: { username: 'koolaidman', test: 'profile' } },
      payload: {
        author: 'Pitcher Man',
        authorEmail: 'kool-aid@kraft.com',
        authorURL: 'http://kool-aid.com',
        title: 'oh',
        slug: 'wee',
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
      Code.expect(response.result).to.include(defaults.errors.title);
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

    lab.test('generic error', async function () {
      request.payload.test[0].defer = 'unexpected';

      const response = await server.inject(request);
      Code.expect(response.statusCode).to.equal(400);

      Code.expect(response.result).to.include(defaults.errors.general);
    });
  });

  lab.experiment('authorization', function () {
    lab.test('401 if attempting to POST without authorization', async function () {
      delete request.auth;

      const response = await server.inject(request);
      Code.expect(response.statusCode).to.equal(401);
    });
  });

  lab.experiment('new revision', function () {
    lab.beforeEach(async function () {
      pagesServiceStub.getBySlug.returns(
        Promise.resolve([
          Hoek.applyToDefaults(request.payload, { maxRev: 44 })
        ])
      );
    });

    lab.test('handles error', async function () {
      const errMsg = 'testing-very-very-unique-msg';
      pagesServiceStub.edit.throws(new Error(errMsg));

      const response = await server.inject(request);
      Code.expect(response.statusCode).to.equal(400);
      Code.expect(response.payload).to.include('<title>oh · jsPerf</title>');
      Code.expect(response.result).to.include(errMsg);
    });

    lab.test('calls edit page service with new revision params', async function () {
      pagesServiceStub.edit.returns(Promise.resolve(request.payload));

      await server.inject(request);
      Code.expect(pagesServiceStub.edit.called).to.be.true();

      const firstCallArgs = pagesServiceStub.edit.args[0];

      Code.expect(firstCallArgs[0].slug).to.equal(request.payload.slug);
      Code.expect(firstCallArgs[1]).to.equal(false);
      Code.expect(firstCallArgs[2]).to.equal(44);
    });

    lab.test('redirects to new url after revision insertion', async function () {
      const rev = 45;
      pagesServiceStub.edit.onCall(0).returns(Promise.resolve(rev));

      const response = await server.inject(request);
      Code.expect(response.statusCode).to.equal(302);
      Code.expect(response.headers.location).to.equal(`/${request.payload.slug}/${rev}`);
    });
  });

  lab.experiment('owner revision', function () {
    lab.beforeEach(async function () {
      pagesServiceStub.getBySlug.returns(Promise.resolve([defaultPageData]));

      server.route({
        method: 'GET',
        path: '/setsession',
        handler: (req) => {
          const owns = { 1: true };
          req.yar.set('own', owns);
          return 'session set';
        }
      });
    });

    lab.test('calls edit page service with update params', async function () {
      pagesServiceStub.edit.onCall(0).returns(Promise.resolve(request.payload));

      const res = await server.inject('/setsession');
      const header = res.headers['set-cookie'];
      const cookie = header[0].match(/(?:[^\x00-\x20\(\)<>@\,;\:\\'\/\[\]\?\=\{\}\x7F]+)\s*=\s*(?:([^\x00-\x20\'\,\;\\\x7F]*))/); // eslint-disable-line no-control-regex, no-useless-escape
      request.headers = {};
      request.headers.cookie = 'session=' + cookie[1];
      await server.inject(request);
      const firstCallArgs = pagesServiceStub.edit.args[0];

      Code.expect(firstCallArgs[0].slug).to.equal(request.payload.slug);
      Code.expect(firstCallArgs[1]).to.equal(true);
      Code.expect(firstCallArgs[2]).to.equal(22);
    });

    lab.test('calls edit page service with update params to delete test', async function () {
      pagesServiceStub.edit.onCall(0).returns(Promise.resolve(request.payload));

      const res = await server.inject('/setsession');
      const header = res.headers['set-cookie'];
      const cookie = header[0].match(/(?:[^\x00-\x20\(\)<>@\,;\:\\'\/\[\]\?\=\{\}\x7F]+)\s*=\s*(?:([^\x00-\x20\'\,\;\\\x7F]*))/); // eslint-disable-line no-control-regex, no-useless-escape

      request.headers = {};
      request.headers.cookie = 'session=' + cookie[1];

      // add extra blank test to simulate deleting a code snippet
      request.payload.test.push({
        title: '',
        code: ''
      });

      await server.inject(request);
      const firstCallArgs = pagesServiceStub.edit.args[0];

      Code.expect(firstCallArgs[0].slug).to.equal(request.payload.slug);
      Code.expect(firstCallArgs[1]).to.equal(true);
      Code.expect(firstCallArgs[2]).to.equal(22);
    });

    lab.test('redirects to original url after update', async function () {
      const rev = 1;
      pagesServiceStub.edit.onCall(0).returns(Promise.resolve(rev));

      const res = await server.inject('/setsession');
      const header = res.headers['set-cookie'];
      const cookie = header[0].match(/(?:[^\x00-\x20\(\)<>@\,;\:\\'\/\[\]\?\=\{\}\x7F]+)\s*=\s*(?:([^\x00-\x20\'\,\;\\\x7F]*))/); // eslint-disable-line no-control-regex, no-useless-escape
      request.headers = {};
      request.headers.cookie = 'session=' + cookie[1];
      const response = await server.inject(request);
      Code.expect(response.statusCode).to.equal(302);
      Code.expect(response.headers.location).to.equal(`/${defaultPageData.slug}`);
    });
  });

  lab.experiment('admin revision', function () {
    lab.beforeEach(async function () {
      pagesServiceStub.getBySlug.returns(Promise.resolve([defaultPageData]));

      server.route({
        method: 'GET',
        path: '/setsession',
        handler: (req) => {
          req.yar.set('admin', true);
          return 'session set';
        }
      });
    });

    lab.test('calls edit page service with update params', async function () {
      pagesServiceStub.edit.onCall(0).returns(Promise.resolve(request.payload));

      const res = await server.inject('/setsession');
      const header = res.headers['set-cookie'];
      const cookie = header[0].match(/(?:[^\x00-\x20\(\)<>@\,;\:\\'\/\[\]\?\=\{\}\x7F]+)\s*=\s*(?:([^\x00-\x20\'\,\;\\\x7F]*))/); // eslint-disable-line no-control-regex, no-useless-escape
      request.headers = {};
      request.headers.cookie = 'session=' + cookie[1];
      await server.inject(request);
      const firstCallArgs = pagesServiceStub.edit.args[0];

      Code.expect(firstCallArgs[0].slug).to.equal(request.payload.slug);
      Code.expect(firstCallArgs[1]).to.equal(true);
      Code.expect(firstCallArgs[2]).to.equal(22);
    });
  });
});
