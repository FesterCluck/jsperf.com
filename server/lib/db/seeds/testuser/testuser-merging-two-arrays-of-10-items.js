'use strict';

/* eslint no-template-curly-in-string: 0 */
module.exports = {
  slug: 'testuser-merging-two-arrays-of-10-items',
  title: 'Merging two arrays of 10 items',
  info: 'Concatenating two arrays that each hold 10 items.',
  initHTML: '',
  setup: [
    'var n = 10;',
    'var a = [];',
    'var b = [];',
    'for (var i = 0; i < n; i++) {',
    '  a.push(i);',
    '  b.push(i + n);',
    '}',
    'var merged;'
  ].join('\n'),
  teardown: '',
  test: [
    {
      title: 'concat',
      defer: 'n',
      code: [
        'merged = a.concat(b);'
      ].join('\n')
    },
    {
      title: 'spread',
      defer: 'n',
      code: [
        'merged = [...a, ...b];'
      ].join('\n')
    },
    {
      title: 'push loop',
      defer: 'n',
      code: [
        'merged = a.slice();',
        'for (var i = 0; i < b.length; i++) {',
        '  merged.push(b[i]);',
        '}'
      ].join('\n')
    },
    {
      title: 'push apply',
      defer: 'n',
      code: [
        'merged = a.slice();',
        'Array.prototype.push.apply(merged, b);'
      ].join('\n')
    }
  ]
};
