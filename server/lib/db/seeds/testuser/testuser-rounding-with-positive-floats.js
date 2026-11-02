'use strict';

/* eslint no-template-curly-in-string: 0 */
module.exports = {
  slug: 'testuser-rounding-with-positive-floats',
  title: 'Rounding with positive floats',
  info: 'Ways to truncate or round positive floats.',
  initHTML: '',
  setup: [
    'var x = 12345.6789;',
    'var r;'
  ].join('\n'),
  teardown: '',
  test: [
    {
      title: 'Math.floor',
      defer: 'n',
      code: [
        'r = Math.floor(x);'
      ].join('\n')
    },
    {
      title: 'Math.round',
      defer: 'n',
      code: [
        'r = Math.round(x);'
      ].join('\n')
    },
    {
      title: 'Math.trunc',
      defer: 'n',
      code: [
        'r = Math.trunc(x);'
      ].join('\n')
    },
    {
      title: 'bitwise or',
      defer: 'n',
      code: [
        'r = x | 0;'
      ].join('\n')
    },
    {
      title: 'double bitwise not',
      defer: 'n',
      code: [
        'r = ~~x;'
      ].join('\n')
    },
    {
      title: 'toFixed',
      defer: 'n',
      code: [
        'r = Number(x.toFixed(0));'
      ].join('\n')
    }
  ]
};
