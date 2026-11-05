'use strict';

const Glue = require('@hapi/glue');
const Joi = require('joi');
const Manifest = require('./manifest');

const composeOptions = {
  relativeTo: __dirname
};

// the manifest can only hold plain data so view engines are named by module and required here
const resolveViewEngines = (manifest) => {
  const vision = manifest.register && manifest.register.plugins.find((entry) => entry.plugin === '@hapi/vision');

  if (vision) {
    for (const [ext, engine] of Object.entries(vision.options.engines)) {
      if (typeof engine === 'string') {
        vision.options.engines[ext] = require(engine);
      }
    }
  }

  return manifest;
};

module.exports = async () => {
  const server = await Glue.compose(resolveViewEngines(Manifest.get('/')), composeOptions);
  server.validator(Joi);
  return server;
};
