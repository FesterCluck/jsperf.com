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

  lab.test('responds with "editing original" message and the details for the owner', async function () {
    request.auth.credentials = { id: 7, username: 'owner' };
    pagesServiceStub.getBySlug.returns(
      Promise.resolve([Object.assign({}, defaultPageData, { userID: 7 }), [], [], []])
    );
    const response = await server.inject(request);
    Code.expect(response.payload).to.include('Since it’s your test case, this edit will overwrite the current revision without creating a new URL');
    Code.expect(response.payload).to.include('a@s.co');
    Code.expect(response.payload).to.include('as.co');
  });

  lab.test('displays a "creating new revision" message and hides the details for someone else', async function () {
    request.auth.credentials = { id: 8, username: 'someone-else' };
    pagesServiceStub.getBySlug.returns(
      Promise.resolve([Object.assign({}, defaultPageData, { userID: 7 }), [], [], []])
    );
    const response = await server.inject(request);
    Code.expect(response.payload).to.include('This edit will create a new revision.');
    Code.expect(response.payload).to.not.include('a@s.co');
  });

  lab.test('nobody owns a page without a userID', async function () {
    request.auth.credentials = { id: 8, username: 'someone-else' };
    pagesServiceStub.getBySlug.returns(
      Promise.resolve([defaultPageData, [], [], []])
    );
    const response = await server.inject(request);
    Code.expect(response.payload).to.include('This edit will create a new revision.');
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

    lab.test('forks are unpublished, credited to and owned by the editor', async function () {
      request.auth.credentials = { id: 9, username: 'koolaidman' };
      request.payload.visible = 'y';
      pagesServiceStub.edit.returns(Promise.resolve(45));

      await server.inject(request);

      const page = pagesServiceStub.edit.args[0][0];
      Code.expect(page.visible).to.equal('n');
      Code.expect(page.userID).to.equal(9);
      Code.expect(page.author).to.equal('koolaidman');
      Code.expect(page.authorGitHub).to.equal('koolaidman');
    });

    lab.test('the slug in the URL wins over the one in the form', async function () {
      request.payload.slug = 'somebody-elses-test';
      pagesServiceStub.edit.returns(Promise.resolve(45));

      const response = await server.inject(request);

      Code.expect(pagesServiceStub.edit.args[0][0].slug).to.equal('wee');
      Code.expect(response.headers.location).to.equal('/wee/45');
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
      request.auth.credentials = { id: 7, username: 'owner' };
      pagesServiceStub.getBySlug.returns(Promise.resolve([Object.assign({}, defaultPageData, { userID: 7 })]));
    });

    lab.test('calls edit page service with update params', async function () {
      pagesServiceStub.edit.onCall(0).returns(Promise.resolve(request.payload));

      await server.inject(request);
      const firstCallArgs = pagesServiceStub.edit.args[0];

      Code.expect(firstCallArgs[0].slug).to.equal(request.payload.slug);
      Code.expect(firstCallArgs[1]).to.equal(true);
      Code.expect(firstCallArgs[2]).to.equal(22);
    });

    lab.test('lets the owner publish and keeps the owner', async function () {
      request.payload.visible = 'y';
      pagesServiceStub.edit.onCall(0).returns(Promise.resolve(1));

      await server.inject(request);

      const page = pagesServiceStub.edit.args[0][0];
      Code.expect(page.visible).to.equal('y');
      Code.expect(page.userID).to.not.exist();
    });

    lab.test('calls edit page service with update params to delete test', async function () {
      pagesServiceStub.edit.onCall(0).returns(Promise.resolve(request.payload));

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
      pagesServiceStub.edit.onCall(0).returns(Promise.resolve(1));

      const response = await server.inject(request);
      Code.expect(response.statusCode).to.equal(302);
      Code.expect(response.headers.location).to.equal(`/${defaultPageData.slug}`);
    });
  });
});
