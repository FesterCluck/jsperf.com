require('dotenv').config({ quiet: true });
const Joi = require('joi');
const basePath = require('./server/lib/basePath');

const prodOptional = {
  is: 'production',
  then: Joi.string().required(),
  otherwise: Joi.string().optional()
};

const envSchema = Joi.object({
  SCHEME: Joi.string().valid('http', 'https').optional().default('http'),
  NODE_ENV: Joi.string().optional().default('development'),
  PORT: Joi.number().optional().default(3000),
  HOST: Joi.string().optional(),
  TRUST_PROXY: Joi.boolean().optional().default(false),
  BASE_PATH: Joi.string().allow('').optional().default(''),
  COOKIE_NAME: Joi.string().optional().default('sid-jsperf'),
  DOMAIN: Joi.string().optional().default('localhost'),
  COOKIE_PASS: Joi.string().min(32).required(),
  MYSQL_HOST: Joi.string().optional().default('localhost'),
  MYSQL_PORT: Joi.number().optional().default(3306),
  MYSQL_USER: Joi.string().required(),
  MYSQL_PASSWORD: Joi.string().required(),
  MYSQL_DATABASE: Joi.string().required(),
  MYSQL_CONNECTION_LIMIT: Joi.number().integer().min(1).optional().default(10),
  LOGGLY_TOKEN: Joi.string().optional(),
  LOGGLY_SUBDOMAIN: Joi.string().optional(),
  REDIS_HOST: Joi.string().when('NODE_ENV', prodOptional),
  REDIS_PORT: Joi.number().when('NODE_ENV', {
    is: 'production',
    then: Joi.number().required(),
    otherwise: Joi.number().optional()
  }),
  REDIS_PASSWORD: Joi.string().when('NODE_ENV', prodOptional)
}).unknown(true); // allow other keys in process.env not defined here

const result = envSchema.validate(process.env);

if (result.error) {
  const detail = result.error.details[0];
  throw new Error(`${detail.path[0]} environment variable is ${detail.type === 'any.required' ? 'missing' : 'invalid'}`);
}

const Confidence = require('confidence');

const criteria = {
  scheme: result.value.SCHEME
};

const config = {
  $meta: 'jsPerf.com',
  env: result.value.NODE_ENV,
  port: result.value.PORT,
  host: result.value.HOST,
  trustProxy: result.value.TRUST_PROXY,
  basePath: basePath.normalize(result.value.BASE_PATH),
  domain: result.value.DOMAIN,
  scheme: result.value.SCHEME,
  auth: {
    session: {
      pass: result.value.COOKIE_PASS,
      name: result.value.COOKIE_NAME,
      secure: {
        $filter: 'scheme',
        https: true,
        $default: false
      }
    }
  },
  mysql: {
    host: result.value.MYSQL_HOST,
    port: result.value.MYSQL_PORT,
    user: result.value.MYSQL_USER,
    pass: result.value.MYSQL_PASSWORD,
    db: result.value.MYSQL_DATABASE,
    connectionLimit: result.value.MYSQL_CONNECTION_LIMIT
  },
  loggly: {
    token: result.value.LOGGLY_TOKEN,
    subdomain: result.value.LOGGLY_SUBDOMAIN
  },
  cache: {
    host: result.value.REDIS_HOST,
    port: result.value.REDIS_PORT,
    password: result.value.REDIS_PASSWORD
  }
};

const store = new Confidence.Store(config);

exports.get = (key, overrides) => {
  return store.get(key, Object.assign({}, criteria, overrides));
};

exports.meta = (key) => {
  return store.meta(key, criteria);
};
