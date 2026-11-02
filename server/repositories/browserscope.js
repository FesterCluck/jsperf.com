exports.register = function (server, options, next) {
  server.expose('addTest', function () {
    return Promise.resolve();
  });

  return next();
};

exports.register.attributes = {
  name: 'repositories/browserscope'
};
