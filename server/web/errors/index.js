'use strict';

const handledCodes = {
  404: 'Not found',
  403: 'Forbidden',
  400: 'Bad Request'
};

exports.plugin = {
  name: 'web/errors',
  register: (server) => {
    server.ext('onPreResponse', (request, h) => {
      if (!request.response.isBoom) {
        return h.continue;
      }

      const statusCode = request.response.output.statusCode;

      if (handledCodes[statusCode]) {
        return h.view(`errors/${statusCode}`).code(statusCode);
      }

      server.log(['debug'], request.response);
      return h.view('errors/general').code(500);
    });
  }
};
