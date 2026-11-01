# jsperf.com [![CI](https://github.com/jsperf/jsperf.com/actions/workflows/ci.yml/badge.svg)](https://github.com/jsperf/jsperf.com/actions/workflows/ci.yml)

## How to run a local copy of jsPerf

### Prerequisites

1. [Node.js](https://nodejs.org/en/) (Node.js 22 or newer; see preferred version in [`.nvmrc`](https://github.com/jsperf/jsperf.com/blob/master/.nvmrc))
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
# MYSQL_HOST=localhost
# MYSQL_PORT=3306
# MYSQL_CONNECTION_LIMIT=10
# LOGGLY_TOKEN=
# LOGGLY_SUBDOMAIN=
# REDIS_HOST=
# REDIS_PORT=
# REDIS_PASSWORD=
```

### Start

- [x] correct version of `node`
- [x] `mysql` running
- [x] `.env` created with your values

```
npm start
```

Hopefully everything smoothly started up and you're ready to start [contributing](CONTRIBUTING.md). If not, check out the [wiki](https://github.com/jsperf/jsperf.com/wiki/Local-Development-Debugging) for debugging tips.
