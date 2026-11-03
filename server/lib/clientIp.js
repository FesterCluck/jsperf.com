'use strict';

// X-Forwarded-For is attacker-controlled unless a trusted proxy appends to it, so it is only read when
// TRUST_PROXY is set; the rightmost entry is the one that proxy added.
module.exports = (request) => {
  const forwarded = request.server.settings.app.trustProxy && request.headers['x-forwarded-for'];
  if (forwarded) {
    const hops = forwarded.split(',');
    return hops[hops.length - 1].trim();
  }

  return request.info.remoteAddress;
};
