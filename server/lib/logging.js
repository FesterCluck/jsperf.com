'use strict';

const Https = require('node:https');
const Pino = require('pino');
const HapiPino = require('hapi-pino');

const FLUSH_THRESHOLD = 20;
const MAX_DELAY = 15000;

// Minimal Loggly bulk shipper: batches newline-delimited JSON, flushes by size or age
exports.logglyStream = ({ token, subdomain, hostname }) => {
  let buffer = [];
  let timer = null;

  const flush = () => {
    clearTimeout(timer);
    timer = null;
    if (buffer.length === 0) {
      return;
    }

    const body = buffer.join('');
    buffer = [];

    const req = Https.request({
      method: 'POST',
      hostname: 'logs-01.loggly.com',
      path: `/bulk/${token}/tag/${subdomain || 'jsperf'},${hostname || 'jsperf'}`,
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    });
    req.on('error', () => {}); // never let log shipping take the process down
    req.end(body);
  };

  return {
    write: (line) => {
      buffer.push(line);
      if (buffer.length >= FLUSH_THRESHOLD) {
        flush();
      } else if (!timer) {
        timer = setTimeout(flush, MAX_DELAY);
        timer.unref();
      }
    },
    flush
  };
};

exports.plugin = {
  name: 'logging',
  register: async (server, options) => {
    const pinoOptions = {
      level: options.level || 'info',
      redact: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]']
    };

    const loggly = options.loggly || {};
    let shipper;
    if (loggly.token) {
      shipper = exports.logglyStream(loggly);
      pinoOptions.stream = Pino.multistream([
        { stream: process.stdout },
        { stream: shipper }
      ]);
    } else if (options.pretty) {
      pinoOptions.transport = { target: 'pino-pretty' };
    }

    await server.register({ plugin: HapiPino, options: pinoOptions });

    if (shipper) {
      server.ext('onPostStop', () => shipper.flush());
    }
  }
};
