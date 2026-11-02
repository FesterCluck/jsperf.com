'use strict';

/* eslint no-template-curly-in-string: 0 */
module.exports = {
  slug: 'testuser-normalising-16-character-strings',
  title: 'Normalising 16 character strings',
  info: 'Case conversion and trimming of strings that are 16 characters long.',
  initHTML: '',
  setup: [
    'var len = 16;',
    'var raw = \'  \' + \'MiXeD CaSe \'.repeat(Math.ceil(len / 11)).slice(0, len) + \'  \';',
    'var out;'
  ].join('\n'),
  teardown: '',
  test: [
    {
      title: 'toLowerCase',
      defer: 'n',
      code: [
        'out = raw.toLowerCase();'
      ].join('\n')
    },
    {
      title: 'toUpperCase',
      defer: 'n',
      code: [
        'out = raw.toUpperCase();'
      ].join('\n')
    },
    {
      title: 'trim',
      defer: 'n',
      code: [
        'out = raw.trim();'
      ].join('\n')
    },
    {
      title: 'trim then lower',
      defer: 'n',
      code: [
        'out = raw.trim().toLowerCase();'
      ].join('\n')
    },
    {
      title: 'replace with regex',
      defer: 'n',
      code: [
        'out = raw.replace(/^\\s+|\\s+$/g, \'\');'
      ].join('\n')
    }
  ]
};
