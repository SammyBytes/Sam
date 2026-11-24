/**
 * Splits the input text into chunks of a specified maximum number of characters.
 * @param text The input text to be chunked.
 * @param maxChars The maximum number of characters allowed in each chunk. Must be a positive integer.
 * @returns An array of strings, where each string is a chunk of the input text.
 */
export function chunk(text: string, maxChars: number): string[] {
  if (!Number.isInteger(maxChars) || maxChars <= 0) {
    throw new Error("maxChars must be a positive integer");
  }
  if (text.length === 0) {
    return [];
  }

  if (text.length <= maxChars) {
    return [text];
  }

  return scanner(text, maxChars);
}

/**
 * Scans the input text and splits it into chunks based on the specified maximum number of characters.
 * It prefers to break at newline characters, then at spaces, and finally at the maximum character limit.
 * @param text The input text to be scanned and chunked.
 * @param maxChars The maximum number of characters allowed in each chunk.
 * @returns An array of strings, where each string is a chunk of the input text.
 */
function scanner(text: string, maxChars: number): string[] {
  const chunks: string[] = [];
  let startIndex = 0;

  while (startIndex < text.length) {
    let endIndex = startIndex + maxChars;
    if (endIndex >= text.length) {
      chunks.push(text.slice(startIndex));
      break;
    }

    // Prefer to break at a newline character if possible. Search only
    // positions inside the chunk, since endIndex is exclusive.
    const lastNewline = text.lastIndexOf("\n", endIndex - 1);
    if (lastNewline > startIndex) {
      endIndex = lastNewline + 1; // Include the newline character
      chunks.push(text.slice(startIndex, endIndex));
      startIndex = endIndex;
      continue;
    }

    // If no newline is found, try to break at the last space character
    const lastSpace = text.lastIndexOf(" ", endIndex);
    if (lastSpace > startIndex) {
      chunks.push(text.slice(startIndex, lastSpace));
      startIndex = lastSpace + 1;
      continue;
    }

    // If no newline or space is found, break at maxChars
    chunks.push(text.slice(startIndex, endIndex));
    startIndex = endIndex;
  }

  return chunks;
}
