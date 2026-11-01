const Lab = require('@hapi/lab');
const sinon = require('sinon');
const Code = require('@hapi/code');
const Support = require('../../../../support/server');
const cheerio = require('cheerio/slim');

const defaults = require('../../../../../server/lib/defaults');

const TestPlugin = require('../../../../../server/web/test/index');

const MockCommentService = Support.mock('services/comments', ['create']);

const MockPagesService = Support.mock('services/pages', ['updateHits', 'getBySlug', 'publish', 'getVisibleBySlugWithRevisions']);

const lab = exports.lab = Lab.script();
let request, server, pagesServiceStub, commentsServiceStub;
const now = new Date();

lab.beforeEach(async () => {
  server = await Support.createServer({ yar: true, auth: true, scooter: true, plugins: [MockPagesService, MockCommentService, TestPlugin] });

  pagesServiceStub = {
    getBySlug: sinon.stub(server.plugins['services/pages'], 'getBySlug'),
    updateHits: sinon.stub(server.plugins['services/pages'], 'updateHits').returns(Promise.resolve()),
    getVisibleBySlugWithRevisions: sinon.stub(server.plugins['services/pages'], 'getVisibleBySlugWithRevisions')
  };

  commentsServiceStub = {
    create: sinon.stub(server.plugins['services/comments'], 'create')
  };
});

const slug = 'oh-yea';

lab.experiment('web/test plugin', function () {
  lab.beforeEach(async function () {
    request = {
      method: 'GET',
      url: '/' + slug
    };
  });

  lab.test('not found', async function () {
    pagesServiceStub.getBySlug.rejects(new Error('Not found'));

    // adding revision to url here covers true case of rev ternary
    request.url += '/999';

    const response = await server.inject(request);
    Code.expect(response.statusCode).to.equal(404);
  });

  lab.test('fail to get by slug', async function () {
    pagesServiceStub.getBySlug.rejects(new Error('real helpful'));

    const response = await server.inject(request);
    Code.expect(response.statusCode).to.equal(500);
  });

  lab.test('it responds with test page for slug', async function () {
    const now = new Date();
    const page = {
      id: 1,
      slug,
      revision: 1,
      title: 'Oh Yea',
      info: 'Sample test',
      setup: '',
      teardown: '',
      initHTML: '',
      visible: 'y',
      author: 'Max',
      authorEmail: 'm@b.co',
      authorURL: 'b.co',
      hits: 0,
      published: now,
      updated: now,
      maxRev: 2
    };
    const revisions = [{
      published: now,
      updated: now,
      author: 'Max',
      authorEmail: 'm@b.co',
      authorURL: 'b.co',
      revision: 1,
      visible: 'y',
      title: 'Oh Yea'
    }, {
      published: now,
      updated: now,
      author: 'Max',
      authorEmail: 'm@b.co',
      authorURL: 'b.co',
      revision: 2,
      visible: 'y',
      title: 'Oh Yea'
    }];

    pagesServiceStub.getBySlug.returns(Promise.resolve([page, [], revisions, []]));

    const response = await server.inject(request);
    Code.expect(response.statusCode).to.equal(200);
    const $ = cheerio.load(response.payload);
    Code.expect($('title').text()).to.equal('Oh Yea · jsPerf');

    // make sure revision list is correct
    const revLis = $('li', '#revisions');
    const firstRevLi = revLis.first();
    Code.expect(firstRevLi.hasClass('current')).to.be.true();
    Code.expect(firstRevLi.children('a').first().attr('href')).to.equal(request.url);

    const secondRevLi = revLis.eq(1);
    Code.expect(secondRevLi.hasClass('current')).to.be.false();
    Code.expect(secondRevLi.children('a').first().attr('href')).to.equal(request.url + '/' + revisions[1].revision);
  });

  lab.test('it responds with highlighted test page for slug', async function () {
    pagesServiceStub.getBySlug.returns(Promise.resolve([{
      id: 1,
      slug,
      revision: 1,
      title: 'Oh Yea',
      info: 'Sample test',
      setup: 'var a = 1',
      teardown: 'delete a',
      initHTML: "<div class='test'><script>var b = 2;</script></div>",
      visible: 'n',
      author: 'Max',
      authorEmail: 'm@b.co',
      authorURL: 'b.co',
      hits: 0,
      published: now,
      updated: now
    }, [], [], []]));

    const response = await server.inject(request);
    Code.expect(response.statusCode).to.equal(200);
    Code.expect(response.result).to.include('<pre><code class="js">  <span class="hljs-keyword">delete</span> a</code></pre>');
  });

  lab.experiment('Page Hits', function () {
    lab.beforeEach(async function () {
      // Add a method of adding session data
      server.route({
        method: 'GET',
        path: '/setsession',
        handler: (req) => {
          const hits = { 123: true };
          req.yar.set('hits', hits);
          return 'session set';
        }
      });
    });

    lab.test('updates unique page hits', async function () {
      pagesServiceStub.getBySlug.returns(Promise.resolve([{
        id: 1,
        slug,
        revision: 1,
        title: 'Oh Yea',
        info: 'Sample test',
        setup: 'var a = 1',
        teardown: 'delete a',
        initHTML: "<div class='test'><script>var b = 2;</script></div>",
        visible: 'n',
        author: 'Max',
        authorEmail: 'm@b.co',
        authorURL: 'b.co',
        hits: 0,
        published: now,
        updated: now
      }, [], [], []]));

      const res = await server.inject('/setsession');
      const header = res.headers['set-cookie'];
      const cookie = header[0].match(/(?:[^\x00-\x20\(\)<>@\,;\:\\'\/\[\]\?\=\{\}\x7F]+)\s*=\s*(?:([^\x00-\x20\'\,\;\\\x7F]*))/); // eslint-disable-line no-control-regex, no-useless-escape
      request.headers = {};
      request.headers.cookie = 'session=' + cookie[1];
      const response = await server.inject(request);
      const hits = response.request.yar.get('hits');
      Code.expect(hits[1]).to.equal(true);
    });

    lab.test('ignores duplicate page hits', async function () {
      pagesServiceStub.getBySlug.returns(Promise.resolve([{
        id: 123,
        slug,
        revision: 1,
        title: 'Oh Yea',
        info: 'Sample test',
        setup: '',
        teardown: '',
        initHTML: '',
        visible: 'y',
        author: 'Max',
        authorEmail: 'm@b.co',
        authorURL: 'b.co',
        hits: 0,
        published: now,
        updated: now
      }, [], [], []]));

      const res = await server.inject('/setsession');
      const header = res.headers['set-cookie'];
      const cookie = header[0].match(/(?:[^\x00-\x20\(\)<>@\,;\:\\'\/\[\]\?\=\{\}\x7F]+)\s*=\s*(?:([^\x00-\x20\'\,\;\\\x7F]*))/); // eslint-disable-line no-control-regex, no-useless-escape
      request.headers = {};
      request.headers.cookie = 'session=' + cookie[1];
      const response = await server.inject(request);
      const hits = response.request.yar.get('hits');
      Code.expect(hits[123]).to.equal(true);
    });

    lab.test('catches errors from page service', async function () {
      pagesServiceStub.getBySlug.returns(Promise.resolve([{
        id: 999,
        slug,
        revision: 1,
        title: 'Oh Yea',
        info: 'Sample test',
        setup: '',
        teardown: '',
        initHTML: '',
        visible: 'y',
        author: 'Max',
        authorEmail: 'm@b.co',
        authorURL: 'b.co',
        hits: 0,
        published: now,
        updated: now
      }, [], [], []]));

      const expectedError = new Error('catches-errors-from-page-service');
      pagesServiceStub.updateHits.rejects(expectedError);

      const res = await server.inject('/setsession');
      const header = res.headers['set-cookie'];
      const cookie = header[0].match(/(?:[^\x00-\x20\(\)<>@\,;\:\\'\/\[\]\?\=\{\}\x7F]+)\s*=\s*(?:([^\x00-\x20\'\,\;\\\x7F]*))/); // eslint-disable-line no-control-regex, no-useless-escape
      request.headers = {};
      request.headers.cookie = 'session=' + cookie[1];
      const response = await server.inject(request);
      Code.expect(response.statusCode).to.equal(200);
    });
  });

  lab.experiment('No Index Flag', function () {
    lab.beforeEach(async function () {
      pagesServiceStub.getBySlug.returns(Promise.resolve([{
        id: 1,
        slug,
        revision: 1,
        title: 'Oh Yea',
        info: 'Sample test',
        setup: '',
        teardown: '',
        initHTML: '',
        visible: 'n',
        author: 'Max',
        authorEmail: 'm@b.co',
        authorURL: 'b.co',
        hits: 0,
        published: now,
        updated: now
      }, [], [], []]));
    });

    lab.test('sets noIndex to true if page is flaged as "owned" in the session', async function () {
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
      const response = await server.inject(request);
      Code.expect(response.payload.indexOf('Not published yet!')).to.be.at.least(0);
    });

    lab.test('sets noIndex to true if page is being viewed by an admin', async function () {
      server.route({
        method: 'GET',
        path: '/setsession',
        handler: (req) => {
          const owns = { 2: true };
          req.yar.set('own', owns);
          req.yar.set('admin', true);
          return 'session set';
        }
      });

      const res = await server.inject('/setsession');
      const header = res.headers['set-cookie'];
      const cookie = header[0].match(/(?:[^\x00-\x20\(\)<>@\,;\:\\'\/\[\]\?\=\{\}\x7F]+)\s*=\s*(?:([^\x00-\x20\'\,\;\\\x7F]*))/); // eslint-disable-line no-control-regex, no-useless-escape
      request.headers = {};
      request.headers.cookie = 'session=' + cookie[1];
      const response = await server.inject(request);
      Code.expect(response.payload.indexOf('Not published yet!')).to.be.at.least(0);
    });
  });

  lab.experiment('comments form', function () {
    lab.beforeEach(async () => {
      pagesServiceStub.getBySlug.returns(
        Promise.resolve([{
          id: 1,
          slug,
          revision: 1,
          title: 'Oh Yea',
          info: 'Sample test',
          setup: '',
          teardown: '',
          initHTML: '',
          visible: 'y',
          author: 'Max',
          authorEmail: 'm@b.co',
          authorURL: 'b.co',
          hits: 0,
          published: now,
          updated: now
        }, [], [], []])
      );
    });

    lab.test('is not displayed if user is anonymous', async () => {
      const response = await server.inject(request);
      Code.expect(response.statusCode).to.equal(200);
      Code.expect(response.result).to.not.include('method="post" id="comment-form"');
      Code.expect(response.result).to.include('<a class="login" href="/login">');
    });

    lab.test('is displayed if user is logged in', async () => {
      request.auth = { strategy: 'session', credentials: { test: 'profile' } };

      const response = await server.inject(request);
      Code.expect(response.statusCode).to.equal(200);
      Code.expect(response.result).to.include('method="post" id="comment-form"');
      Code.expect(response.result).to.not.include('<a class="login" href="/login">');
    });
  });

  lab.experiment('publish', () => {
    lab.beforeEach(async () => {
      request.url = `/${slug}/1/publish`;
    });

    lab.test('handle error', async () => {
      pagesServiceStub.getBySlug.rejects(new Error('testing'));

      const res = await server.inject(request);
      Code.expect(res.statusCode).to.equal(500);
    });

    lab.test('404 when not owner or admin', async () => {
      pagesServiceStub.getBySlug.returns(Promise.resolve([{}]));

      const res = await server.inject(request);
      Code.expect(res.statusCode).to.equal(404);
    });

    lab.test('makes page visible', async () => {
      pagesServiceStub.getBySlug.returns(Promise.resolve([{
        id: 1
      }]));

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

      const published = await server.inject(request);
      Code.expect(published.statusCode).to.equal(302);
    });
  });
});

lab.experiment('create comment', () => {
  lab.beforeEach(async () => {
    request = {
      method: 'POST',
      url: `/${slug}/1`
    };
  });

  lab.test('not authorized', async () => {
    const res = await server.inject(request);
    Code.expect(res.statusCode).to.equal(401);
  });

  lab.experiment('when authorized', () => {
    lab.beforeEach(async () => {
      request.auth = { strategy: 'session', credentials: { username: 'somerandomaccount', test: 'profile' } };
    });

    lab.test('it catches error', async () => {
      pagesServiceStub.getBySlug.rejects(new Error('testing'));

      const res = await server.inject(request);
      Code.expect(res.statusCode).to.equal(500);
    });

    lab.test('not found', async function () {
      pagesServiceStub.getBySlug.rejects(new Error('Not found'));

      const response = await server.inject(request);
      Code.expect(response.statusCode).to.equal(404);
    });

    lab.experiment('and page exists', () => {
      lab.beforeEach(async () => {
        pagesServiceStub.getBySlug.returns(
          Promise.resolve([{
            id: 1,
            slug,
            revision: 1,
            title: 'Oh Yea',
            info: 'Sample test',
            setup: '',
            teardown: '',
            initHTML: '',
            visible: 'y',
            author: 'Max',
            authorEmail: 'm@b.co',
            authorURL: 'b.co',
            hits: 0,
            published: now,
            updated: now
          }, [], [], []])
        );

        request.headers = {};
      });

      lab.test('should show errors if payload is not valid', async () => {
        request.payload = {
          author: '',
          authorEmail: '',
          authorURL: 'bad url',
          message: '',
          unknown: ''
        };

        const response = await server.inject(request);
        Code.expect(response.statusCode).to.equal(200);
        Code.expect(response.result).to.include(defaults.errors.comment.author);
        Code.expect(response.result).to.include(defaults.errors.comment.authorEmail);
        Code.expect(response.result).to.include(defaults.errors.comment.authorURL);
        Code.expect(response.result).to.include(defaults.errors.comment.message);
      });

      lab.experiment('it should respond 200 with ip from', () => {
        lab.beforeEach(async () => {
          commentsServiceStub.create.returns(Promise.resolve({
            id: 1,
            pageID: 1,
            author: 'Max',
            authorEmail: 'mdd@test.com',
            authorURL: 'http://b.co',
            content: 'message',
            ip: '127.0.0.1',
            published: now
          }));

          request.payload = {
            author: 'Max',
            authorEmail: 'mdd@test.com',
            authorURL: 'http://b.co',
            message: 'message'
          };
        });

        lab.test('x-forwarded-for', async () => {
          request.headers = { 'x-forwarded-for': '127.0.0.1' };

          const response = await server.inject(request);
          Code.expect(response.statusCode).to.equal(200);
        });

        lab.test('remoteAddress', async () => {
          request.remoteAddress = '127.0.0.1';

          const response = await server.inject(request);
          Code.expect(response.statusCode).to.equal(200);
        });
      });
    });
  });
});

lab.experiment('atom', () => {
  lab.beforeEach(async () => {
    request = {
      method: 'GET',
      url: '/my-test.atom'
    };
  });

  lab.test('not found', async () => {
    pagesServiceStub.getVisibleBySlugWithRevisions.rejects(new Error('Not found'));

    const response = await server.inject(request);
    Code.expect(response.statusCode).to.equal(404);
  });

  lab.test('it responds with atom feed', async () => {
    const d = new Date();
    pagesServiceStub.getVisibleBySlugWithRevisions.returns(Promise.resolve([
      {
        title: 'Unit Test',
        slug: 'unit-test',
        published: d,
        updated: d
      },
      [
        {
          title: 'Unit',
          author: 'Max',
          revision: 1,
          // info intentionally missing
          published: d,
          updated: d
        }, {
          title: 'Test',
          author: 'Max',
          revision: 2,
          info: 'desc',
          published: d,
          updated: d
        }
      ]
    ]));

    const response = await server.inject(request);
    Code.expect(response.statusCode).to.equal(200);
    Code.expect(response.headers['content-type']).to.equal('application/atom+xml;charset=UTF-8');

    const dIso = d.toISOString();
    const strip = (str) => str.replace(/\s/g, '');
    Code.expect(strip(response.result)).to.equal(strip(`
      <feed xmlns="http://www.w3.org/2005/Atom" xml:lang="en">
          <title>Unit Test</title>
          <subtitle>The latest revisions for this jsPerf test case</subtitle>
          <link rel="self" type="application/atom+xml" href="http://jsperf.test/unit-test.atom" />
          <link rel="alternate" type="text/html" href="http://jsperf.test/unit-test" />
          <updated>${d.toString()}</updated>
          <id>tag:jsperf.test,2010:/unit-test</id>

              <entry>
                  <title>Unit</title>
                  <author>
                      <name>Max</name>
                  </author>
                  <link rel="alternate" type="text/html" href="http://jsperf.test/unit-test" />
                  <summary>
                        No description entered
                  </summary>
                  <id>tag:jsperf.test,2010:/unit-test</id>
                  <published>${dIso}</published>
                  <updated>${dIso}</updated>
              </entry>
              <entry>
                  <title>Test</title>
                  <author>
                      <name>Max</name>
                  </author>
                  <link rel="alternate" type="text/html" href="http://jsperf.test/unit-test/2" />
                  <summary>
                      desc
                  </summary>
                  <id>tag:jsperf.test,2010:/unit-test/2</id>
                  <published>${dIso}</published>
                  <updated>${dIso}</updated>
              </entry>
      </feed>
    `));
  });

  lab.test('it responds with generic error', async () => {
    pagesServiceStub.getVisibleBySlugWithRevisions.rejects(new Error());

    const response = await server.inject(request);
    Code.expect(response.statusCode).to.equal(500);
  });
});
