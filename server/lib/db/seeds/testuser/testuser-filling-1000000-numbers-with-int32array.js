'use strict';

/* eslint no-template-curly-in-string: 0 */
module.exports = {
  slug: 'testuser-filling-1000000-numbers-with-int32array',
  title: 'Filling 1000000 numbers with Int32Array',
  info: 'Writes 1000000 values into a Int32Array.',
  initHTML: '',
  setup: [
    'var n = 1000000;',
    'var Kind = Int32Array;'
  ].join('\n'),
  teardown: '',
  test: [
    {
      title: 'preallocated',
      defer: 'n',
      code: [
        'var buf = new Kind(n);',
        'for (var i = 0; i < n; i++) {',
        '  buf[i] = i & 255;',
        '}'
      ].join('\n')
    },
    {
      title: 'Kind.from with map',
      defer: 'n',
      code: [
        'var buf = Kind.from({ length: n }, function (_, i) {',
        '  return i & 255;',
        '});'
      ].join('\n')
    },
    {
      title: 'fill',
      defer: 'n',
      code: [
        'var buf = new Kind(n);',
        'buf.fill(7);'
      ].join('\n')
    }
  ]
};
