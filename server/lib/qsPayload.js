'use strict';

const Qs = require('qs');

// hapi-qs also parsed urlencoded form payloads with qs (e.g. `test[0][title]=x` -> { test: [{ title: 'x' }] }).
// hapi's own payload parser only does flat key/values so re-parse nested keys after the payload is read.
exports.plugin = {
  name: 'qsPayload',
  register: (server) => {
    server.ext('onPostAuth', (request, h) => {
      if (request.mime === 'application/x-www-form-urlencoded') {
        request.payload = Qs.parse(request.payload, { arrayLimit: 100 });
      } else if (request.method === 'post' && request.payload === null) {
        // an empty body leaves the payload null, which handlers would otherwise have to guard against
        request.payload = {};
      }

      return h.continue;
    });
  }
};
