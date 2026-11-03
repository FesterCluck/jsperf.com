'use strict';

/* eslint no-template-curly-in-string: 0 */
module.exports = {
  slug: 'testuser-reading-16-fields-from-an-object',
  title: 'Reading 16 fields from an object',
  info: 'Destructuring versus direct property access for 16 fields.',
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
    '  f7: 7,',
    '  f8: 8,',
    '  f9: 9,',
    '  f10: 10,',
    '  f11: 11,',
    '  f12: 12,',
    '  f13: 13,',
    '  f14: 14,',
    '  f15: 15',
    '};'
  ].join('\n'),
  teardown: '',
  test: [
    {
      title: 'destructuring',
      defer: 'n',
      code: [
        'var { f0, f1, f2, f3, f4, f5, f6, f7, f8, f9, f10, f11, f12, f13, f14, f15 } = source;'
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
        'var f7 = source.f7;',
        'var f8 = source.f8;',
        'var f9 = source.f9;',
        'var f10 = source.f10;',
        'var f11 = source.f11;',
        'var f12 = source.f12;',
        'var f13 = source.f13;',
        'var f14 = source.f14;',
        'var f15 = source.f15;'
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
        'var f7 = source[\'f7\'];',
        'var f8 = source[\'f8\'];',
        'var f9 = source[\'f9\'];',
        'var f10 = source[\'f10\'];',
        'var f11 = source[\'f11\'];',
        'var f12 = source[\'f12\'];',
        'var f13 = source[\'f13\'];',
        'var f14 = source[\'f14\'];',
        'var f15 = source[\'f15\'];'
      ].join('\n')
    }
  ]
};
