# Contributing to jsPerf

Submit a pull request to `master` with passing tests (`npm test`) and properly [styled](https://github.com/Flet/semistandard) code. [Rebase](https://git-scm.com/docs/git-rebase) as needed.

During development it may be helpful to automatically restart the server when you make changes.

```
npm run watch
```

## Building the client

If you make any changes inside [`client/`](https://github.com/FesterCluck/jsperf.com/tree/master/client), then you'll need to manually re-build the final asset.

```
npm run build
```

## Testing

We use [lab](https://github.com/hapijs/lab) as our test utility and [code](https://github.com/hapijs/code) as our assertion library. Linting uses [eslint](http://eslint.org/) (`npm run lint`) using [neostandard](https://github.com/neostandard/neostandard) with semicolons. 100% code coverage by unit tests is required. To run the test suite:

```
npm test
```

_If you want to only lint and save a little time, use `npm run lint` which skips the tests._

_If you are missing code coverage, open `coverage.html` in the root of the project for a detailed visual report._

### End-to-end (e2e)

End-to-end testing uses [Playwright](https://playwright.dev) with headless Chromium. Install the browser once, then run the specs:

```
npm run test-e2e:install
npm run test-e2e
```

The runner starts `node server.js` itself (port `E2E_PORT`, default 3100). The server needs a reachable MySQL (it runs migrations on startup) with `MYSQL_USER`, `MYSQL_PASSWORD` and `MYSQL_DATABASE` set (a `.env` file works); Redis is only needed in production. To test an already running server, set `E2E_BASE_URL`. The "create page" spec registers a unique throwaway local user through `/register` (no credentials or extra env vars needed), so it leaves one test user and one test page in the database; use a scratch database.

### Known Globals

Lab detects global variable leaks. Sometimes downstream dependencies make this unavoidable so we ignore specific variables in the `lab` command for `npm test` (`package.json#scripts.test`). Here are the known globals with explanations:

- `__core-js_shared__` stems from `core-js`?
- `__grim__` stems from `grim`, a dependency of `marky-markdown` (`npm ls grim`)

## Adding new dependencies

Install using `npm` and either `--save` or `--save-dev`. **Do not edit `package.json` manually.**
