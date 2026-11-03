'use strict';

/* eslint no-template-curly-in-string: 0 */
module.exports = {
  slug: 'testuser-converting-tiny-numbers-to-strings',
  title: 'Converting tiny numbers to strings',
  info: 'Turning tiny numbers into their string form.',
  initHTML: '',
  setup: [
    'var num = 1e-7;',
    'var text;'
  ].join('\n'),
  teardown: '',
  test: [
    {
      title: 'String()',
      defer: 'n',
      code: [
        'text = String(num);'
      ].join('\n')
    },
    {
      title: 'toString',
      defer: 'n',
      code: [
        'text = num.toString();'
      ].join('\n')
    },
    {
      title: 'empty string concat',
      defer: 'n',
      code: [
        'text = \'\' + num;'
      ].join('\n')
    },
    {
      title: 'template literal',
      defer: 'n',
      code: [
        'text = `${num}`;'
      ].join('\n')
    },
    {
      title: 'toString radix 10',
      defer: 'n',
      code: [
        'text = num.toString(10);'
      ].join('\n')
    }
  ]
};
