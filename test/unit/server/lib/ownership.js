const Lab = require('@hapi/lab');
const Code = require('@hapi/code');
const ownership = require('../../../../server/lib/ownership');

const lab = exports.lab = Lab.script();

const requestFor = (credentials) => ({
  auth: { isAuthenticated: !!credentials, credentials }
});

lab.experiment('ownership', () => {
  lab.test('the creating account owns the page', () => {
    Code.expect(ownership.isOwner(requestFor({ id: 3 }), { userID: 3 })).to.be.true();
  });

  lab.test('other accounts do not', () => {
    Code.expect(ownership.isOwner(requestFor({ id: 4 }), { userID: 3 })).to.be.false();
  });

  lab.test('anonymous visitors do not', () => {
    Code.expect(ownership.isOwner(requestFor(null), { userID: 3 })).to.be.false();
  });

  lab.test('pages without an owner belong to nobody, even to a session without an id', () => {
    Code.expect(ownership.isOwner(requestFor({ id: undefined }), { userID: null })).to.be.false();
    Code.expect(ownership.isOwner(requestFor({ id: undefined }), {})).to.be.false();
  });
});
