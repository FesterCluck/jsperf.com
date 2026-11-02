'use strict';

const Lab = require('@hapi/lab');
const { expect } = require('@hapi/code');
const userAgent = require('../../../../server/lib/userAgent');

const lab = exports.lab = Lab.script();
const { describe, it } = lab;

describe('lib/userAgent', () => {
  it('formats browser and operating system with versions', () => {
    const ua = {
      family: 'Chrome',
      major: '142',
      minor: '0',
      patch: '1',
      os: { family: 'Linux', major: '6', minor: '1', patch: '0' }
    };

    expect(userAgent(ua)).to.equal('Chrome 142.0.1 / Linux 6.1.0');
  });

  it('omits an operating system version that is unknown', () => {
    const ua = { family: 'Chrome', major: '142', minor: '0', patch: '1', os: { family: 'Linux x86_64', major: '0', minor: '0', patch: '0' } };

    expect(userAgent(ua)).to.equal('Chrome 142.0.1 / Linux x86_64');
  });

  it('omits an unknown operating system', () => {
    const ua = { family: 'Firefox', major: '1', minor: '2', patch: '3', os: { family: 'Other', major: '0', minor: '0', patch: '0' } };

    expect(userAgent(ua)).to.equal('Firefox 1.2.3');
  });

  it('omits a missing operating system', () => {
    expect(userAgent({ family: 'Safari', major: '17', minor: '0', patch: '0' })).to.equal('Safari 17.0.0');
  });

  it('omits an operating system without a family', () => {
    expect(userAgent({ family: 'Safari', major: '17', minor: '0', patch: '0', os: {} })).to.equal('Safari 17.0.0');
  });

  it('does not print versions for an unknown browser', () => {
    const ua = { family: 'Other', major: '0', minor: '0', patch: '0', os: { family: 'Other' } };

    expect(userAgent(ua)).to.equal('Other');
  });

  it('falls back to Other when there is no user agent', () => {
    expect(userAgent(undefined)).to.equal('Other');
    expect(userAgent({})).to.equal('Other');
  });
});
