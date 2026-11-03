const Lab = require('@hapi/lab');
const Code = require('@hapi/code');
const rateLimit = require('../../../../server/lib/rateLimit');

const lab = exports.lab = Lab.script();

lab.experiment('rateLimit', () => {
  lab.test('blocks a key after max hits', () => {
    const limiter = rateLimit({ max: 2, windowMs: 1000 });

    limiter.hit('a');
    Code.expect(limiter.blocked('a')).to.be.false();
    limiter.hit('a');
    Code.expect(limiter.blocked('a')).to.be.true();
    Code.expect(limiter.blocked('b')).to.be.false();
  });

  lab.test('reset clears a key', () => {
    const limiter = rateLimit({ max: 1, windowMs: 1000 });

    limiter.hit('a');
    limiter.reset('a');
    Code.expect(limiter.blocked('a')).to.be.false();
  });

  lab.test('the window expires', async () => {
    const limiter = rateLimit({ max: 1, windowMs: 5 });

    limiter.hit('a');
    Code.expect(limiter.blocked('a')).to.be.true();
    await new Promise((resolve) => setTimeout(resolve, 15));
    Code.expect(limiter.blocked('a')).to.be.false();
  });

  lab.test('sweeps expired keys when full', async () => {
    const limiter = rateLimit({ max: 1, windowMs: 5, maxKeys: 2 });

    limiter.hit('a');
    limiter.hit('b');
    await new Promise((resolve) => setTimeout(resolve, 15));
    limiter.hit('c');
    Code.expect(limiter.blocked('a')).to.be.false();
    Code.expect(limiter.blocked('c')).to.be.true();
  });
});
