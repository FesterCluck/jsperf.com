'use strict';

/* eslint no-template-curly-in-string: 0 */
module.exports = {
  slug: 'testuser-sorting-100-descending-numbers',
  title: 'Sorting 100 descending numbers',
  info: 'Sorting 100 numbers that start out descending.',
  initHTML: '',
  setup: [
    'var size = 100;',
    'var base = [];',
    'for (var i = 0; i < size; i++) {',
    '  base.push(size - i);',
    '}',
    'var work;'
  ].join('\n'),
  teardown: '',
  test: [
    {
      title: 'sort with comparator',
      defer: 'n',
      code: [
        'work = base.slice();',
        'work.sort(function (a, b) {',
        '  return a - b;',
        '});'
      ].join('\n')
    },
    {
      title: 'sort with arrow comparator',
      defer: 'n',
      code: [
        'work = base.slice();',
        'work.sort((a, b) => a - b);'
      ].join('\n')
    },
    {
      title: 'typed array sort',
      defer: 'n',
      code: [
        'work = Float64Array.from(base);',
        'work.sort();'
      ].join('\n')
    },
    {
      title: 'insertion sort',
      defer: 'n',
      code: [
        'work = base.slice();',
        'for (var i = 1; i < work.length; i++) {',
        '  var current = work[i];',
        '  var j = i - 1;',
        '  while (j >= 0 && work[j] > current) {',
        '    work[j + 1] = work[j];',
        '    j--;',
        '  }',
        '  work[j + 1] = current;',
        '}'
      ].join('\n')
    }
  ]
};
