/*!
 * ui.js
 * The test page's side of the sandboxed test frame (see runner.js): sends run/stop commands and renders the
 * results the frame reports. The user's code only ever runs inside the frame, so everything it sends is
 * untrusted: it is validated here and written to the page as text, never as HTML.
 *
 * Based on ui.js by Mathias Bynens <https://mths.be/> and John-David Dalton <http://allyoucanleet.com/>
 * Available under MIT license <https://mths.be/mit>
 */
(function (window, document) {
  const frame = document.getElementById('test-frame');

  /** Benchmark results element id prefix (e.g. `results-1`) */
  const prefix = 'results-';

  /** Cache of error messages */
  const errors = [];

  /** The most recent valid state reported by the frame */
  let state = null;

  const texts = {
    'run': { 'again': 'Run again', 'ready': 'Run tests', 'running': 'Stop running' },
    'status': { 'again': 'Done. Ready to run again.', 'loading': 'Loading tests…', 'ready': 'Ready to run.' }
  };

  const $ = (id) => document.getElementById(id);

  const rows = () => document.querySelectorAll('[id^="results-"]').length;

  // 40px is room for the border and a sliver of content; the frame has to stay in view so it isn't throttled
  const MIN_FRAME_HEIGHT = 40;
  const MAX_FRAME_HEIGHT = 600;

  /* ------------------------------------------------------------------------ */

  const isNumber = (value) => typeof value === 'number' && isFinite(value);

  const formatNumber = (number) => {
    const parts = String(number).split('.');
    return parts[0].replace(/(?=(?:\d{3})+$)(?!\b)/g, ',') + (parts[1] ? `.${parts[1]}` : '');
  };

  const isIndexList = (list, length) => Array.isArray(list) && list.every((i) => Number.isInteger(i) && i >= 0 && i < length);

  const parseBench = (bench) => {
    if (!bench || typeof bench !== 'object' || typeof bench.name !== 'string' ||
        !['count', 'cycles', 'rme', 'samples', 'cycleTime'].every((key) => isNumber(bench[key])) ||
        typeof bench.hz !== 'number' || typeof bench.adjustedHz !== 'number' ||
        typeof bench.running !== 'boolean' || typeof bench.aborted !== 'boolean' ||
        (bench.error !== null && typeof bench.error !== 'string') || typeof bench.extra !== 'string') {
      return null;
    }

    return {
      'name': bench.name,
      'count': bench.count,
      'cycles': bench.cycles,
      'running': bench.running,
      'aborted': bench.aborted,
      'error': bench.error,
      'hz': bench.hz,
      'adjustedHz': bench.adjustedHz,
      'rme': bench.rme,
      'samples': bench.samples,
      'cycleTime': bench.cycleTime,
      'extra': bench.extra
    };
  };

  /** Returns a sanitized copy of a state message, or null when it is not one */
  const parseState = (data) => {
    if (!data || data.type !== 'state' || !Array.isArray(data.benches) || !Array.isArray(data.queued) ||
        data.benches.length !== rows() || data.queued.length !== data.benches.length ||
        typeof data.running !== 'boolean' || typeof data.ready !== 'boolean' || typeof data.event !== 'string' ||
        !Number.isInteger(data.active) || data.active >= data.benches.length) {
      return null;
    }

    const benches = data.benches.map(parseBench);
    const ranks = data.ranks;
    if (benches.includes(null) || !data.queued.every((q) => typeof q === 'boolean') ||
        (ranks !== null && (!ranks || !isIndexList(ranks.fastest, benches.length) || !isIndexList(ranks.slowest, benches.length)))) {
      return null;
    }

    return {
      'event': data.event,
      'ready': data.ready,
      'running': data.running,
      'active': data.active,
      'queued': data.queued.slice(),
      'ranks': ranks && { 'fastest': ranks.fastest.slice(), 'slowest': ranks.slowest.slice() },
      benches,
      'height': isNumber(data.height) ? data.height : 0
    };
  };

  /* ------------------------------------------------------------------------ */

  const setText = (element, text) => {
    element.textContent = text;
  };

  const setStatus = (text) => setText($('status'), text);

  /** Appends a message (and optional details) to the error log below the table */
  const logError = (message, details) => {
    let div = $('error-info');
    const text = details ? `${message} ${details}` : message;

    if (errors.includes(text)) {
      return;
    }

    if (!div) {
      const table = $('test-table');
      div = document.createElement('div');
      div.id = 'error-info';
      table.parentNode.insertBefore(div, table.nextSibling);
    }

    errors.push(text);
    div.className = 'show';

    const p = document.createElement('p');
    setText(p, `${message}.`);
    div.appendChild(p);

    if (details) {
      const ul = document.createElement('ul');
      const li = document.createElement('li');
      setText(li, details);
      ul.appendChild(li);
      div.appendChild(ul);
    }
  };

  const clearErrors = () => {
    const div = $('error-info');
    if (div) {
      div.className = '';
      div.textContent = '';
    }
    errors.length = 0;
  };

  const getHz = (bench) => bench.adjustedHz;

  /** Renders the results table cell of every test */
  const render = () => {
    if (!state) {
      return;
    }

    const done = !state.running;
    const ranks = done && state.ranks;

    state.benches.forEach((bench, index) => {
      const cell = $(prefix + (index + 1));
      const extra = $(`extra-${index + 1}`);

      cell.title = '';
      cell.className = 'results';
      cell.textContent = '';

      if (extra) {
        setText(extra, bench.extra);
      }

      if (bench.error) {
        setText(cell, 'Error');
        cell.className += ' error';
        logError(bench.error);
      } else if (bench.running) {
        setText(cell, 'running…');
      } else if (bench.cycles) {
        // obscure details until the suite has completed
        if (state.running) {
          setText(cell, 'completed');
        } else {
          cell.title = `Ran ${formatNumber(bench.count)} times in ${bench.cycleTime.toFixed(3)} seconds.`;
          cell.appendChild(document.createTextNode(`${formatNumber(bench.hz.toFixed(bench.hz < 100 ? 2 : 0))} `));
          const small = document.createElement('small');
          setText(small, `±${bench.rme.toFixed(2)}%`);
          cell.appendChild(small);
        }
      } else {
        setText(cell, state.running && state.queued[index] ? 'pending…' : 'ready');
      }

      if (ranks && !bench.error && bench.cycles && isFinite(bench.hz)) {
        rank(cell, bench, index, ranks);
      }
    });
  };

  /** Highlights the fastest and slowest tests of a completed run and writes how much slower the others were */
  const rank = (cell, bench, index, ranks) => {
    const fastest = state.benches[ranks.fastest[0]];
    const percent = fastest ? (1 - (getHz(bench) / getHz(fastest))) * 100 : 0;
    let text = 'fastest';

    if (ranks.fastest.includes(index)) {
      cell.className += ' fastest';
    } else {
      text = isFinite(percent) ? `${formatNumber(percent < 1 ? percent.toFixed(2) : Math.round(percent))}% slower` : '';

      if (ranks.slowest.includes(index)) {
        cell.className += ' slowest';
      }
    }

    const span = document.createElement('span');
    setText(span, text);
    cell.appendChild(span);
  };

  /* ------------------------------------------------------------------------ */

  const send = (message) => {
    // the sandboxed frame has an opaque origin, so there is no origin to target; nothing secret is sent
    frame.contentWindow.postMessage(message, '*');
  };

  const onState = (next) => {
    const wasRunning = !!state && state.running;
    state = next;

    if (next.height) {
      frame.style.height = `${Math.min(MAX_FRAME_HEIGHT, Math.max(MIN_FRAME_HEIGHT, Math.ceil(next.height) + 2))}px`;
    }

    if (next.running && !wasRunning) {
      clearErrors();
    }

    render();

    const run = $('run');
    if (next.running) {
      setText(run, texts.run.running);
      const bench = next.benches[next.active];
      if (bench && !bench.aborted) {
        const size = bench.samples;
        setStatus(`${bench.name} × ${formatNumber(bench.count)} (${size} sample${size === 1 ? '' : 's'})`);
      }
    } else if (next.event === 'complete') {
      setText(run, texts.run.again);
      setStatus(texts.status.again);
    } else if (next.event === 'ready') {
      setText(run, texts.run.ready);
      setStatus(texts.status.ready);
      run.disabled = false;
      autoRun();
    } else if (wasRunning) {
      // aborted
      setText(run, texts.run.again);
      setStatus(texts.status.ready);
    }
  };

  const params = () => {
    const result = {};
    window.location.hash.slice(1).split('&').forEach((pair) => {
      const [key, value] = pair.split('=');
      if (key) {
        result[key.toLowerCase()] = (value || '').toLowerCase();
      }
    });
    return result;
  };

  const autoRun = () => {
    if ('run' in params()) {
      $('runner').scrollIntoView();
      setTimeout(() => send({ 'type': 'toggle' }), 1);
    }
  };

  window.addEventListener('message', (event) => {
    // the origin is "null" for a sandboxed frame, so the sender is identified by its window instead
    if (event.source !== frame.contentWindow || !event.data || typeof event.data !== 'object') {
      return;
    }

    if (event.data.type === 'error') {
      const { message, fileName, lineNumber } = event.data;
      if (typeof message === 'string' && typeof fileName === 'string' && isNumber(lineNumber)) {
        logError(message, `fileName: ${fileName} lineNumber: ${lineNumber}`);
        $('error-info').scrollIntoView();
      }
      return;
    }

    const next = parseState(event.data);
    if (next) {
      onState(next);
    }
  });

  window.addEventListener('hashchange', () => {
    if (state && state.ready) {
      send({ 'type': 'init' });
      autoRun();
    }
  });

  /* ------------------------------------------------------------------------ */

  const run = $('run');
  run.disabled = true;
  setText(run, texts.run.ready);
  setStatus(texts.status.loading);
  $('controls').className += ' show';
  run.addEventListener('click', () => {
    if (state && state.ready) {
      send({ 'type': 'toggle' });
    }
  });

  document.querySelectorAll('[id^="title-"]').forEach((title) => {
    const index = Number(title.id.split('-')[1]) - 1;
    const click = () => {
      if (state && state.ready) {
        send({ 'type': 'run', index });
      }
    };

    title.tabIndex = 0;
    title.title = 'Click to run this test again.';
    title.addEventListener('click', click);
    title.addEventListener('keyup', (event) => {
      if (event.keyCode === 13) {
        click();
      }
    });
  });
}(window, document));
