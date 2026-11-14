/**
 * This class represents a scanner that processes a source string character by character.
 * It provides methods to peek at characters, advance the cursor, match expected strings,
 * and extract substrings from the source.
 * The scanner keeps track of the current line and column numbers for error reporting.
 */
export class Scanner {
  private cursor = 0;
  public line = 1;
  public column = 1;

  constructor(private readonly source: string) {}

  /**
   * Checks if the scanner has reached the end of the source string.
   * @returns True if the cursor is at or beyond the end of the source string, false otherwise.
   */
  get isAtEnd(): boolean {
    return this.cursor >= this.source.length;
  }

  /**
   * Returns the current position of the cursor in the source string.
   * @returns The current index of the cursor in the source string.
   */
  get position(): number {
    return this.cursor;
  }

  /**
   * Peeks at the character at the current cursor position plus an optional offset without advancing the cursor.
   * @param offset The number of characters to look ahead from the current cursor position. Defaults to 0 (the current character).
   * @returns The character at the current cursor position plus the offset, or an empty string if the position is out of bounds.
   */
  peek(offset = 0): string {
    return this.source[this.cursor + offset] ?? "";
  }

  /**
   * Advances the cursor by one character and returns the character at the current position.
   * @returns The character at the current position before advancing the cursor.
   */
  advance(): string {
    const char = this.source[this.cursor] ?? "";
    this.cursor++;
    if (char === "\n") {
      this.line++;
      this.column = 1;
    } else {
      this.column++;
    }
    return char;
  }

  /**
   * Checks if the next characters in the source match the expected string.
   * If they do, it advances the cursor and returns true. Otherwise, it returns false.
   * @param expected The string to match against the next characters in the source.
   * @returns True if the next characters match the expected string, false otherwise.
   */
  match(expected: string): boolean {
    if (this.source.startsWith(expected, this.cursor)) {
      for (let i = 0; i < expected.length; i++) this.advance();
      return true;
    }
    return false;
  }

  /**
   * Returns a substring of the source string from the specified start index to the current cursor position.
   * @param start The index in the source string to start the slice from.
   * @returns A substring of the source string from the start index to the current cursor position.
   */
  sliceFrom(start: number): string {
    return this.source.slice(start, this.cursor);
  }
}
