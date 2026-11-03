'use strict';

/* eslint no-template-curly-in-string: 0 */
module.exports = {
  slug: 'testuser-array-iteration-over-100000-items',
  title: 'Array iteration over 100000 items',
  info: 'Compares ways of visiting every element of an array with 100000 numbers.',
  initHTML: '',
  setup: [
    'var size = 100000;',
    'var data = new Array(size);',
    'for (var i = 0; i < size; i++) {',
    '  data[i] = i * 2;',
    '}',
    'var sum = 0;'
  ].join('\n'),
  teardown: '',
  test: [
    {
      title: 'for loop',
      defer: 'n',
      code: [
        'sum = 0;',
        'for (var i = 0; i < data.length; i++) {',
        '  sum += data[i];',
        '}'
      ].join('\n')
    },
    {
      title: 'for loop with cached length',
      defer: 'n',
      code: [
        'sum = 0;',
        'for (var i = 0, len = data.length; i < len; i++) {',
        '  sum += data[i];',
        '}'
      ].join('\n')
    },
    {
      title: 'reverse while loop',
      defer: 'n',
      code: [
        'sum = 0;',
        'var i = data.length;',
        'while (i--) {',
        '  sum += data[i];',
        '}'
      ].join('\n')
    },
    {
      title: 'forEach',
      defer: 'n',
      code: [
        'sum = 0;',
        'data.forEach(function (value) {',
        '  sum += value;',
        '});'
      ].join('\n')
    },
    {
      title: 'for...of',
      defer: 'n',
      code: [
        'sum = 0;',
        'for (const value of data) {',
        '  sum += value;',
        '}'
      ].join('\n')
    },
    {
      title: 'reduce',
      defer: 'n',
      code: [
        'sum = data.reduce(function (acc, value) {',
        '  return acc + value;',
        '}, 0);'
      ].join('\n')
    }
  ]
};
