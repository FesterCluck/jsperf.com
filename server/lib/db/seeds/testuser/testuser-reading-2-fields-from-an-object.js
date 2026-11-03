'use strict';

/* eslint no-template-curly-in-string: 0 */
module.exports = {
  slug: 'testuser-reading-2-fields-from-an-object',
  title: 'Reading 2 fields from an object',
  info: 'Destructuring versus direct property access for 2 fields.',
  initHTML: '',
  setup: [
    'var source = {',
    '  f0: 0,',
    '  f1: 1',
    '};'
  ].join('\n'),
  teardown: '',
  test: [
    {
      title: 'destructuring',
      defer: 'n',
      code: [
        'var { f0, f1 } = source;'
      ].join('\n')
    },
    {
      title: 'property access',
      defer: 'n',
      code: [
        'var f0 = source.f0;',
        'var f1 = source.f1;'
      ].join('\n')
    },
    {
      title: 'bracket access',
      defer: 'n',
      code: [
        'var f0 = source[\'f0\'];',
        'var f1 = source[\'f1\'];'
      ].join('\n')
    }
  ]
};
