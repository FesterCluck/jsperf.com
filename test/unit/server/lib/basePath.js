const Lab = require('@hapi/lab');
const Code = require('@hapi/code');
const basePath = require('../../../../server/lib/basePath');

const lab = exports.lab = Lab.script();

const req = (path, app = {}) => ({ path, server: { settings: { app } } });

lab.experiment('basePath', () => {
  lab.test('normalizes slashes and whitespace', () => {
    Code.expect(basePath.normalize(undefined)).to.equal('');
    Code.expect(basePath.normalize('')).to.equal('');
    Code.expect(basePath.normalize('/')).to.equal('');
    Code.expect(basePath.normalize('next')).to.equal('/next');
    Code.expect(basePath.normalize('/next/')).to.equal('/next');
    Code.expect(basePath.normalize('//a//b/')).to.equal('/a/b');
  });

  lab.test('prefixes absolute paths', () => {
    Code.expect(basePath.url(req('/'), '/browse')).to.equal('/browse');
    Code.expect(basePath.url(req('/', { basePath: '/next' }), '/browse')).to.equal('/next/browse');
    Code.expect(basePath.url(req('/', { basePath: '/next' }), '/')).to.equal('/next/');
  });

  lab.test('strips the prefix to get the slug', () => {
    Code.expect(basePath.slug(req('/foo/2'))).to.equal('foo/2');
    Code.expect(basePath.slug(req('/next/foo/2', { basePath: '/next' }))).to.equal('foo/2');
  });
});
