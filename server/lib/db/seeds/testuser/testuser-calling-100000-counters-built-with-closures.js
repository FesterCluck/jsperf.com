'use strict';

/* eslint no-template-curly-in-string: 0 */
module.exports = {
  slug: 'testuser-calling-100000-counters-built-with-closures',
  title: 'Calling 100000 counters built with closures',
  info: 'Measures 100000 increments on counters created through closures.',
  initHTML: '',
  setup: [
    'var n = 100000;',
    'function makeClosureCounter() {',
    '  var value = 0;',
    '  return {',
    '    inc: function () { value++; },',
    '    get: function () { return value; }',
    '  };',
    '}',
    'function ProtoCounter() {',
    '  this.value = 0;',
    '}',
    'ProtoCounter.prototype.inc = function () { this.value++; };',
    'ProtoCounter.prototype.get = function () { return this.value; };',
    'class ClassCounter {',
    '  constructor() { this.value = 0; }',
    '  inc() { this.value++; }',
    '  get() { return this.value; }',
    '}'
  ].join('\n'),
  teardown: '',
  test: [
    {
      title: 'closure counter',
      defer: 'n',
      code: [
        'var counter = makeClosureCounter();',
        'for (var i = 0; i < n; i++) {',
        '  counter.inc();',
        '}',
        'counter.get();'
      ].join('\n')
    },
    {
      title: 'prototype counter',
      defer: 'n',
      code: [
        'var counter = new ProtoCounter();',
        'for (var i = 0; i < n; i++) {',
        '  counter.inc();',
        '}',
        'counter.get();'
      ].join('\n')
    },
    {
      title: 'class counter',
      defer: 'n',
      code: [
        'var counter = new ClassCounter();',
        'for (var i = 0; i < n; i++) {',
        '  counter.inc();',
        '}',
        'counter.get();'
      ].join('\n')
    }
  ]
};
