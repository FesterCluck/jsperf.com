'use strict';

/* eslint no-template-curly-in-string: 0 */
module.exports = {
  slug: 'testuser-creating-an-array-of-10-zeros',
  title: 'Creating an array of 10 zeros',
  info: 'Allocation strategies for an array of 10 zeros.',
  initHTML: '',
  setup: [
    'var n = 10;',
    'var zeros;'
  ].join('\n'),
  teardown: '',
  test: [
    {
      title: 'new Array fill',
      defer: 'n',
      code: [
        'zeros = new Array(n).fill(0);'
      ].join('\n')
    },
    {
      title: 'Array.from',
      defer: 'n',
      code: [
        'zeros = Array.from({ length: n }, function () { return 0; });'
      ].join('\n')
    },
    {
      title: 'push loop',
      defer: 'n',
      code: [
        'zeros = [];',
        'for (var i = 0; i < n; i++) {',
        '  zeros.push(0);',
        '}'
      ].join('\n')
    },
    {
      title: 'indexed loop',
      defer: 'n',
      code: [
        'zeros = new Array(n);',
        'for (var i = 0; i < n; i++) {',
        '  zeros[i] = 0;',
        '}'
      ].join('\n')
    },
    {
      title: 'spread keys',
      defer: 'n',
      code: [
        'zeros = [...Array(n).keys()].map(function () { return 0; });'
      ].join('\n')
    },
    {
      title: 'Float64Array',
      defer: 'n',
      code: [
        'zeros = new Float64Array(n);'
      ].join('\n')
    }
  ]
};
