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
