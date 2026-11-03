'use strict';

/* eslint no-template-curly-in-string: 0 */
module.exports = {
  slug: 'testuser-dispatching-100-events-to-5-listeners',
  title: 'Dispatching 100 events to 5 listeners',
  info: 'Emitting 100 events to 5 registered handlers.',
  initHTML: '',
  setup: [
    'var n = 100;',
    'var listenerCount = 5;',
    'var handlers = [];',
    'var seen = 0;',
    'for (var i = 0; i < listenerCount; i++) {',
    '  handlers.push(function (payload) { seen += payload; });',
    '}',
    'var target = new EventTarget();',
    'handlers.forEach(function (h) {',
    '  target.addEventListener(\'tick\', function (event) { h(event.detail); });',
    '});'
  ].join('\n'),
  teardown: '',
  test: [
    {
      title: 'array of callbacks',
      defer: 'n',
      code: [
        'for (var i = 0; i < n; i++) {',
        '  for (var j = 0; j < handlers.length; j++) {',
        '    handlers[j](1);',
        '  }',
        '}'
      ].join('\n')
    },
    {
      title: 'forEach callbacks',
      defer: 'n',
      code: [
        'for (var i = 0; i < n; i++) {',
        '  handlers.forEach(function (h) { h(1); });',
        '}'
      ].join('\n')
    },
    {
      title: 'EventTarget',
      defer: 'n',
      code: [
        'for (var i = 0; i < n; i++) {',
        '  target.dispatchEvent(new CustomEvent(\'tick\', { detail: 1 }));',
        '}'
      ].join('\n')
    }
  ]
};
