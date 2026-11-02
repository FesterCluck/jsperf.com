'use strict';

/* eslint no-template-curly-in-string: 0 */
module.exports = {
  slug: 'testuser-testing-for-fox-in-a-5000-character-string',
  title: 'Testing for "fox" in a 5000 character string',
  info: 'Substring detection for the needle "fox" in text of 5000 characters.',
  initHTML: '',
  setup: [
    'var sentence = \'the quick brown fox jumps over the lazy dog \';',
    'var text = sentence.repeat(Math.ceil(5000 / sentence.length)).slice(0, 5000);',
    'var needle = \'fox\';',
    'var pattern = new RegExp(needle);',
    'var result;'
  ].join('\n'),
  teardown: '',
  test: [
    {
      title: 'indexOf',
      defer: 'n',
      code: [
        'result = text.indexOf(needle) > -1;'
      ].join('\n')
    },
    {
      title: 'includes',
      defer: 'n',
      code: [
        'result = text.includes(needle);'
      ].join('\n')
    },
    {
      title: 'RegExp#test',
      defer: 'n',
      code: [
        'result = pattern.test(text);'
      ].join('\n')
    },
    {
      title: 'String#match',
      defer: 'n',
      code: [
        'result = text.match(pattern) !== null;'
      ].join('\n')
    },
    {
      title: 'String#search',
      defer: 'n',
      code: [
        'result = text.search(pattern) !== -1;'
      ].join('\n')
    }
  ]
};
