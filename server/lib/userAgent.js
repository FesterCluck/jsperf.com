'use strict';

// scooter exposes a plain object; format it as e.g. "Chrome 142.0.0 / Linux 6.1.0"
const version = (item) => `${item.major}.${item.minor}.${item.patch}`;
const named = (item) => (/^[1-9]\d*$/.test(item.major) ? `${item.family} ${version(item)}` : item.family);

module.exports = (ua) => {
  if (!ua || !ua.family) {
    return 'Other';
  }

  const browser = ua.family === 'Other' ? ua.family : `${ua.family} ${version(ua)}`;
  const os = ua.os && ua.os.family && ua.os.family !== 'Other' ? ` / ${named(ua.os)}` : '';

  return browser + os;
};

// Chromium based browsers run V8; everything else (and every browser on iOS, which are all WebKit) gets the standard's rules
module.exports.engine = (header) => {
  const ua = String(header || '');
  return (/(?:Chrome|Chromium)\/\d/.test(ua) && !/\b(?:CriOS|FxiOS|EdgiOS|OPiOS)\b|iPhone|iPad|iPod/.test(ua)) ? 'v8' : 'spec';
};
