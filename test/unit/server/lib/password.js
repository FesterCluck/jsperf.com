const Lab = require('@hapi/lab');
const Code = require('@hapi/code');
const password = require('../../../../server/lib/password');

const lab = exports.lab = Lab.script();

lab.experiment('password', () => {
  lab.test('hashes with a random salt', async () => {
    const a = await password.hash('correct horse');
    const b = await password.hash('correct horse');

    Code.expect(a).to.match(/^scrypt\$[0-9a-f]{32}\$[0-9a-f]{128}$/);
    Code.expect(a).to.not.equal(b);
  });

  lab.test('verifies the right password', async () => {
    const stored = await password.hash('correct horse');

    Code.expect(await password.verify('correct horse', stored)).to.be.true();
  });

  lab.test('rejects the wrong password', async () => {
    const stored = await password.hash('correct horse');

    Code.expect(await password.verify('battery staple', stored)).to.be.false();
  });

  lab.test('rejects malformed stored values', async () => {
    Code.expect(await password.verify('x', 'plaintext')).to.be.false();
    Code.expect(await password.verify('x', 'bcrypt$aa$bb')).to.be.false();
    Code.expect(await password.verify('x', undefined)).to.be.false();
    Code.expect(await password.verify('x', 'scrypt$aa')).to.be.false();
    Code.expect(await password.verify('x', 'scrypt$$bb')).to.be.false();
    Code.expect(await password.verify('x', 'scrypt$aa$zz')).to.be.false();
  });
});
