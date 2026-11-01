'use strict';

const basePath = require('../../lib/basePath');

exports.plugin = {
  name: 'web/faq',
  register: (server) => {
    server.route({
      method: 'GET',
      path: '/faq',
      handler: (request, h) => {
        return h.view('faq/index', {
          headTitle: 'Frequently asked questions',
          faq: [
            {
              slug: 'what',
              title: 'What is jsPerf?',
              answer: 'jsPerf aims to provide an easy way to create and share test cases, comparing the performance of different JavaScript snippets by running benchmarks. But even if you don’t add tests yourself, you can still use it as a JavaScript performance knowledge base.'
            }, {
              slug: 'engine',
              title: 'Which benchmarking engine is being used?',
              answer: 'jsPerf is proudly powered by <a href="https://benchmarkjs.com/">Benchmark.js</a>, a <a href="https://mathiasbynens.be/notes/javascript-benchmarking" title="Bulletproof JavaScript benchmarks">robust</a> JavaScript benchmarking library that works on nearly all JavaScript platforms, supports high-resolution timers, and returns statistically significant results. Kudos to <a href="http://allyoucanleet.com/">John-David Dalton</a> for his awesome work on this project!'
            }, {
              slug: 'script-warnings',
              title: 'I’m getting script warnings when running a test in Internet Explorer. What’s up with that?',
              answer: 'Rather than limiting a script by time like all other browsers do, IE (up to version 8) limits a script to 5 million instructions. With modern hardware, a CPU-intensive script can trigger this in less than half a second. If you have a reasonably fast system you may run into these dialogs in IE, in which case the best solution is to <a href="https://support.microsoft.com/en-us/kb/175500">modify your Windows Registry to increase the number of operations</a> (I have mine set to 80,000,000).'
            }, {
              slug: 'firebug-warning',
              title: 'I’m getting a warning message telling me to disable Firebug. What’s up with that?',
              answer: 'Enabling Firebug causes all JITs to be disabled, meaning you’ll be running the tests in the interpreter, so things will be very slow. For a fair comparison between browsers, always close Firebug before running any tests.'
            }, {
              slug: 'calibration',
              title: 'What happened to the ‘calibration’ feature?',
              answer: 'We decided to remove it since after factoring in the adjusted margin of error, the results are indistinguishable from non-calibrated results.'
            }, {
              slug: 'java-applet',
              title: 'Why does jsPerf use a Java applet on test pages? Do I have to enable Java to use jsPerf?',
              answer: 'The applet you’re talking about is just a clever trick we’re using to expose Java’s nanosecond timer to JavaScript, so we can use it to get more accurate test results. jsPerf will still work fine if you disable Java; it might just take a little longer to run tests. If you want, you can prevent jsPerf from inserting the Java applet into the document by appending <code>#nojava</code> to any test case URL.'
            }, {
              slug: 'ie9-java',
              title: 'I cannot seem to access jsPerf using IE9. What gives?',
              answer: 'You may get an error message saying “A problem with this webpage caused Internet Explorer to close and reopen the tab”, but really the problem lies with the combination of <a href="https://support.microsoft.com/en-us/kb/2506617">IE9 and Java Version 6 Update 22 or 23</a>. Luckily, there’s an easy fix: just <a href="https://www.java.com/en/download/manual.jsp">download and install the latest version of Java</a>.'
            }, {
              slug: 'lion-java',
              title: 'jsPerf is broken in older Firefox versions on Mac OS X Lion!',
              answer: 'That’s actually an issue with an incompatible Java plugin. When testing in Firefox 3.x under Lion, make sure to disable the <a href="http://javaplugin.sourceforge.net/">Java Embedding Plugin</a> via Firefox → Preferences → General → Manage Add-ons → Plugins. You’ll still be able to use jsPerf, although it won’t use <a href="#java-applet">the fancy nanotimer</a>.'
            }, {
              slug: 'chrome',
              title: 'I heard somewhere that Chrome has built-in benchmarking extensions. Can I use these for jsPerf?',
              answer: 'Yes, you can <a href="https://www.chromium.org/developers/how-tos/run-chromium-with-flags">run Chrome or Chromium with the <code>--enable-benchmarking</code> flag</a> to improve the accuracy of test results in these browsers.'
            }, {
              slug: 'run-single-test',
              title: 'Can I re-run a single test?',
              answer: 'You can (re-)run specific tests by clicking on their description in the overview table. Quickly clicking several test descriptions causes the first test to start running, while the others will get the pending status.'
            }, {
              slug: 'autorun',
              title: 'I don’t like clicking buttons. Can I make the tests run automatically after opening a page?',
              answer: `Sure, just append <code>#run</code> to the URL of the test case, e.g. <a href="${basePath.url(request, '/document-getelementbyid')}#run" title="Run document.getElementById() benchmarks"><code>https://jsperf.com/document-getelementbyid#run</code></a>.`
            }, {
              slug: 'setup-teardown',
              title: 'Is it possible to execute code before and after each clocked test loop, outside of the timed code region?',
              answer: 'That’s what <a href="https://benchmarkjs.com/docs#prototype_setup" title="Benchmark.prototype.setup"><code>Benchmark#setup</code></a> and <a href="https://benchmarkjs.com/docs#prototype_teardown" title="Benchmark.prototype.teardown"><code>Benchmark#teardown</code></a> are for. You can use the Setup and Teardown fields to use the same function (s) for all tests. To target specific tests, you can use <code>setTimeout(function () { ui.benchmarks[<var>0</var>].setup = function (){ … }; }, 1);</code> (and/or <code>teardown</code>) in the Preparation Code field, where <code><var>0</var></code> is the zero-indexed test ID.'
            }, {
              slug: 'async',
              title: 'How can I run asynchronous tests?',
              answer: 'Just tick the “async” checkbox for each asynchronous test. You will then have access to a <code>deferred</code> object. In your test code, whenever your test is finished, call <code>deferred.resolve()</code>. Here’s an example: <a href="https://jsperf.com/smallest-timeout">https://jsperf.com/smallest-timeout</a>'
            }, {
              slug: 'add-edit',
              title: 'Can I add tests to existing testcases, or edit them?',
              answer: 'Sure, just append <code>/edit</code> to the URL of the test case. If you’re the original author of the test case you’re editing and it hasn’t been more than 8 hours since you last visited jsPerf, any changes you make will simply overwrite what you entered before. If those conditions don’t apply, every edit you save will create a new revision, i.e. <code>https://jsperf.com/<var>foo</var>/2</code>, <code>https://jsperf.com/<var>foo</var>/3</code>, and so on.'
            }, {
              slug: 'remove-snippet',
              title: 'Can I remove a snippet from my test case?',
              answer: 'Absolutely. Just <a href="#add-edit">edit the test case</a>, clear the ‘title’ and ‘code’ fields for the snippet you want to remove and save your changes.'
            }, {
              slug: 'test-case-feed',
              title: 'How can I follow up on a specific test case? I’d like to get notified when there’s a new revision.',
              answer: 'Every test case has its own Atom feed which you can subscribe to using your favorite feed reader. Just append <code>.atom</code> to the main test case’s URL to get it.'
            }, {
              slug: 'author-feed',
              title: 'How can I keep track of new or updated test cases made by a specific user?',
              answer: 'Every author has its own Atom feed, located at <code>https://jsperf.com/browse/<var>author-name</var>.atom</code>. Omit the <code>.atom</code> suffix to get a clickable list instead. If you’re identified on jsPerf (i.e. if you’ve commented, or created/edited a test case), a “My tests” link will appear in the navigation.'
            }, {
              slug: 'test-availability',
              title: 'How long will my tests be available on jsPerf?',
              answer: 'Every test case and/or revision that’s added to jsPerf will remain here forever. You can safely link to any jsPerf document; in general, all URLs are supposed to be permalinks.<br>However, this rule does not apply to invalid/spammy tests, because those will likely get removed.'
            }, {
              slug: 'additional-features',
              title: 'Will you implement <var>[feature XYZ]</var>?',
              answer: 'Why not? I’m <a href="https://github.com/FesterCluck/jsperf.com/issues" rel="nofollow">open to suggestions</a>, so please let me know if you have an idea that could make jsPerf more awesome.'
            }
          ]
        });
      }
    });
  }
};
