# jsperf.com [![CI](https://github.com/FesterCluck/jsperf.com/actions/workflows/ci.yml/badge.svg)](https://github.com/FesterCluck/jsperf.com/actions/workflows/ci.yml)

## How to run a local copy of jsPerf

### Prerequisites

1. [Node.js](https://nodejs.org/en/) (Node.js 22 or newer; see preferred version in [`.nvmrc`](https://github.com/FesterCluck/jsperf.com/blob/master/.nvmrc))
2. [MySQL](https://dev.mysql.com/downloads/mysql/) 8.0 or newer (8.x and 9.x are supported; the default `caching_sha2_password` authentication works)
  1. Install
    1. macOS: `brew install mysql`
    2. Debian/Ubuntu: `sudo apt install mysql-server`
    3. Docker: `docker run -d -p 3306:3306 -e MYSQL_ALLOW_EMPTY_PASSWORD=yes mysql:8`
  2. Initialize (database, user and grants are separate statements in MySQL 8+):
     ```
     mysql -uroot -e "CREATE DATABASE jsperf CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; CREATE USER 'jsuser'@'%' IDENTIFIED BY 'jspass'; GRANT ALL ON jsperf.* TO 'jsuser'@'%';"
     ```
  3. Tables are created automatically by migrations when the server starts.

### Setup

1. Install dependencies: `npm install`
2. Create a `.env` file (will be ignored by git) with the following variables (`VAR_NAME=value`):

```
NODE_ENV=development
# from Prerequisites step 2.2
MYSQL_USER=jsuser
MYSQL_PASSWORD=jspass
MYSQL_DATABASE=jsperf

COOKIE_PASS=password-should-be-32-characters

# customizable but not recommended for local development
# SCHEME=http
# DOMAIN=localhost
# PORT=3000
# bind address, e.g. 127.0.0.1 to only listen locally behind a reverse proxy (default: all interfaces)
# HOST=127.0.0.1
# serve the whole app under a URL path prefix, e.g. /next (default: empty = served at the root)
# BASE_PATH=/next
# name of the session cookie (default: sid-jsperf); change it if another app shares the domain
# COOKIE_NAME=sid-jsperf
# MYSQL_HOST=localhost
# MYSQL_PORT=3306
# MYSQL_CONNECTION_LIMIT=10
# LOGGLY_TOKEN=
# LOGGLY_SUBDOMAIN=
# REDIS_HOST=
# REDIS_PORT=
# REDIS_PASSWORD=
```

### Running under a path prefix (e.g. behind nginx)

Set `BASE_PATH=/next` and the app mounts every route (pages, `/public` assets, `/health`, feeds, sitemap) under
that prefix and prefixes all generated links, redirects and feed/sitemap URLs. The session, flash and CSRF
cookies are scoped to `Path=/next`; set `COOKIE_NAME` to something unique if other apps share the domain.
nginx must pass the full path through **without stripping** the prefix:

```nginx
location /next/ { proxy_pass http://127.0.0.1:3199; }   # no URI part on proxy_pass => path is passed unchanged
```

Run the app with `HOST=127.0.0.1 PORT=3199 BASE_PATH=/next DOMAIN=example.com SCHEME=https`.

### Start

- [x] correct version of `node`
- [x] `mysql` running
- [x] `.env` created with your values

```
npm start
```

Hopefully everything smoothly started up and you're ready to start [contributing](CONTRIBUTING.md). If not, check out the [wiki](https://github.com/FesterCluck/jsperf.com/wiki/Local-Development-Debugging) for debugging tips.

## Big-O complexity estimates

Every test on a test page shows a row with a static **estimate** of its time complexity (O(1), O(log n), O(n), O(n log n), O(n²), O(n³), worse, or "unknown"), one graph per top-level call of the test plus an "Overall" total. It is shown before the test is run and is never measured.

- `server/lib/complexity.js` parses the test code with [acorn](https://github.com/acornjs/acorn) (the code is never executed), resolves the calls to function definitions in the test, the page's setup/teardown and its `<script>` blocks, and combines loop nesting, halving/doubling loops, known built-ins (`sort`, `indexOf`, `Math.*`, ...), recursion and calls between functions. The overall class is the maximum over the test's code. The heuristics and their limits are documented at the top of that file. Loop bounds that are provably constant (number literals, constants, `.length` of array literals, `Math.min(x, 24)` caps) count as O(1).
- Anything the analyzer cannot decide (syntax errors, unknown library calls, calling a function parameter, mutual recursion, too much code or time) is reported as "unknown".
- The result is stored as JSON in the `tests.complexity` column (migration `20261104_add_complexity_to_tests.js`), computed when a page is created, edited or forked. Rows saved earlier have `NULL` there and are analyzed and stored the first time their page is viewed.

## Sources of the built-in complexity data

- [V8](https://github.com/v8/v8)
- [Chromium (Blink)](https://github.com/chromium/chromium)
- [ECMAScript specification](https://tc39.es/ecma262/)
