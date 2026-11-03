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
    getVisibleBySlugWithRevisions: sinon.stub(server.plugins['services/pages'], 'getVisibleBySlugWithRevisions'),
    publish: sinon.stub(server.plugins['services/pages'], 'publish').returns(Promise.resolve())
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

  lab.experiment('complexity rows', function () {
    const basePage = () => ({
      id: 1,
      slug,
      revision: 1,
      title: 'Oh Yea',
      info: '',
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
    });

    const estimate = {
      estimate: true,
      overall: 'on',
      calls: [{ code: 'build(shared)', cls: 'on' }, { code: 'find(x)', cls: 'ologn' }, { code: 'weird(x)', cls: 'unknown' }],
      more: 3
    };

    lab.test('renders a complexity row under each test, before any run, plus one sprite', async function () {
      const tests = [
        { testID: 1, title: 'one', code: 'build(shared)', defer: 'n', complexity: estimate },
        { testID: 2, title: 'two', code: 'x()', defer: 'n', complexity: { overall: 'o1', calls: [] } }
      ];
      pagesServiceStub.getBySlug.returns(Promise.resolve([basePage(), tests, [], []]));

      const response = await server.inject(request);
      Code.expect(response.statusCode).to.equal(200);
      const $ = cheerio.load(response.payload);

      Code.expect($('svg #curve-on3, svg #curve-unknown, svg #curve-o1').length).to.equal(3);
      Code.expect($('#bigo-guides').length).to.equal(1);

      // result rows are still addressable by id and come first in each pair
      Code.expect($('#title-1').length).to.equal(1);
      Code.expect($('#results-2').text()).to.equal('pending…');
      const rows = $('#test-table tbody tr');
      Code.expect(rows.length).to.equal(4);
      Code.expect(rows.eq(0).find('#results-1').length).to.equal(1);
      Code.expect(rows.eq(1).hasClass('complexity-row')).to.be.true();
      Code.expect(rows.eq(3).hasClass('complexity-row')).to.be.true();
      Code.expect(rows.eq(1).attr('title')).to.include('Estimated');

      const first = rows.eq(1);
      Code.expect(first.find('th .call-list code').map((i, el) => $(el).text()).get()).to.equal(['build(shared)', 'find(x)', 'weird(x)']);
      Code.expect(first.find('th li').last().text()).to.include('+3 more');
      Code.expect(first.find('td.complexity-breakdown .bigo-graph').map((i, el) => $(el).attr('class')).get()).to.equal(['bigo-graph bigo-on', 'bigo-graph bigo-ologn', 'bigo-graph bigo-unknown']);
      Code.expect(first.find('td.complexity-breakdown use').map((i, el) => $(el).attr('href')).get()).to.equal(['#curve-on', '#curve-ologn', '#curve-unknown']);
      Code.expect(first.find('td.complexity-breakdown .bigo-graph').first().attr('title')).to.equal('O(n) (linear), estimated');
      Code.expect(first.find('td.complexity-total .bigo-graph').hasClass('bigo-on')).to.be.true();
      Code.expect(first.find('td.complexity-total small').first().text()).to.equal('Overall: O(n)');
      Code.expect(first.find('td.complexity-total small').last().text()).to.equal('estimated');
      Code.expect(first.hasClass('complexity-unknown')).to.be.false();

      const second = rows.eq(3);
      Code.expect(second.find('th').text()).to.include('no function calls');
      Code.expect($('.complexity-legend').text()).to.include('estimates');
    });

    lab.test('marks undecidable results as unknown', async function () {
      const tests = [{ testID: 1, title: 'one', code: 'mystery()', defer: 'n', complexity: { overall: 'unknown', calls: [{ code: 'mystery()', cls: 'unknown' }] } }];
      pagesServiceStub.getBySlug.returns(Promise.resolve([basePage(), tests, [], []]));

      const $ = cheerio.load((await server.inject(request)).payload);
      const row = $('tr.complexity-row');
      Code.expect(row.hasClass('complexity-unknown')).to.be.true();
      Code.expect(row.find('td.complexity-total .bigo-graph').hasClass('bigo-unknown')).to.be.true();
      Code.expect(row.find('td.complexity-total small').first().text()).to.equal('Overall');
      Code.expect(row.find('td.complexity-total small').last().text()).to.equal('unknown');
    });

    lab.test('escapes code in the call list and survives a stored JSON string', async function () {
      const stored = JSON.stringify({ overall: 'o1', calls: [{ code: '<img src=x onerror=alert(1)>()', cls: 'o1' }] });
      pagesServiceStub.getBySlug.returns(Promise.resolve([basePage(), [{ testID: 1, title: 'one', code: 'x()', defer: 'n', complexity: stored }], [], []]));

      const response = await server.inject(request);
      Code.expect(response.payload).to.not.include('<img src=x');
      Code.expect(response.payload).to.include('&lt;img src&#x3D;x');
    });

    lab.test('shows nothing when a test has no usable estimate', async function () {
      pagesServiceStub.getBySlug.returns(Promise.resolve([basePage(), [{ testID: 1, title: 'one', code: 'x()', defer: 'n', complexity: null }], [], []]));

      const $ = cheerio.load((await server.inject(request)).payload);
      Code.expect($('tr.complexity-row').length).to.equal(0);
      Code.expect($('#bigo-guides').length).to.equal(0);
      Code.expect($('.complexity-legend').length).to.equal(0);
    });

    lab.test('works under a base path', async function () {
      const prefixed = await Support.createServer({ yar: true, auth: true, scooter: true, basePath: '/next', plugins: [MockPagesService, MockCommentService, TestPlugin] });
      sinon.stub(prefixed.plugins['services/pages'], 'getBySlug').returns(Promise.resolve([basePage(), [{ testID: 1, title: 'one', code: 'x()', defer: 'n', complexity: estimate }], [], []]));
      sinon.stub(prefixed.plugins['services/pages'], 'updateHits').returns(Promise.resolve());

      const response = await prefixed.inject({ method: 'GET', url: '/next/' + slug });
      Code.expect(response.statusCode).to.equal(200);
      const $ = cheerio.load(response.payload);
      // fragment references stay relative to the document, so they work with any prefix
      Code.expect($('link[rel=stylesheet]').first().attr('href')).to.startWith('/next/public/');
      Code.expect($('tr.complexity-row use').first().attr('href')).to.equal('#curve-on');
    });
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

    lab.test('sets noIndex to true if the viewer owns the page', async function () {
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
        userID: 7,
        author: 'Max',
        authorEmail: 'm@b.co',
        authorURL: 'b.co',
        hits: 0,
        published: now,
        updated: now
      }, [], [], []]));
      request.auth = { strategy: 'session', credentials: { id: 7, username: 'Max' } };

      const response = await server.inject(request);
      Code.expect(response.payload).to.include('Not published yet!');
      Code.expect(response.payload).to.include('/publish" method="post"');
    });

    lab.test('does not offer publishing to anyone else', async function () {
      request.auth = { strategy: 'session', credentials: { id: 8, username: 'Other' } };

      const response = await server.inject(request);
      Code.expect(response.payload).to.not.include('Not published yet!');
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
      request.method = 'POST';
      request.url = `/${slug}/1/publish`;
    });

    lab.test('is not available through GET', async () => {
      request.method = 'GET';

      const res = await server.inject(request);
      Code.expect(res.statusCode).to.equal(404);
    });

    lab.test('handle error', async () => {
      pagesServiceStub.getBySlug.rejects(new Error('testing'));

      const res = await server.inject(request);
      Code.expect(res.statusCode).to.equal(500);
    });

    lab.test('404 when anonymous', async () => {
      pagesServiceStub.getBySlug.returns(Promise.resolve([{ id: 1, userID: 7 }]));

      const res = await server.inject(request);
      Code.expect(res.statusCode).to.equal(404);
    });

    lab.test('404 when not the owner', async () => {
      pagesServiceStub.getBySlug.returns(Promise.resolve([{ id: 1, userID: 7 }]));
      request.auth = { strategy: 'session', credentials: { id: 8, username: 'other' } };

      const res = await server.inject(request);
      Code.expect(res.statusCode).to.equal(404);
      Code.expect(pagesServiceStub.publish.called).to.be.false();
    });

    lab.test('makes page visible', async () => {
      pagesServiceStub.getBySlug.returns(Promise.resolve([{ id: 1, userID: 7 }]));
      request.auth = { strategy: 'session', credentials: { id: 7, username: 'owner' } };

      const published = await server.inject(request);
      Code.expect(published.statusCode).to.equal(302);
      Code.expect(pagesServiceStub.publish.calledWith(1)).to.be.true();
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

      lab.experiment('it stores the ip', () => {
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

        lab.test('from the connection, ignoring a forged x-forwarded-for', async () => {
          request.headers = { 'x-forwarded-for': '6.6.6.6' };
          request.remoteAddress = '127.0.0.1';

          const response = await server.inject(request);
          Code.expect(response.statusCode).to.equal(200);
          Code.expect(commentsServiceStub.create.args[0][1]).to.equal('127.0.0.1');
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
