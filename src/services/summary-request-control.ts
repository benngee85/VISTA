/**
 * Process-local control plane for article summarisation requests.
 *
 * Responsibilities:
 * - coalesce duplicate in-flight summaries by their canonical cache key;
 * - cap concurrent server-backed summarisation calls;
 * - queue excess calls FIFO;
 * - remove settled work from all process-local state.
 *
 * Cross-process and cross-user deduplication remains the responsibility of
 * the authoritative server-side Redis summary cache.
 */

export interface SummaryRequestController {
  coalesce<T>(
    cacheKey: string,
    task: () => Promise<T>,
  ): Promise<T>;

  runServer<T>(
    task: () => Promise<T>,
  ): Promise<T>;

  getActiveServerCount(): number;
  getQueuedServerCount(): number;
  getInFlightSummaryCount(): number;
}

export interface SummaryRequestControllerOptions {
  maxConcurrentServerRequests: number;
}

interface QueuedTask<T> {
  task: () => Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
}

export function createSummaryRequestController(
  options: SummaryRequestControllerOptions,
): SummaryRequestController {
  const maxConcurrent = Math.floor(
    options.maxConcurrentServerRequests,
  );

  if (
    !Number.isFinite(maxConcurrent)
    || maxConcurrent < 1
  ) {
    throw new Error(
      'maxConcurrentServerRequests must be a positive integer',
    );
  }

  const inFlightSummaries = new Map<
    string,
    Promise<unknown>
  >();

  const serverQueue: Array<QueuedTask<unknown>> = [];
  let activeServerRequests = 0;

  const drainQueue = (): void => {
    while (
      activeServerRequests < maxConcurrent
      && serverQueue.length > 0
    ) {
      const queued = serverQueue.shift();

      if (!queued) return;

      activeServerRequests += 1;

      // Run each queued task in one async frame. Capacity is released in the
      // finally block before promise observers resume, so a settled
      // runServer() promise never reports stale active-request state.
      void Promise.resolve().then(async () => {
        try {
          const value = await queued.task();
          queued.resolve(value);
        } catch (error) {
          queued.reject(error);
        } finally {
          activeServerRequests -= 1;
          drainQueue();
        }
      });
    }
  };

  const runServer = <T>(
    task: () => Promise<T>,
  ): Promise<T> => {
    return new Promise<T>((resolve, reject) => {
      serverQueue.push({
        task,
        resolve: resolve as (
          value: unknown | PromiseLike<unknown>
        ) => void,
        reject,
      });

      drainQueue();
    });
  };

  const coalesce = <T>(
    cacheKey: string,
    task: () => Promise<T>,
  ): Promise<T> => {
    const existing = inFlightSummaries.get(cacheKey);

    if (existing) {
      return existing as Promise<T>;
    }

    const promise = Promise.resolve()
      .then(task)
      .finally(() => {
        if (
          inFlightSummaries.get(cacheKey)
          === promise
        ) {
          inFlightSummaries.delete(cacheKey);
        }
      });

    inFlightSummaries.set(cacheKey, promise);

    return promise;
  };

  return {
    coalesce,
    runServer,

    getActiveServerCount: () =>
      activeServerRequests,

    getQueuedServerCount: () =>
      serverQueue.length,

    getInFlightSummaryCount: () =>
      inFlightSummaries.size,
  };
}
