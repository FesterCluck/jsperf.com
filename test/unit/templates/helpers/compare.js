const Lab = require('@hapi/lab');
const Code = require('@hapi/code');
const sinon = require('sinon');

const compare = require('../../../../templates/helpers/compare');

const lab = exports.lab = Lab.script();

lab.experiment('Template Helper compare', function () {
  lab.test('throws error if unsupported operator', async function () {
    try {
      compare(1, 2, { hash: { operator: '!' } });
    } catch (e) {
      Code.expect(e.message).to.include('Unsupported operator');
    }
  });

  lab.test('calls options fn if operator evaluates true', async function () {
    const fnStub = sinon.stub();

    compare(2, 2, {
      hash: { operator: '===' },
      fn: fnStub
    });

    Code.expect(fnStub.called).to.be.true();
  });

  lab.test('calls options inverse if operator evaluates false', async function () {
    const inStub = sinon.stub();

    compare(2, 1, {
      hash: { operator: '===' },
      inverse: inStub
    });

    Code.expect(inStub.called).to.be.true();
  });

  lab.experiment('operators', function () {
    lab.experiment('diffRelativeDate', function () {
      lab.test('calls options fn if relativeDate not equal', async function () {
        const fnStub = sinon.stub();

        const d1 = new Date(1998, 7, 6);
        const d2 = new Date(1987, 6, 5);
        compare(d1, d2, {
          hash: { operator: 'diffRelativeDate' },
          fn: fnStub
        });

        Code.expect(fnStub.called).to.be.true();
      });
    });

    lab.experiment('isOwner', function () {
      const operator = 'isOwner';

      lab.test('calls options inverse if not owner', async function () {
        const inStub = sinon.stub();
        /*
          T & T & F
          T & F
          F
        */

        const tests = [
          // third fails
          {
            page: {
              author: true, authorEmail: true, authorURL: true
            },
            comment: {
              author: true, authorEmail: true, authorURL: false
            }
          },
          // second fails
          {
            page: {
              author: true, authorEmail: true, authorURL: true
            },
            comment: {
              author: true, authorEmail: false, authorURL: true
            }
          },
          // first fails
          {
            page: {
              author: true, authorEmail: true, authorURL: true
            },
            comment: {
              author: false, authorEmail: true, authorURL: true
            }
          }
        ];

        const testL = tests.length;

        for (let i = 0; i < testL; i++) {
          const t = tests[i];
          compare(t.page, t.comment, {
            hash: { operator },
            inverse: inStub
          });
        }

        Code.expect(inStub.callCount).to.equal(testL);
      });

      lab.test('calls options fn if author attributes all equal', async function () {
        const fnStub = sinon.stub();

        const page = {
          author: 'J Perf',
          authorEmail: 'j@perf.co',
          authorURL: 'jsperf.com'
        };
        const comment = {
          author: 'J Perf',
          authorEmail: 'j@perf.co',
          authorURL: 'jsperf.com'
        };

        compare(page, comment, {
          hash: { operator },
          fn: fnStub
        });

        Code.expect(fnStub.called).to.be.true();
        Code.expect(comment).to.include({ isOwner: true });
      });
    });
  });
});
