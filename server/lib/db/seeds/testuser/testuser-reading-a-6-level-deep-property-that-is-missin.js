'use strict';

/* eslint no-template-curly-in-string: 0 */
module.exports = {
  slug: 'testuser-reading-a-6-level-deep-property-that-is-missin',
  title: 'Reading a 6 level deep property that is missing',
  info: 'Safe property access on a path 6 levels deep when the value is missing.',
  initHTML: '',
  setup: [
    'var root = {};',
    'var node = root;',
    'node.p0 = {};',
    'node = node.p0;',
    'node.p1 = {};',
    'node = node.p1;',
    'node.p2 = {};',
    'node = node.p2;',
    'node.p3 = {};',
    'node = node.p3;',
    'node.p4 = {};',
    'node = node.p4;',
    'var result;'
  ].join('\n'),
  teardown: '',
  test: [
    {
      title: 'optional chaining',
      defer: 'n',
      code: [
        'result = root?.p0?.p1?.p2?.p3?.p4?.p5;'
      ].join('\n')
    },
    {
      title: 'logical and chain',
      defer: 'n',
      code: [
        'result = root && root.p0 && root.p0.p1 && root.p0.p1.p2 && root.p0.p1.p2.p3 && root.p0.p1.p2.p3.p4 && root.p0.p1.p2.p3.p4.p5;'
      ].join('\n')
    },
    {
      title: 'try catch',
      defer: 'n',
      code: [
        'try {',
        '  result = root.p0.p1.p2.p3.p4.p5;',
        '} catch (e) {',
        '  result = undefined;',
        '}'
      ].join('\n')
    },
    {
      title: 'reduce path',
      defer: 'n',
      code: [
        'var path = [\'p0\',\'p1\',\'p2\',\'p3\',\'p4\',\'p5\'];',
        'result = path.reduce(function (acc, key) {',
        '  return acc == null ? undefined : acc[key];',
        '}, root);'
      ].join('\n')
    }
  ]
};
