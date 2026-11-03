'use strict';

/* eslint no-template-curly-in-string: 0 */
module.exports = {
  slug: 'testuser-padding-numbers-to-2-digits',
  title: 'Padding numbers to 2 digits',
  info: 'Left padding integers with zeros up to a width of 2.',
  initHTML: '',
  setup: [
    'var width = 2;',
    'var value = 42;',
    'var out;'
  ].join('\n'),
  teardown: '',
  test: [
    {
      title: 'padStart',
      defer: 'n',
      code: [
        'out = String(value).padStart(width, \'0\');'
      ].join('\n')
    },
    {
      title: 'repeat and slice',
      defer: 'n',
      code: [
        'out = (\'0\'.repeat(width) + value).slice(-width);'
      ].join('\n')
    },
    {
      title: 'while loop',
      defer: 'n',
      code: [
        'out = String(value);',
        'while (out.length < width) {',
        '  out = \'0\' + out;',
        '}'
      ].join('\n')
    },
    {
      title: 'array join',
      defer: 'n',
      code: [
        'var text = String(value);',
        'out = new Array(Math.max(0, width - text.length) + 1).join(\'0\') + text;'
      ].join('\n')
    },
    {
      title: 'toLocaleString',
      defer: 'n',
      code: [
        'out = value.toLocaleString(\'en-US\', { minimumIntegerDigits: width, useGrouping: false });'
      ].join('\n')
    }
  ]
};
