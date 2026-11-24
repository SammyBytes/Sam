import { describe, expect, test } from "bun:test";
import { chunk } from "./chunk";

describe("chunk validation", () => {
  test("throws when maxChars is not a positive integer", () => {
    for (const maxChars of [0, -1, -10, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => chunk("some text", maxChars)).toThrow(
        "maxChars must be a positive integer",
      );
    }
  });

  test("validates maxChars even for empty text", () => {
    expect(() => chunk("", 0)).toThrow("maxChars must be a positive integer");
  });
});

describe("chunk boundaries", () => {
  test("returns an empty array for empty text", () => {
    expect(chunk("", 10)).toEqual([]);
  });

  test("returns a single chunk when the text is shorter than maxChars", () => {
    expect(chunk("hello", 10)).toEqual(["hello"]);
  });

  test("returns a single chunk when the text is exactly maxChars long", () => {
    expect(chunk("hello", 5)).toEqual(["hello"]);
  });

  test("hard-splits text without break points at maxChars", () => {
    expect(chunk("abcdefghij", 3)).toEqual(["abc", "def", "ghi", "j"]);
  });

  test("supports a maxChars of one", () => {
    expect(chunk("abc", 1)).toEqual(["a", "b", "c"]);
  });

  test("keeps every chunk within maxChars when a newline sits on the boundary", () => {
    const chunks = chunk("abcde\nfghij", 5);

    expect(chunks.join("")).toBe("abcde\nfghij");
    for (const part of chunks) {
      expect(part.length).toBeLessThanOrEqual(5);
    }
  });
});

describe("chunk break points", () => {
  test("breaks at a newline and keeps the newline in the chunk", () => {
    expect(chunk("hello\nworld", 8)).toEqual(["hello\n", "world"]);
  });

  test("prefers a newline over a space", () => {
    expect(chunk("hello world\nnext", 12)).toEqual([
      "hello world\n",
      "next",
    ]);
  });

  test("breaks at a space and drops the separating space", () => {
    expect(chunk("hello world", 5)).toEqual(["hello", "world"]);
  });

  test("splits text across multiple line breaks", () => {
    expect(chunk("aaa\nbbb\nccc", 10)).toEqual(["aaa\nbbb\n", "ccc"]);
  });

  test("splits mixed prose at the last available space", () => {
    expect(chunk("alpha beta gamma delta", 12)).toEqual([
      "alpha beta",
      "gamma delta",
    ]);
  });

  test("preserves all text when hard-splitting", () => {
    const text = "abcdefghijklmnopqrstuvwxyz";
    const chunks = chunk(text, 4);

    expect(chunks).toEqual(["abcd", "efgh", "ijkl", "mnop", "qrst", "uvwx", "yz"]);
    expect(chunks.join("")).toBe(text);
  });

  test("preserves newlines when chunking across paragraphs", () => {
    const text = "first paragraph\nsecond paragraph\nthird paragraph";
    const chunks = chunk(text, 20);

    expect(chunks.join("")).toBe(text);
    for (const part of chunks) {
      expect(part.length).toBeLessThanOrEqual(20);
    }
  });
});
