'use strict';

/* eslint no-template-curly-in-string: 0 */
module.exports = {
  slug: 'testuser-invoking-a-function-100000-times-via-different',
  title: 'Invoking a function 100000 times via different call forms',
  info: 'Direct call, call, apply and bind compared over 100000 invocations.',
  initHTML: '',
  setup: [
    'var n = 100000;',
    'function add(a, b) {',
    '  return a + b;',
    '}',
    'var bound = add.bind(null, 1);',
    'var total;'
  ].join('\n'),
  teardown: '',
  test: [
    {
      title: 'direct call',
      defer: 'n',
      code: [
        'total = 0;',
        'for (var i = 0; i < n; i++) {',
        '  total += add(i, 1);',
        '}'
      ].join('\n')
    },
    {
      title: 'Function#call',
      defer: 'n',
      code: [
        'total = 0;',
        'for (var i = 0; i < n; i++) {',
        '  total += add.call(null, i, 1);',
        '}'
      ].join('\n')
    },
    {
      title: 'Function#apply',
      defer: 'n',
      code: [
        'total = 0;',
        'for (var i = 0; i < n; i++) {',
        '  total += add.apply(null, [i, 1]);',
        '}'
      ].join('\n')
    },
    {
      title: 'bound function',
      defer: 'n',
      code: [
        'total = 0;',
        'for (var i = 0; i < n; i++) {',
        '  total += bound(i);',
        '}'
      ].join('\n')
    },
    {
      title: 'arrow function',
      defer: 'n',
      code: [
        'var arrow = (a, b) => a + b;',
        'total = 0;',
        'for (var i = 0; i < n; i++) {',
        '  total += arrow(i, 1);',
        '}'
      ].join('\n')
    }
  ]
};
