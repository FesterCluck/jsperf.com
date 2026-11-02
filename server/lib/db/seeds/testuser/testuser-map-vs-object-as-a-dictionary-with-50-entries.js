'use strict';

/* eslint no-template-curly-in-string: 0 */
module.exports = {
  slug: 'testuser-map-vs-object-as-a-dictionary-with-50-entries',
  title: 'Map vs object as a dictionary with 50 entries',
  info: 'Reads, writes and deletes against a dictionary holding 50 entries.',
  initHTML: '',
  setup: [
    'var n = 50;',
    'var map = new Map();',
    'var obj = {};',
    'for (var i = 0; i < n; i++) {',
    '  map.set(\'k\' + i, i);',
    '  obj[\'k\' + i] = i;',
    '}',
    'var hit;'
  ].join('\n'),
  teardown: '',
  test: [
    {
      title: 'Map#get',
      defer: 'n',
      code: [
        'for (var i = 0; i < n; i++) {',
        '  hit = map.get(\'k\' + i);',
        '}'
      ].join('\n')
    },
    {
      title: 'object property read',
      defer: 'n',
      code: [
        'for (var i = 0; i < n; i++) {',
        '  hit = obj[\'k\' + i];',
        '}'
      ].join('\n')
    },
    {
      title: 'Map#has',
      defer: 'n',
      code: [
        'for (var i = 0; i < n; i++) {',
        '  hit = map.has(\'k\' + i);',
        '}'
      ].join('\n')
    },
    {
      title: 'in operator',
      defer: 'n',
      code: [
        'for (var i = 0; i < n; i++) {',
        '  hit = (\'k\' + i) in obj;',
        '}'
      ].join('\n')
    }
  ]
};
