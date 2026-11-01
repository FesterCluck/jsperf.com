'use strict';

const register = (server) => {
  const redirects = [
    {
      path: '/document-head-speed-test',
      redirect: '/document-head'
    }, {
      path: '/testing',
      redirect: '/accessing-dom-elements'
    }, {
      path: '/array-creating',
      redirect: '/literal-vs-constructor-array'
    }, {
      path: '/jquery-each2-vs-quickeach-vs-each',
      redirect: '/jquery-each-vs-quickeach/2'
    }, {
      path: '/equlity-operators-with-the-same-types',
      redirect: '/equality-operators-with-the-same-types'
    }, {
      path: '/math-min-a-b-vs-a-b-a-b',
      redirect: '/math-vs-greater-than'
    }, {
      path: '/remove-all-child-nodes',
      redirect: '/removechildren/3'
    }
  ];

  const handler = (url) => (request, h) => h.redirect(url).permanent();

  for (const { path, redirect } of redirects) {
    server.route({
      method: 'GET',
      path,
      handler: handler(redirect)
    });
  }
};

exports.plugin = {
  name: 'web/redirects',
  register
};
