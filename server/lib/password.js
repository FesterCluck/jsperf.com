'use strict';

const Crypto = require('node:crypto');
const { promisify } = require('node:util');

const scrypt = promisify(Crypto.scrypt);

const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

// stored format: scrypt$<salt hex>$<key hex>
exports.hash = async (password) => {
  const salt = Crypto.randomBytes(SALT_LENGTH);
  const key = await scrypt(password, salt, KEY_LENGTH);
  return `scrypt$${salt.toString('hex')}$${key.toString('hex')}`;
};

exports.verify = async (password, stored) => {
  const [scheme, saltHex, keyHex] = String(stored).split('$');
  if (scheme !== 'scrypt' || !saltHex || !keyHex) {
    return false;
  }

  const expected = Buffer.from(keyHex, 'hex');
  if (expected.length === 0) {
    return false;
  }

  const actual = await scrypt(password, Buffer.from(saltHex, 'hex'), expected.length);
  return Crypto.timingSafeEqual(actual, expected);
};
