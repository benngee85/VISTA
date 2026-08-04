import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createSummaryRequestController,
} from '../src/services/summary-request-control.ts';

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return {
    promise,
    resolve,
    reject,
  };
};

test(
  'coalesces identical in-flight summary keys',
  async () => {
    const controller =
      createSummaryRequestController({
        maxConcurrentServerRequests: 2,
      });

    const pending = deferred<string>();
    let executions = 0;

    const first = controller.coalesce(
      'summary:key',
      async () => {
        executions += 1;
        return pending.promise;
      },
    );

    const second = controller.coalesce(
      'summary:key',
      async () => {
        executions += 1;
        return 'duplicate';
      },
    );

    assert.equal(first, second);
    assert.equal(
      controller.getInFlightSummaryCount(),
      1,
    );

    pending.resolve('complete');

    assert.equal(await first, 'complete');
    assert.equal(await second, 'complete');
    assert.equal(executions, 1);
    assert.equal(
      controller.getInFlightSummaryCount(),
      0,
    );
  },
);

test(
  'does not coalesce different summary keys',
  async () => {
    const controller =
      createSummaryRequestController({
        maxConcurrentServerRequests: 2,
      });

    const results = await Promise.all([
      controller.coalesce(
        'summary:a',
        async () => 'a',
      ),
      controller.coalesce(
        'summary:b',
        async () => 'b',
      ),
    ]);

    assert.deepEqual(results, ['a', 'b']);
  },
);

test(
  'limits active server summaries and drains FIFO',
  async () => {
    const controller =
      createSummaryRequestController({
        maxConcurrentServerRequests: 2,
      });

    const releaseFirst = deferred<void>();
    const releaseSecond = deferred<void>();
    const order: string[] = [];

    const first = controller.runServer(
      async () => {
        order.push('first:start');
        await releaseFirst.promise;
        order.push('first:end');
        return 'first';
      },
    );

    const second = controller.runServer(
      async () => {
        order.push('second:start');
        await releaseSecond.promise;
        order.push('second:end');
        return 'second';
      },
    );

    const third = controller.runServer(
      async () => {
        order.push('third:start');
        order.push('third:end');
        return 'third';
      },
    );

    await Promise.resolve();
    await Promise.resolve();

    assert.equal(
      controller.getActiveServerCount(),
      2,
    );
    assert.equal(
      controller.getQueuedServerCount(),
      1,
    );
    assert.deepEqual(
      order,
      ['first:start', 'second:start'],
    );

    releaseFirst.resolve();
    await first;
    await Promise.resolve();
    await Promise.resolve();

    assert.ok(
      order.indexOf('third:start')
      > order.indexOf('first:end'),
    );

    releaseSecond.resolve();

    assert.deepEqual(
      await Promise.all([second, third]),
      ['second', 'third'],
    );

    assert.equal(
      controller.getActiveServerCount(),
      0,
    );
    assert.equal(
      controller.getQueuedServerCount(),
      0,
    );
  },
);

test(
  'releases capacity after a rejected server task',
  async () => {
    const controller =
      createSummaryRequestController({
        maxConcurrentServerRequests: 1,
      });

    const first = controller.runServer(
      async () => {
        throw new Error('expected failure');
      },
    );

    const second = controller.runServer(
      async () => 'recovered',
    );

    await assert.rejects(
      first,
      /expected failure/,
    );

    assert.equal(await second, 'recovered');
    assert.equal(
      controller.getActiveServerCount(),
      0,
    );
  },
);

test(
  'rejects invalid concurrency limits',
  () => {
    assert.throws(
      () => createSummaryRequestController({
        maxConcurrentServerRequests: 0,
      }),
      /positive integer/,
    );
  },
);
