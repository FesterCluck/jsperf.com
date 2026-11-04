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

    // the caption names the visitor's browser, not an unformatted object
    request.headers = { 'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36' };
    const withAgent = cheerio.load((await server.inject(request)).payload);
    Code.expect(withAgent('caption').text()).to.match(/^Testing in Chrome 142\.0\.0/);
    Code.expect(withAgent('caption').text()).to.not.contain('[object Object]');

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
      // a heading names the group, every call of a test has a row of its own, then a row for the calls that were left out
      const rows = $('#test-table tbody tr');
      Code.expect(rows.length).to.equal(9);
      Code.expect(rows.eq(0).find('#results-1').length).to.equal(1);
      Code.expect(rows.eq(1).hasClass('complexity-heading')).to.be.true();
      Code.expect(rows.eq(1).find('th').text()).to.startWith('Time');
      Code.expect(rows.eq(2).hasClass('complexity-row')).to.be.true();
      Code.expect(rows.eq(6).find('#results-2').length).to.equal(1);
      Code.expect(rows.eq(7).find('th').text()).to.startWith('Time');
      Code.expect(rows.eq(8).hasClass('complexity-row')).to.be.true();

      const group = rows.slice(2, 6);
      Code.expect(group.find('th').map((i, el) => $(el).text().trim()).get()).to.equal(['build(shared)', 'find(x)', 'weird(x)', '+3 more']);
      Code.expect(group.find('td.complexity-breakdown .bigo-graph').map((i, el) => $(el).attr('class')).get()).to.equal(['bigo-graph bigo-on', 'bigo-graph bigo-ologn', 'bigo-graph bigo-unknown']);
      Code.expect(group.find('td.complexity-breakdown use').map((i, el) => $(el).attr('href')).get()).to.equal(['#curve-on', '#curve-ologn', '#curve-unknown']);
      Code.expect(group.find('td.complexity-total').length).to.equal(1);
      Code.expect(group.find('td.complexity-total').attr('rowspan')).to.equal('4');
      Code.expect(group.find('td.complexity-total .bigo-graph').hasClass('bigo-on')).to.be.true();
      Code.expect(group.filter('.complexity-end').length).to.equal(1);
      Code.expect(rows.eq(5).hasClass('complexity-end')).to.be.true();
      Code.expect(group.filter('.complexity-unknown').length).to.equal(0);

      Code.expect(rows.eq(8).find('th').text()).to.include('no function calls');
    });

    lab.test('continues each call with the steps it is made of, small charts with their names below', async function () {
      const complexity = {
        overall: 'onlogn',
        calls: [
          { code: 'data.sort()', cls: 'onlogn', steps: [{ name: 'copy', cls: 'on' }, { name: 'merge', cls: 'onlogn' }, { name: 'back', cls: 'on' }], moreSteps: 2 },
          { code: 'x.push(1)', cls: 'o1' }
        ],
        space: { overall: 'on', items: [{ code: 'data.sort()', cls: 'on', steps: [{ name: 'copy', cls: 'on' }, { name: 'merge', cls: 'on' }] }], variables: [{ code: 'out', cls: 'on' }] }
      };
      pagesServiceStub.getBySlug.returns(Promise.resolve([basePage(), [{ testID: 1, title: 'one', code: 'data.sort()', defer: 'n', complexity }], [], []]));

      const $ = cheerio.load((await server.inject(request)).payload);
      const rows = $('tr.complexity-row');
      Code.expect(rows.length).to.equal(4);

      const time = rows.eq(0).find('.bigo-steps');
      Code.expect(time.attr('aria-label')).to.equal('What data.sort() is made of');
      Code.expect(time.find('.bigo-step:not(.bigo-more) .bigo-step-name').map((i, el) => $(el).text()).get()).to.equal(['copy', 'merge', 'back']);
      Code.expect(time.find('.bigo-mini').map((i, el) => $(el).attr('class')).get()).to.equal([
        'bigo-graph bigo-mini bigo-on', 'bigo-graph bigo-mini bigo-onlogn', 'bigo-graph bigo-mini bigo-on'
      ]);
      Code.expect(time.find('use').map((i, el) => $(el).attr('href')).get()).to.equal(['#curve-on', '#curve-onlogn', '#curve-on']);
      Code.expect(time.find('.bigo-step').first().attr('title')).to.equal('copy: O(n)');
      Code.expect(time.find('.bigo-sr').first().text()).to.equal('O(n)');
      Code.expect(time.find('.bigo-more').text()).to.equal('+2 more');
      Code.expect(rows.eq(1).find('.bigo-steps').length).to.equal(0);

      // memory steps are drawn like the memory chart: dashed
      const space = rows.eq(2).find('.bigo-steps');
      Code.expect(space.find('.bigo-mini').first().hasClass('space-graph')).to.be.true();
      Code.expect(rows.eq(2).find('td.complexity-total').attr('rowspan')).to.equal('2');
      Code.expect(rows.eq(3).hasClass('complexity-end')).to.be.true();

      // the memory rows have a heading of their own, and the variable among them says so
      const headings = $('tr.complexity-heading th').map((i, el) => $(el).text()).get();
      Code.expect(headings.length).to.equal(2);
      Code.expect(headings[0]).to.startWith('Time');
      Code.expect(headings[1]).to.startWith('Extra memory');
      Code.expect(headings[1]).to.include('beyond the inputs');
      Code.expect(rows.eq(2).find('.complexity-tag').length).to.equal(0);
      Code.expect(rows.eq(3).find('.complexity-tag').text()).to.equal('variable');
      Code.expect(rows.eq(3).hasClass('space-variable')).to.be.true();
      Code.expect(rows.eq(3).find('th code').text()).to.equal('out');

      // the new chart classes have curves in the sprite
      Code.expect($('#curve-ologn2, #curve-onlogn2, #curve-oexp').length).to.equal(3);
    });

    lab.test('a step that is a call opens to show its own steps', async function () {
      const complexity = {
        overall: 'on2',
        calls: [{
          code: 'mid(arr)',
          cls: 'on2',
          steps: [{ name: 'leaf', cls: 'onlogn', steps: [{ name: '.sort', cls: 'onlogn', steps: [{ name: 'copy', cls: 'on' }], more: 0 }], more: 2 }, { name: 'for loop', cls: 'on2' }]
        }]
      };
      pagesServiceStub.getBySlug.returns(Promise.resolve([basePage(), [{ testID: 1, title: 'one', code: 'mid(arr)', defer: 'n', complexity }], [], []]));

      const $ = cheerio.load((await server.inject(request)).payload);
      const row = $('tr.complexity-row').eq(0);
      const open = row.find('details.bigo-expandable');
      Code.expect(open.length).to.equal(2);
      Code.expect(open.first().children('summary').find('.bigo-step-name').text()).to.equal('leaf');
      Code.expect(open.first().children('summary').attr('title')).to.equal('leaf: O(n log n). Show what it is made of');
      Code.expect(row.find('> td > .bigo-line > .bigo-steps > .bigo-step').length).to.equal(2);

      const inner = open.first().children('.bigo-steps');
      Code.expect(inner.hasClass('bigo-nested')).to.be.true();
      Code.expect(inner.attr('aria-label')).to.equal('What leaf is made of');
      Code.expect(inner.find('.bigo-then').length).to.equal(0);
      Code.expect(inner.find('.bigo-more').text()).to.equal('+2 more');
      Code.expect(open.eq(1).children('.bigo-steps').find('.bigo-step-name').text()).to.equal('copy');
    });

    lab.test('marks undecidable results as unknown', async function () {
      const tests = [{ testID: 1, title: 'one', code: 'mystery()', defer: 'n', complexity: { overall: 'unknown', calls: [{ code: 'mystery()', cls: 'unknown' }] } }];
      pagesServiceStub.getBySlug.returns(Promise.resolve([basePage(), tests, [], []]));

      const $ = cheerio.load((await server.inject(request)).payload);
      const row = $('tr.complexity-row');
      Code.expect(row.hasClass('complexity-unknown')).to.be.true();
      Code.expect(row.find('td.complexity-total .bigo-graph').hasClass('bigo-unknown')).to.be.true();
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

lab.experiment('sandboxed runner', () => {
  lab.test('the page embeds the frame, escapes titles and does not inline the code', async () => {
    const page = {
      id: 1,
      slug,
      revision: 3,
      title: 'Oh <img src=x onerror=alert(1)>',
      info: '',
      setup: '',
      teardown: '',
      initHTML: '<script>window.attackerCode = 1</script>',
      visible: 'y',
      author: 'Max',
      authorEmail: 'm@b.co',
      authorURL: 'b.co',
      hits: 0,
      published: now,
      updated: now,
      maxRev: 3
    };
    const tests = [{ testID: 1, title: 't <b>1</b>', code: 'a = 1', defer: 'n' }];
    pagesServiceStub.getBySlug.returns(Promise.resolve([page, tests, [], []]));

    const res = await server.inject({ method: 'GET', url: `/${slug}/3` });
    Code.expect(res.statusCode).to.equal(200);
    Code.expect(res.payload).to.include(`<iframe id="test-frame" class="" src="/${slug}/3/frame" sandbox="allow-scripts"`);
    Code.expect(res.payload).to.include('<script src="/public/_js/test.js"></script>');
    Code.expect(res.payload).to.not.include('<img src=x onerror');
    Code.expect(res.payload).to.not.include('<b>1</b>');
    Code.expect(res.payload).to.not.include('window.attackerCode = 1</script>');
    Code.expect(res.payload).to.not.include('ui.add(');
  });
});

lab.experiment('frame', () => {
  const framePage = () => [{
    id: 1,
    slug,
    revision: 1,
    title: 'Oh </title><b>Yea</b>',
    setup: 'var data = [1, 2];',
    teardown: 'data = null;',
    initHTML: '<p id="prep">prep</p><script>function init() {}</script>'
  }, [
    { testID: 1, title: 't1', code: 'data.length;', defer: 'n' },
    { testID: 2, title: 't2</script><script>alert(1)', code: 'data.pop();', defer: 'y' }
  ], [], []];

  lab.beforeEach(async () => {
    request = { method: 'GET', url: `/${slug}/1/frame` };
  });

  lab.test('is sandboxed to an opaque origin and may only be framed by this site', async () => {
    pagesServiceStub.getBySlug.returns(Promise.resolve(framePage()));

    const res = await server.inject(request);
    Code.expect(res.statusCode).to.equal(200);
    Code.expect(res.headers['content-security-policy']).to.equal('sandbox allow-scripts');
    Code.expect(res.headers['x-frame-options']).to.equal('SAMEORIGIN');
    Code.expect(pagesServiceStub.getBySlug.calledWith(slug, '1')).to.be.true();
  });

  lab.test('contains the runner, the tests, setup, teardown and the preparation HTML', async () => {
    pagesServiceStub.getBySlug.returns(Promise.resolve(framePage()));

    const res = await server.inject(request);
    Code.expect(res.payload).to.startWith('<!doctype html>');
    Code.expect(res.payload).to.include('<script>').and.to.include('Benchmark');
    Code.expect(res.payload).to.not.include('src="/public/_js/frame.js"');
    Code.expect(res.payload).to.include("'fn': 'data.length;'");
    Code.expect(res.payload).to.include("'defer': true");
    Code.expect(res.payload).to.include("Benchmark.prototype.setup = 'var data = [1, 2];'");
    Code.expect(res.payload).to.include("Benchmark.prototype.teardown = 'data = null;'");
    Code.expect(res.payload).to.include('<p id="prep">prep</p><script>function init() {}</script>');
    // the page's title is not markup
    Code.expect(res.payload).to.include('<title>Oh &lt;/title&gt;&lt;b&gt;Yea&lt;/b&gt;</title>');
  });

  lab.test('a test title cannot break out of the script it is written into', async () => {
    pagesServiceStub.getBySlug.returns(Promise.resolve(framePage()));

    const res = await server.inject(request);
    Code.expect(res.payload).to.not.include('</script><script>alert(1)');
  });

  lab.test('omits setup and teardown when there are none', async () => {
    const values = framePage();
    values[0].setup = '';
    values[0].teardown = '';
    pagesServiceStub.getBySlug.returns(Promise.resolve(values));

    const res = await server.inject(request);
    Code.expect(res.payload).to.not.include('Benchmark.prototype.setup = function');
  });

  lab.test('not found', async () => {
    pagesServiceStub.getBySlug.rejects(new Error('Not found'));

    const res = await server.inject(request);
    Code.expect(res.statusCode).to.equal(404);
  });

  lab.test('fail to get by slug', async () => {
    pagesServiceStub.getBySlug.rejects(new Error('real helpful'));

    const res = await server.inject(request);
    Code.expect(res.statusCode).to.equal(500);
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
