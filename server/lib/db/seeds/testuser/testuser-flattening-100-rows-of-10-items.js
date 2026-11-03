'use strict';

/* eslint no-template-curly-in-string: 0 */
module.exports = {
  slug: 'testuser-flattening-100-rows-of-10-items',
  title: 'Flattening 100 rows of 10 items',
  info: 'Flattening a nested array of 100 rows with 10 items each.',
  initHTML: '',
  setup: [
    'var rows = 100;',
    'var cols = 10;',
    'var nested = [];',
    'for (var r = 0; r < rows; r++) {',
    '  var row = [];',
    '  for (var c = 0; c < cols; c++) {',
    '    row.push(r * cols + c);',
    '  }',
    '  nested.push(row);',
    '}',
    'var flat;'
  ].join('\n'),
  teardown: '',
  test: [
    {
      title: 'Array#flat',
      defer: 'n',
      code: [
        'flat = nested.flat();'
      ].join('\n')
    },
    {
      title: 'concat apply',
      defer: 'n',
      code: [
        'flat = [].concat.apply([], nested);'
      ].join('\n')
    },
    {
      title: 'spread concat',
      defer: 'n',
      code: [
        'flat = [].concat(...nested);'
      ].join('\n')
    },
    {
      title: 'reduce concat',
      defer: 'n',
      code: [
        'flat = nested.reduce(function (acc, row) {',
        '  return acc.concat(row);',
        '}, []);'
      ].join('\n')
    },
    {
      title: 'nested loops',
      defer: 'n',
      code: [
        'flat = [];',
        'for (var r = 0; r < nested.length; r++) {',
        '  for (var c = 0; c < nested[r].length; c++) {',
        '    flat.push(nested[r][c]);',
        '  }',
        '}'
      ].join('\n')
    }
  ]
};
