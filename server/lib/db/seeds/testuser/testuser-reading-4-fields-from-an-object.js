'use strict';

/* eslint no-template-curly-in-string: 0 */
module.exports = {
  slug: 'testuser-reading-4-fields-from-an-object',
  title: 'Reading 4 fields from an object',
  info: 'Destructuring versus direct property access for 4 fields.',
  initHTML: '',
  setup: [
    'var source = {',
    '  f0: 0,',
    '  f1: 1,',
    '  f2: 2,',
    '  f3: 3',
    '};'
  ].join('\n'),
  teardown: '',
  test: [
    {
      title: 'destructuring',
      defer: 'n',
      code: [
        'var { f0, f1, f2, f3 } = source;'
      ].join('\n')
    },
    {
      title: 'property access',
      defer: 'n',
      code: [
        'var f0 = source.f0;',
        'var f1 = source.f1;',
        'var f2 = source.f2;',
        'var f3 = source.f3;'
      ].join('\n')
    },
    {
      title: 'bracket access',
      defer: 'n',
      code: [
        'var f0 = source[\'f0\'];',
        'var f1 = source[\'f1\'];',
        'var f2 = source[\'f2\'];',
        'var f3 = source[\'f3\'];'
      ].join('\n')
    }
  ]
};
