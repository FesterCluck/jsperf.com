'use strict';

/* eslint no-template-curly-in-string: 0 */
module.exports = {
  slug: 'testuser-filter-map-and-sum-over-100000-items',
  title: 'Filter, map and sum over 100000 items',
  info: 'A filter/map/reduce pipeline over 100000 numbers compared with hand written loops.',
  initHTML: '',
  setup: [
    'var n = 100000;',
    'var numbers = [];',
    'for (var i = 0; i < n; i++) {',
    '  numbers.push(i);',
    '}',
    'var answer;'
  ].join('\n'),
  teardown: '',
  test: [
    {
      title: 'chained methods',
      defer: 'n',
      code: [
        'answer = numbers',
        '  .filter(function (x) { return x % 2 === 0; })',
        '  .map(function (x) { return x * 3; })',
        '  .reduce(function (acc, x) { return acc + x; }, 0);'
      ].join('\n')
    },
    {
      title: 'chained arrow functions',
      defer: 'n',
      code: [
        'answer = numbers',
        '  .filter((x) => x % 2 === 0)',
        '  .map((x) => x * 3)',
        '  .reduce((acc, x) => acc + x, 0);'
      ].join('\n')
    },
    {
      title: 'single reduce',
      defer: 'n',
      code: [
        'answer = numbers.reduce(function (acc, x) {',
        '  return x % 2 === 0 ? acc + x * 3 : acc;',
        '}, 0);'
      ].join('\n')
    },
    {
      title: 'single loop',
      defer: 'n',
      code: [
        'answer = 0;',
        'for (var i = 0; i < numbers.length; i++) {',
        '  if (numbers[i] % 2 === 0) {',
        '    answer += numbers[i] * 3;',
        '  }',
        '}'
      ].join('\n')
    }
  ]
};
