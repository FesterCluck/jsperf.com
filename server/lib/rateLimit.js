'use strict';

// Fixed-window counter per key, kept in memory (per process). Callers check `blocked`, `hit` on each
// failure and `reset` on success.
module.exports = ({ max, windowMs, maxKeys = 10000 }) => {
  const entries = new Map();

  const live = (key) => {
    const entry = entries.get(key);
    if (entry && entry.resetAt > Date.now()) {
      return entry;
    }

    entries.delete(key);
    return null;
  };

  return {
    blocked: (key) => {
      const entry = live(key);
      return !!entry && entry.count >= max;
    },

    hit: (key) => {
      const entry = live(key);
      if (entry) {
        entry.count++;
        return;
      }

      if (entries.size >= maxKeys) {
        for (const k of entries.keys()) {
          live(k);
        }
      }

      entries.set(key, { count: 1, resetAt: Date.now() + windowMs });
    },

    reset: (key) => {
      entries.delete(key);
    }
  };
};
