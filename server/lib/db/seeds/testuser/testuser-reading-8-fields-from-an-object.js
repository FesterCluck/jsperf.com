'use strict';

/* eslint no-template-curly-in-string: 0 */
module.exports = {
  slug: 'testuser-reading-8-fields-from-an-object',
  title: 'Reading 8 fields from an object',
  info: 'Destructuring versus direct property access for 8 fields.',
  initHTML: '',
  setup: [
    'var source = {',
    '  f0: 0,',
    '  f1: 1,',
    '  f2: 2,',
    '  f3: 3,',
    '  f4: 4,',
    '  f5: 5,',
    '  f6: 6,',
    '  f7: 7',
    '};'
  ].join('\n'),
  teardown: '',
  test: [
    {
      title: 'destructuring',
      defer: 'n',
      code: [
        'var { f0, f1, f2, f3, f4, f5, f6, f7 } = source;'
      ].join('\n')
    },
    {
      title: 'property access',
      defer: 'n',
      code: [
        'var f0 = source.f0;',
        'var f1 = source.f1;',
        'var f2 = source.f2;',
        'var f3 = source.f3;',
        'var f4 = source.f4;',
        'var f5 = source.f5;',
        'var f6 = source.f6;',
        'var f7 = source.f7;'
      ].join('\n')
    },
    {
      title: 'bracket access',
      defer: 'n',
      code: [
        'var f0 = source[\'f0\'];',
        'var f1 = source[\'f1\'];',
        'var f2 = source[\'f2\'];',
        'var f3 = source[\'f3\'];',
        'var f4 = source[\'f4\'];',
        'var f5 = source[\'f5\'];',
        'var f6 = source[\'f6\'];',
        'var f7 = source[\'f7\'];'
      ].join('\n')
    }
  ]
};
