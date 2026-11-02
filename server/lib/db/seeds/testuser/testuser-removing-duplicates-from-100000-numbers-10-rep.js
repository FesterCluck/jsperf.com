'use strict';

/* eslint no-template-curly-in-string: 0 */
module.exports = {
  slug: 'testuser-removing-duplicates-from-100000-numbers-10-rep',
  title: 'Removing duplicates from 100000 numbers (10% repeats)',
  info: 'Deduplicating an array of 100000 numbers where about 10% repeat.',
  initHTML: '',
  setup: [
    'var n = 100000;',
    'var range = Math.max(1, Math.floor(n * 0.9));',
    'var input = [];',
    'for (var i = 0; i < n; i++) {',
    '  input.push(Math.floor(Math.random() * range));',
    '}',
    'var unique;'
  ].join('\n'),
  teardown: '',
  test: [
    {
      title: 'Set spread',
      defer: 'n',
      code: [
        'unique = [...new Set(input)];'
      ].join('\n')
    },
    {
      title: 'Array.from Set',
      defer: 'n',
      code: [
        'unique = Array.from(new Set(input));'
      ].join('\n')
    },
    {
      title: 'filter indexOf',
      defer: 'n',
      code: [
        'unique = input.filter(function (value, index) {',
        '  return input.indexOf(value) === index;',
        '});'
      ].join('\n')
    },
    {
      title: 'object lookup',
      defer: 'n',
      code: [
        'var seen = {};',
        'unique = [];',
        'for (var i = 0; i < input.length; i++) {',
        '  if (!seen[input[i]]) {',
        '    seen[input[i]] = true;',
        '    unique.push(input[i]);',
        '  }',
        '}'
      ].join('\n')
    }
  ]
};
