const Joi = require('joi');
const regex = require('./regex');
const defaults = require('./defaults');

const mediumText = Joi.string().allow('').max(defaults.mediumTextLength);
const author = Joi.string().min(1);
const authorEmail = Joi.string().email();
const authorURL = Joi.string().allow('').pattern(new RegExp(regex.url, 'i'), 'url');
const authorGitHub = Joi.string().allow('').max(39).pattern(new RegExp(regex.github, 'i'));

exports.mediumText = mediumText;

exports.testPage = Joi.object({
  author: author.allow(''),
  authorEmail: authorEmail.allow(''),
  authorURL,
  authorGitHub,
  title: Joi.string().required().trim().min(1).max(255),
  slug: Joi.string().required().trim().min(1).max(55).pattern(new RegExp(regex.slug), 'slug'),
  visible: Joi.string().default('n').valid('y', 'n'),
  info: mediumText,
  initHTML: mediumText,
  setup: mediumText,
  teardown: mediumText,
  test: Joi.array().required().min(2).max(defaults.maxTests).items(Joi.object({
    title: Joi.string().trim().allow('').empty('').default(defaults.deleteMe).max(255),
    code: Joi.string().trim().allow('').empty('').default(defaults.deleteMe).max(defaults.mediumTextLength),
    defer: Joi.string().default('n').valid('y', 'n'),
    testID: Joi.number().integer().optional() // only present when editing
  }).required())
});

exports.comment = Joi.object({
  author: author.required(),
  authorEmail: authorEmail.required(),
  authorURL: authorURL.required(),
  authorGitHub,
  message: Joi.string().min(1).max(defaults.mediumTextLength)
});

const username = Joi.string().trim().pattern(new RegExp(regex.github, 'i'), 'username');

exports.register = Joi.object({
  username: username.required(),
  password: Joi.string().min(8).max(128).required()
});

exports.login = Joi.object({
  username: Joi.string().trim().required(),
  password: Joi.string().max(128).required()
});
