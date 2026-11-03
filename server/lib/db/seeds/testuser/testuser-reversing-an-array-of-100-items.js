'use strict';

/* eslint no-template-curly-in-string: 0 */
module.exports = {
  slug: 'testuser-reversing-an-array-of-100-items',
  title: 'Reversing an array of 100 items',
  info: 'Reversing 100 elements in place and into a new array.',
  initHTML: '',
  setup: [
    'var n = 100;',
    'var base = [];',
    'for (var i = 0; i < n; i++) {',
    '  base.push(i);',
    '}',
    'var work;'
  ].join('\n'),
  teardown: '',
  test: [
    {
      title: 'Array#reverse',
      defer: 'n',
      code: [
        'work = base.slice();',
        'work.reverse();'
      ].join('\n')
    },
    {
      title: 'swap loop',
      defer: 'n',
      code: [
        'work = base.slice();',
        'for (var lo = 0, hi = work.length - 1; lo < hi; lo++, hi--) {',
        '  var tmp = work[lo];',
        '  work[lo] = work[hi];',
        '  work[hi] = tmp;',
        '}'
      ].join('\n')
    },
    {
      title: 'reverse fill',
      defer: 'n',
      code: [
        'work = new Array(base.length);',
        'for (var i = 0, j = base.length - 1; j >= 0; i++, j--) {',
        '  work[i] = base[j];',
        '}'
      ].join('\n')
    },
    {
      title: 'reduceRight',
      defer: 'n',
      code: [
        'work = base.reduceRight(function (acc, value) {',
        '  acc.push(value);',
        '  return acc;',
        '}, []);'
      ].join('\n')
    },
    {
      title: 'unshift loop',
      defer: 'n',
      code: [
        'work = [];',
        'for (var i = 0; i < base.length; i++) {',
        '  work.unshift(base[i]);',
        '}'
      ].join('\n')
    }
  ]
};
