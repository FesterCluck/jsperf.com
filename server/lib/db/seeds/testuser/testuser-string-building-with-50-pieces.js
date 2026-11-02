'use strict';

/* eslint no-template-curly-in-string: 0 */
module.exports = {
  slug: 'testuser-string-building-with-50-pieces',
  title: 'String building with 50 pieces',
  info: 'Compares concatenation strategies when joining 50 short strings.',
  initHTML: '',
  setup: [
    'var count = 50;',
    'var pieces = [];',
    'for (var i = 0; i < count; i++) {',
    '  pieces.push(\'item-\' + i);',
    '}'
  ].join('\n'),
  teardown: '',
  test: [
    {
      title: '+= operator',
      defer: 'n',
      code: [
        'var result = \'\';',
        'for (var i = 0; i < pieces.length; i++) {',
        '  result += pieces[i];',
        '}'
      ].join('\n')
    },
    {
      title: 'Array#join',
      defer: 'n',
      code: [
        'var result = pieces.join(\'\');'
      ].join('\n')
    },
    {
      title: 'String#concat',
      defer: 'n',
      code: [
        'var result = \'\';',
        'for (var i = 0; i < pieces.length; i++) {',
        '  result = result.concat(pieces[i]);',
        '}'
      ].join('\n')
    },
    {
      title: 'reduce',
      defer: 'n',
      code: [
        'var result = pieces.reduce(function (acc, piece) {',
        '  return acc + piece;',
        '}, \'\');'
      ].join('\n')
    },
    {
      title: 'template literal',
      defer: 'n',
      code: [
        'var result = \'\';',
        'for (var i = 0; i < pieces.length; i++) {',
        '  result = `${result}${pieces[i]}`;',
        '}'
      ].join('\n')
    }
  ]
};
