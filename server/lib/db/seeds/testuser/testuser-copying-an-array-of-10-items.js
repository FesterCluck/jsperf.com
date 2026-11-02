'use strict';

/* eslint no-template-curly-in-string: 0 */
module.exports = {
  slug: 'testuser-copying-an-array-of-10-items',
  title: 'Copying an array of 10 items',
  info: 'Ways of producing a shallow copy of an array with 10 elements.',
  initHTML: '',
  setup: [
    'var source = new Array(10);',
    'for (var i = 0; i < source.length; i++) {',
    '  source[i] = i;',
    '}',
    'var copy;'
  ].join('\n'),
  teardown: '',
  test: [
    {
      title: 'slice',
      defer: 'n',
      code: [
        'copy = source.slice();'
      ].join('\n')
    },
    {
      title: 'spread',
      defer: 'n',
      code: [
        'copy = [...source];'
      ].join('\n')
    },
    {
      title: 'Array.from',
      defer: 'n',
      code: [
        'copy = Array.from(source);'
      ].join('\n')
    },
    {
      title: 'concat',
      defer: 'n',
      code: [
        'copy = [].concat(source);'
      ].join('\n')
    },
    {
      title: 'manual loop',
      defer: 'n',
      code: [
        'copy = new Array(source.length);',
        'for (var i = 0; i < source.length; i++) {',
        '  copy[i] = source[i];',
        '}'
      ].join('\n')
    },
    {
      title: 'map identity',
      defer: 'n',
      code: [
        'copy = source.map(function (value) {',
        '  return value;',
        '});'
      ].join('\n')
    }
  ]
};
