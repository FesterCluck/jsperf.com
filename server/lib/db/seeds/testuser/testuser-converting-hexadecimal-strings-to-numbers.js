'use strict';

/* eslint no-template-curly-in-string: 0 */
module.exports = {
  slug: 'testuser-converting-hexadecimal-strings-to-numbers',
  title: 'Converting hexadecimal strings to numbers',
  info: 'Compares string-to-number conversions for hexadecimal input.',
  initHTML: '',
  setup: [
    'var input = \'0xFF\';',
    'var out;'
  ].join('\n'),
  teardown: '',
  test: [
    {
      title: 'Number()',
      defer: 'n',
      code: [
        'out = Number(input);'
      ].join('\n')
    },
    {
      title: 'parseFloat',
      defer: 'n',
      code: [
        'out = parseFloat(input);'
      ].join('\n')
    },
    {
      title: 'parseInt radix 10',
      defer: 'n',
      code: [
        'out = parseInt(input, 10);'
      ].join('\n')
    },
    {
      title: 'unary plus',
      defer: 'n',
      code: [
        'out = +input;'
      ].join('\n')
    },
    {
      title: 'multiply by one',
      defer: 'n',
      code: [
        'out = input * 1;'
      ].join('\n')
    },
    {
      title: 'bitwise or zero',
      defer: 'n',
      code: [
        'out = input | 0;'
      ].join('\n')
    }
  ]
};
