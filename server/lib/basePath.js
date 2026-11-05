'use strict';

// Normalizes a URL path prefix: '' (no prefix), or '/segment[/segment]' with no trailing slash.
exports.normalize = (value) => {
  const segments = String(value || '').split('/').map((s) => s.trim()).filter(Boolean);
  return segments.length ? `/${segments.join('/')}` : '';
};

// Prefixes an absolute app path (e.g. '/browse') with the prefix the server was composed with.
exports.url = (request, path) => `${request.server.settings.app.basePath || ''}${path}`;

// The request path with the prefix removed and without the leading slash, e.g. '/next/foo/2' -> 'foo/2'.
exports.slug = (request) => request.path.slice((request.server.settings.app.basePath || '').length + 1);
