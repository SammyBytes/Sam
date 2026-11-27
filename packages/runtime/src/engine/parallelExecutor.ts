import type { ParallelResult, WorkerOutcome } from "../result";

export type ParallelOptions = {
  parallel: number;
  ordered?: boolean;
  signal?: AbortSignal;
};

/**
 * Executes a worker function in parallel over an iterable of inputs with
 * bounded concurrency.
 *
 * @param iterable The iterable of inputs to process.
 * @param options Configuration options for parallel execution.
 * @param workerFn The worker function to execute for each input.
 * @returns A promise that resolves to the collected values or the first early
 *   return value.
 */
export async function parallelExecute<TInput, TOutput>(
  iterable: Iterable<TInput>,
  options: ParallelOptions,
  workerFn: (
    item: TInput,
    signal: AbortSignal,
  ) => Promise<WorkerOutcome<TOutput>>,
): Promise<ParallelResult<TOutput>> {
  const { parallel, ordered = true, signal } = options;

  if (!Number.isInteger(parallel) || parallel <= 0) {
    throw new RangeError(
      `'parallel' concurrency limit must be a positive integer, received ${parallel}.`,
    );
  }

  const iterator = iterable[Symbol.iterator]();
  if (!iterator) {
    throw new Error("Provided iterable is not iterable.");
  }

  const skipped = Symbol("sam.skipped");

  const slots: Array<TOutput | typeof skipped> = [];
  const unorderedResults: TOutput[] = [];

  const controller = new AbortController();

  const closeIterator = (): void => {
    try {
      iterator.return?.();
    } catch {
      // A generator may throw while closing; the abort result still stands.
    }
  };

  const abort = (reason?: unknown): void => {
    if (!controller.signal.aborted) {
      controller.abort(reason);
    }
    closeIterator();
  };

  if (signal) {
    if (signal.aborted) {
      abort(signal.reason);
    } else {
      signal.addEventListener("abort", () => abort(signal.reason), {
        once: true,
      });
    }
  }

  let nextIndex = 0;
  let finished = 0;
  let settled = false;
  let finalizeScheduled = false;
  let earlyReturn: { index: number; value: unknown } | undefined;

  let resolveDone!: (result: ParallelResult<TOutput>) => void;
  let rejectDone!: (error: unknown) => void;
  const done = new Promise<ParallelResult<TOutput>>((resolve, reject) => {
    resolveDone = resolve;
    rejectDone = reject;
  });

  const resolveOnce = (result: ParallelResult<TOutput>): void => {
    if (settled) return;
    settled = true;
    resolveDone(result);
  };

  const rejectOnce = (error: unknown): void => {
    if (settled) return;
    settled = true;
    rejectDone(error);
  };

  const collect = (): ParallelResult<TOutput> => {
    if (ordered) {
      const values = slots.filter(
        (item): item is TOutput => item !== skipped,
      );
      return { kind: "values", values };
    }
    return { kind: "values", values: unorderedResults };
  };

  /**
   * Registers an early return. The first return triggers the abort; returns
   * observed in the same event-loop tick are coalesced and the lowest
   * original index wins. Finalization happens at the end of the current tick,
   * before any long-running straggler can delay the parent flow.
   */
  const registerReturn = (index: number, value: unknown): void => {
    if (earlyReturn === undefined || index < earlyReturn.index) {
      earlyReturn = { index, value };
    }
    abort();

    if (!finalizeScheduled) {
      finalizeScheduled = true;
      setTimeout(() => {
        const winner = earlyReturn;
        if (winner !== undefined) {
          resolveOnce({ kind: "return", value: winner.value });
        }
      }, 0);
    }
  };

  const runWorker = async (): Promise<void> => {
    try {
      while (!controller.signal.aborted) {
        const next = iterator.next();
        if (next.done) return;

        const currentIndex = nextIndex++;
        if (ordered) {
          // Pre-fill so an aborted in-flight iteration is compacted away
          // instead of leaving a hole in the result array.
          slots[currentIndex] = skipped;
        }

        const outcome = await workerFn(next.value, controller.signal);

        if (outcome.kind === "return") {
          registerReturn(currentIndex, outcome.value);
          return;
        }

        if (controller.signal.aborted) return;

        switch (outcome.kind) {
          case "yield":
            if (ordered) {
              slots[currentIndex] = outcome.value;
            } else {
              unorderedResults.push(outcome.value);
            }
            break;
          case "continue":
            break;
        }
      }
    } catch (error) {
      if (controller.signal.aborted) {
        // Stragglers aborted by an early return or an external signal must
        // not surface as unhandled rejections.
        return;
      }
      abort(error);
      rejectOnce(error);
    } finally {
      finished++;
      if (
        earlyReturn === undefined &&
        !settled &&
        finished === parallel
      ) {
        resolveOnce(collect());
      }
    }
  };

  const workers = new Array(parallel).fill(null).map(() => runWorker());
  // The workers never reject: runWorker catches and routes errors through the
  // shared `done` promise. Attaching a handler is defensive against future
  // changes and keeps Node/Bun from reporting unhandled rejections.
  for (const worker of workers) {
    worker.catch(() => {});
  }

  return done;
}
