/* global Benchmark _ */
/*!
 * runner.js
 * Runs inside the sandboxed test frame (see server/web/test/frame.hbs), next to the user's preparation
 * code and the Benchmark.js suite, and reports plain-data snapshots to the page that embeds it (ui.js).
 *
 * Based on ui.js by Mathias Bynens <https://mths.be/> and John-David Dalton <http://allyoucanleet.com/>
 * Available under MIT license <https://mths.be/mit>
 */
(function (window, document) {
  /** Namespace; user code can reach the benchmarks through `ui.benchmarks` */
  const ui = new Benchmark.Suite();

  /** The options object for Benchmark.Suite#run */
  const runOptions = {
    'async': true,
    'queued': true
  };

  /** Set once the frame has loaded and the embedding page may start commands */
  let ready = false;

  /** The ranking of the last completed run */
  let ranks = null;

  /** The benchmark that is currently reporting progress */
  let active = -1;

  const finite = (value) => (isFinite(value) ? Number(value) : 0);

  const isFunction = (value) => typeof value === 'function';

  const indexesOf = (benches) => _.map(benches, (bench) => _.indexOf(ui.benchmarks, bench));

  // the preparation code can write into `#extra-N` (shown next to the test title); only its text is reported
  const extraText = (index) => {
    const el = document.getElementById(`extra-${index + 1}`);
    return el ? String(el.textContent).slice(0, 200) : '';
  };

  /** Everything the embedding page needs to render, as plain data */
  const snapshot = (event) => ({
    'type': 'state',
    event,
    ready,
    'running': !!ui.running,
    active,
    'queued': _.map(ui.benchmarks, (bench) => !!ui.running && ui.indexOf(bench) > -1),
    ranks,
    'benches': _.map(ui.benchmarks, (bench, index) => ({
      'name': String(bench.name),
      'count': finite(bench.count),
      'cycles': finite(bench.cycles),
      'running': !!bench.running,
      'aborted': !!bench.aborted,
      'error': bench.error ? String(bench.error) : null,
      // may be Infinity for a test too fast to time
      'hz': Number(bench.hz) || 0,
      // Hz adjusted for the margin of error, used to rank the tests
      'adjustedHz': bench.stats ? 1 / (bench.stats.mean + bench.stats.moe) : 0,
      'rme': finite(bench.stats && bench.stats.rme),
      'samples': bench.stats ? bench.stats.sample.length : 0,
      'cycleTime': finite(bench.times && bench.times.cycle),
      'extra': extraText(index)
    }))
  });

  const send = (message) => {
    window.parent.postMessage(message, '*');
  };

  const report = (event) => send(snapshot(event));

  const callInit = () => {
    // call user provided init() function
    if (isFunction(window.init)) {
      window.init();
    }
  };

  /* ------------------------------------------------------------------------ */

  const commands = {
    // the "run" button: run every test that hasn't failed, or stop the run in progress
    'toggle' () {
      const stopped = !ui.running;
      ui.abort();
      ui.length = 0;

      if (stopped) {
        ui.push.apply(ui, _.filter(ui.benchmarks, (bench) => {
          return !bench.error && bench.reset();
        }));
        ui.run(runOptions);
      }
    },

    // a test's title cell: run just that test, or queue it when a run is in progress
    'run' (data) {
      const bench = ui.benchmarks[data.index];
      if (bench) {
        ui.push(bench.reset());
        ui.running ? report('queue') : ui.run(runOptions);
      }
    },

    'init' () {
      callInit();
      report('init');
    }
  };

  // only the embedding page may give commands, and only the known ones
  window.addEventListener('message', (event) => {
    const data = event.data;
    if (event.source === window.parent && ready && data && typeof data === 'object' &&
        Object.prototype.hasOwnProperty.call(commands, data.type)) {
      commands[data.type](data);
    }
  });

  /* ------------------------------------------------------------------------ */

  ui.on('add', (event) => {
    const bench = event.target;
    const span = document.createElement('span');

    ui.benchmarks.push(bench);
    span.id = `extra-${ui.benchmarks.length}`;
    span.hidden = true;
    document.body.appendChild(span);

    bench.on('start', callInit);
    bench.on('start cycle', () => {
      active = _.indexOf(ui.benchmarks, bench);
      report('progress');
    });
  })
    .on('start cycle', () => {
      ranks = null;
      report('cycle');
    })
    .on('abort', () => report('abort'))
    .on('complete', () => {
      const benches = Benchmark.filter(ui.benchmarks, 'successful');

      active = -1;
      ranks = {
        'fastest': indexesOf(Benchmark.filter(benches, 'fastest')),
        'slowest': indexesOf(Benchmark.filter(benches, 'slowest'))
      };
      report('complete');
    });

  /** An array of benchmarks created from test cases. */
  ui.benchmarks = [];

  window.ui = ui;

  // don't let users alert, confirm, prompt, or open new windows
  window.alert = window.confirm = window.prompt = window.open = function () {};

  // catch and report errors from the "preparation code"
  window.onerror = function (message, fileName, lineNumber) {
    send({ 'type': 'error', 'message': String(message), 'fileName': String(fileName), 'lineNumber': Number(lineNumber) || 0 });
  };

  window.addEventListener('load', () => {
    // clear length so tests can be manually queued
    ui.length = 0;

    // let any other "load" handlers of the preparation code run first
    _.defer(() => {
      ready = true;
      callInit();
      const state = snapshot('ready');
      state.height = document.documentElement.scrollHeight;
      send(state);
    });
  });
}(this, document));
