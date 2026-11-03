'use strict';

/* eslint no-template-curly-in-string: 0 */
module.exports = {
  slug: 'testuser-reading-a-4-level-deep-property-that-is-missin',
  title: 'Reading a 4 level deep property that is missing',
  info: 'Safe property access on a path 4 levels deep when the value is missing.',
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
    'var result;'
  ].join('\n'),
  teardown: '',
  test: [
    {
      title: 'optional chaining',
      defer: 'n',
      code: [
        'result = root?.p0?.p1?.p2?.p3;'
      ].join('\n')
    },
    {
      title: 'logical and chain',
      defer: 'n',
      code: [
        'result = root && root.p0 && root.p0.p1 && root.p0.p1.p2 && root.p0.p1.p2.p3;'
      ].join('\n')
    },
    {
      title: 'try catch',
      defer: 'n',
      code: [
        'try {',
        '  result = root.p0.p1.p2.p3;',
        '} catch (e) {',
        '  result = undefined;',
        '}'
      ].join('\n')
    },
    {
      title: 'reduce path',
      defer: 'n',
      code: [
        'var path = [\'p0\',\'p1\',\'p2\',\'p3\'];',
        'result = path.reduce(function (acc, key) {',
        '  return acc == null ? undefined : acc[key];',
        '}, root);'
      ].join('\n')
    }
  ]
};
