'use strict';

/* eslint no-template-curly-in-string: 0 */
module.exports = {
  slug: 'testuser-resolving-1000-promises-in-parallel',
  title: 'Resolving 1000 promises in parallel',
  info: 'Scheduling 1000 resolved promises in parallel.',
  initHTML: '',
  setup: [
    'var n = 1000;',
    'function work(i) {',
    '  return Promise.resolve(i);',
    '}'
  ].join('\n'),
  teardown: '',
  test: [
    {
      title: 'Promise.all',
      defer: 'y',
      code: [
        'var jobs = [];',
        'for (var i = 0; i < n; i++) {',
        '  jobs.push(work(i));',
        '}',
        'Promise.all(jobs).then(function () {',
        '  deferred.resolve();',
        '});'
      ].join('\n')
    },
    {
      title: 'reduce chain',
      defer: 'y',
      code: [
        'var chain = Promise.resolve();',
        'for (var i = 0; i < n; i++) {',
        '  chain = chain.then(work.bind(null, i));',
        '}',
        'chain.then(function () {',
        '  deferred.resolve();',
        '});'
      ].join('\n')
    }
  ]
};
