'use strict';

/* eslint no-template-curly-in-string: 0 */
module.exports = {
  slug: 'testuser-checking-small-integers-for-divisibility-by-th',
  title: 'Checking small integers for divisibility by three',
  info: 'Predicates that test small integers for divisibility by three.',
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
        '  if (i % 3 === 0) {',
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
        '  if (!(i % 3)) {',
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
        '  if (i / 3 === Math.floor(i / 3)) {',
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
        '  if (Number.isInteger(i / 3)) {',
        '    hits++;',
        '  }',
        '}'
      ].join('\n')
    }
  ]
};
