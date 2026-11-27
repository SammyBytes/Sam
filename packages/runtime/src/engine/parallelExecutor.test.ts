import { describe, expect, test } from "bun:test";
import { parallelExecute } from "./parallelExecutor";

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

describe("parallelExecute", () => {
  test("ordered by default preserves input order despite reversed completion", async () => {
    const items = [0, 1, 2, 3];

    const result = await parallelExecute(
      items,
      { parallel: 4 },
      async (item) => {
        await delay((items.length - item) * 10);
        return { kind: "yield", value: item * 10 };
      },
    );

    expect(result).toEqual({
      kind: "values",
      values: [0, 10, 20, 30],
    });
  });

  test("ordered: false reflects completion order", async () => {
    const items = [0, 1, 2];

    const result = await parallelExecute(
      items,
      { parallel: 3, ordered: false },
      async (item) => {
        await delay((items.length - item) * 15);
        return { kind: "yield", value: item };
      },
    );

    expect(result).toEqual({ kind: "values", values: [2, 1, 0] });
  });

  test("continue emits no value and ordered results are compacted", async () => {
    const result = await parallelExecute(
      [1, 2, 3, 4, 5],
      { parallel: 3 },
      async (item) =>
        item % 2 === 0
          ? { kind: "continue" }
          : { kind: "yield", value: item },
    );

    expect(result).toEqual({ kind: "values", values: [1, 3, 5] });
  });

  test("respects the concurrency limit", async () => {
    let active = 0;
    let maxActive = 0;

    const result = await parallelExecute(
      Array.from({ length: 12 }, (_, index) => index),
      { parallel: 3 },
      async (item) => {
        active++;
        maxActive = Math.max(maxActive, active);
        await delay(2);
        active--;
        return { kind: "yield", value: item * 2 };
      },
    );

    expect(maxActive).toBeLessThanOrEqual(3);
    expect(result).toEqual({
      kind: "values",
      values: Array.from({ length: 12 }, (_, index) => index * 2),
    });
  });

  test("an empty iterable resolves to an empty values result", async () => {
    const result = await parallelExecute(
      [],
      { parallel: 5 },
      async () => ({ kind: "yield", value: "never" }),
    );

    expect(result).toEqual({ kind: "values", values: [] });
  });

  test("invalid concurrency throws RangeError before dispatching", async () => {
    for (const parallel of [0, -1, 1.5, Number.NaN]) {
      let called = 0;

      await expect(
        parallelExecute(
          [1, 2, 3],
          { parallel },
          async () => {
            called++;
            return { kind: "continue" };
          },
        ),
      ).rejects.toThrow(
        new RangeError(
          `'parallel' concurrency limit must be a positive integer, received ${parallel}.`,
        ),
      );

      expect(called).toBe(0);
    }
  });

  test("passes the pool signal to every worker", async () => {
    const seen: AbortSignal[] = [];

    const result = await parallelExecute(
      [1, 2, 3],
      { parallel: 2 },
      async (item, signal) => {
        seen.push(signal);
        expect(signal.aborted).toBe(false);
        return { kind: "yield", value: item };
      },
    );

    expect(result).toEqual({ kind: "values", values: [1, 2, 3] });
    expect(seen).toHaveLength(3);
  });

  test("a pre-aborted signal dispatches no work", async () => {
    const controller = new AbortController();
    controller.abort();
    let called = 0;

    const result = await parallelExecute(
      [1, 2, 3],
      { parallel: 2, signal: controller.signal },
      async () => {
        called++;
        return { kind: "yield", value: "x" };
      },
    );

    expect(called).toBe(0);
    expect(result).toEqual({ kind: "values", values: [] });
  });

  test("an external abort stops dispatching and settles", async () => {
    const controller = new AbortController();
    let started = 0;

    const resultPromise = parallelExecute(
      [1, 2, 3, 4, 5],
      { parallel: 2, signal: controller.signal },
      async (item, signal) => {
        started++;
        await new Promise<void>((resolve) => {
          signal.addEventListener("abort", () => resolve(), { once: true });
        });
        return { kind: "yield", value: item };
      },
    );

    // Both workers run synchronously up to their first await.
    expect(started).toBe(2);
    controller.abort();

    const result = await resultPromise;
    expect(result.kind).toBe("values");
    expect(started).toBe(2);
  });

  test("an early return resolves immediately without waiting for stragglers", async () => {
    let abortedSeen = false;
    let releaseStragglers!: () => void;
    const stragglerGate = new Promise<void>((resolve) => {
      releaseStragglers = resolve;
    });

    const resultPromise = parallelExecute(
      [0, 1, 2],
      { parallel: 3 },
      async (item, signal) => {
        if (item === 0) {
          return { kind: "return", value: "early" };
        }
        signal.addEventListener(
          "abort",
          () => {
            abortedSeen = true;
          },
          { once: true },
        );
        await stragglerGate;
        return { kind: "yield", value: item };
      },
    );

    const result = await Promise.race([
      resultPromise,
      delay(100).then(() => "timeout" as const),
    ]);

    expect(result).toEqual({ kind: "return", value: "early" });
    expect(abortedSeen).toBe(true);

    // Unblock the stragglers so the test leaves no dangling work.
    releaseStragglers();
    await resultPromise;
  });

  test("the first return wins across ticks", async () => {
    const result = await parallelExecute(
      [0, 1],
      { parallel: 2 },
      async (item) => {
        if (item === 0) {
          await delay(30);
          return { kind: "return", value: "zero" };
        }
        await delay(5);
        return { kind: "return", value: "one" };
      },
    );

    expect(result).toEqual({ kind: "return", value: "one" });
  });

  test("same-tick returns are won by the lowest index", async () => {
    const result = await parallelExecute(
      [0, 1],
      { parallel: 2 },
      async (item) => {
        if (item === 0) {
          // Two microtask hops make index 1 register its return first.
          await Promise.resolve();
          await Promise.resolve();
          return { kind: "return", value: "zero" };
        }
        return { kind: "return", value: "one" };
      },
    );

    expect(result).toEqual({ kind: "return", value: "zero" });
  });

  test("an uncaught worker error aborts the pool and propagates", async () => {
    let abortedSeen = false;

    await expect(
      parallelExecute([0, 1], { parallel: 2 }, async (item, signal) => {
        if (item === 0) {
          signal.addEventListener(
            "abort",
            () => {
              abortedSeen = true;
            },
            { once: true },
          );
          await new Promise<void>((_, reject) => {
            signal.addEventListener(
              "abort",
              () => reject(new Error("aborted straggler")),
              { once: true },
            );
          });
        }
        await delay(5);
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");

    expect(abortedSeen).toBe(true);
  });

  test("closes the source iterator on early return", async () => {
    let closed = false;

    function* source(): Generator<number> {
      try {
        yield 0;
        yield 1;
        yield 2;
      } finally {
        closed = true;
      }
    }

    const result = await parallelExecute(
      source(),
      { parallel: 1 },
      async () => ({ kind: "return", value: "done" }),
    );

    expect(result).toEqual({ kind: "return", value: "done" });
    expect(closed).toBe(true);
  });

  test("closes the source iterator on an uncaught error", async () => {
    let closed = false;

    function* source(): Generator<number> {
      try {
        yield 0;
        yield 1;
      } finally {
        closed = true;
      }
    }

    await expect(
      parallelExecute(source(), { parallel: 1 }, async () => {
        throw new Error("kaboom");
      }),
    ).rejects.toThrow("kaboom");

    expect(closed).toBe(true);
  });

  test("nested pools keep independent state and propagate the signal", async () => {
    const result = await parallelExecute(
      [0, 1],
      { parallel: 2 },
      async (outer, signal) => {
        const inner = await parallelExecute(
          [0, 1],
          { parallel: 2, signal },
          async (value) => ({
            kind: "yield",
            value: outer * 10 + value,
          }),
        );

        if (inner.kind !== "values") {
          throw new Error("unexpected inner early return");
        }
        return { kind: "yield", value: inner.values };
      },
    );

    expect(result).toEqual({
      kind: "values",
      values: [
        [0, 1],
        [10, 11],
      ],
    });
  });
});
