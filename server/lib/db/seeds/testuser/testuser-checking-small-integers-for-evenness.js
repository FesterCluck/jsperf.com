'use strict';

/* eslint no-template-curly-in-string: 0 */
module.exports = {
  slug: 'testuser-checking-small-integers-for-evenness',
  title: 'Checking small integers for evenness',
  info: 'Predicates that test small integers for evenness.',
  initHTML: '',
  setup: [
    'var limit = 100;',
    'var hits;'
  ].join('\n'),
  teardown: '',
  test: [
    {
      title: 'modulo',
      defer: 'n',
      code: [
        'hits = 0;',
        'for (var i = 0; i < limit; i++) {',
        '  if (i % 2 === 0) {',
        '    hits++;',
        '  }',
        '}'
      ].join('\n')
    },
    {
      title: 'bitwise or negation',
      defer: 'n',
      code: [
        'hits = 0;',
        'for (var i = 0; i < limit; i++) {',
        '  if ((i & 1) === 0) {',
        '    hits++;',
        '  }',
        '}'
      ].join('\n')
    },
    {
      title: 'logical not',
      defer: 'n',
      code: [
        'hits = 0;',
        'for (var i = 0; i < limit; i++) {',
        '  if (!(i % 2)) {',
        '    hits++;',
        '  }',
        '}'
      ].join('\n')
    },
    {
      title: 'division',
      defer: 'n',
      code: [
        'hits = 0;',
        'for (var i = 0; i < limit; i++) {',
        '  if (i / 2 === Math.floor(i / 2)) {',
        '    hits++;',
        '  }',
        '}'
      ].join('\n')
    }
  ]
};
