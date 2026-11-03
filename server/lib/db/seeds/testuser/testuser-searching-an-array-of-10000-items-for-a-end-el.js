'use strict';

/* eslint no-template-curly-in-string: 0 */
module.exports = {
  slug: 'testuser-searching-an-array-of-10000-items-for-a-end-el',
  title: 'Searching an array of 10000 items for a end element',
  info: 'Looks up a value located at the end of 10000 numbers using several built-ins.',
  initHTML: '',
  setup: [
    'var size = 10000;',
    'var haystack = [];',
    'for (var i = 0; i < size; i++) {',
    '  haystack.push(i);',
    '}',
    'var needle = size - 1;'
  ].join('\n'),
  teardown: '',
  test: [
    {
      title: 'indexOf',
      defer: 'n',
      code: [
        'var found = haystack.indexOf(needle) !== -1;'
      ].join('\n')
    },
    {
      title: 'includes',
      defer: 'n',
      code: [
        'var found = haystack.includes(needle);'
      ].join('\n')
    },
    {
      title: 'find',
      defer: 'n',
      code: [
        'var found = haystack.find(function (item) {',
        '  return item === needle;',
        '}) !== undefined;'
      ].join('\n')
    },
    {
      title: 'some',
      defer: 'n',
      code: [
        'var found = haystack.some(function (item) {',
        '  return item === needle;',
        '});'
      ].join('\n')
    },
    {
      title: 'manual loop',
      defer: 'n',
      code: [
        'var found = false;',
        'for (var i = 0; i < haystack.length; i++) {',
        '  if (haystack[i] === needle) {',
        '    found = true;',
        '    break;',
        '  }',
        '}'
      ].join('\n')
    }
  ]
};
