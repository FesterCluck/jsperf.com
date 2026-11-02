'use strict';

/* eslint no-template-curly-in-string: 0 */
module.exports = {
  slug: 'testuser-converting-padded-strings-to-numbers',
  title: 'Converting padded strings to numbers',
  info: 'Compares string-to-number conversions for padded input.',
  initHTML: '',
  setup: [
    'var input = \'  42  \';',
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
