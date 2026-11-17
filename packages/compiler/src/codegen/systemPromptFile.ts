import { readFileSync, realpathSync, statSync } from "node:fs";
import { extname, isAbsolute, relative, resolve, sep } from "node:path";

export const MAX_SYSTEM_PROMPT_FILE_BYTES = 256 * 1024;

const ALLOWED_EXTENSIONS = new Set([".md", ".markdown"]);

const BINARY_SIGNATURES: Array<{ name: string; bytes: number[] }> = [
  { name: "ELF", bytes: [0x7f, 0x45, 0x4c, 0x46] },
  { name: "PNG", bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { name: "JPEG", bytes: [0xff, 0xd8, 0xff] },
  { name: "GIF", bytes: [0x47, 0x49, 0x46, 0x38] },
  { name: "PDF", bytes: [0x25, 0x50, 0x44, 0x46, 0x2d] },
  { name: "ZIP", bytes: [0x50, 0x4b, 0x03, 0x04] },
  { name: "ZIP", bytes: [0x50, 0x4b, 0x05, 0x06] },
  { name: "ZIP", bytes: [0x50, 0x4b, 0x07, 0x08] },
  { name: "gzip", bytes: [0x1f, 0x8b] },
  { name: "bzip2", bytes: [0x42, 0x5a, 0x68] },
  { name: "XZ", bytes: [0xfd, 0x37, 0x7a, 0x58, 0x5a, 0x00] },
  { name: "7-Zip", bytes: [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c] },
  { name: "RAR", bytes: [0x52, 0x61, 0x72, 0x21, 0x1a, 0x07] },
  {
    name: "SQLite",
    bytes: [
      0x53, 0x51, 0x4c, 0x69, 0x74, 0x65, 0x20, 0x66, 0x6f, 0x72, 0x6d,
      0x61, 0x74, 0x20, 0x33, 0x00,
    ],
  },
  { name: "Mach-O", bytes: [0xfe, 0xed, 0xfa, 0xce] },
  { name: "Mach-O", bytes: [0xfe, 0xed, 0xfa, 0xcf] },
  { name: "Mach-O", bytes: [0xce, 0xfa, 0xed, 0xfe] },
  { name: "Mach-O", bytes: [0xcf, 0xfa, 0xed, 0xfe] },
  { name: "Java class", bytes: [0xca, 0xfe, 0xba, 0xbe] },
  { name: "OLE", bytes: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1] },
  { name: "TIFF", bytes: [0x49, 0x49, 0x2a, 0x00] },
  { name: "TIFF", bytes: [0x4d, 0x4d, 0x00, 0x2a] },
  { name: "LZ4", bytes: [0x04, 0x22, 0x4d, 0x18] },
  { name: "Zstandard", bytes: [0x28, 0xb5, 0x2f, 0xfd] },
  { name: "RIFF", bytes: [0x52, 0x49, 0x46, 0x46] },
  { name: "PSD", bytes: [0x38, 0x42, 0x50, 0x53] },
  { name: "FLAC", bytes: [0x66, 0x4c, 0x61, 0x43] },
  { name: "Ogg", bytes: [0x4f, 0x67, 0x67, 0x53] },
  { name: "WOFF", bytes: [0x77, 0x4f, 0x46, 0x46] },
  { name: "WOFF2", bytes: [0x77, 0x4f, 0x46, 0x32] },
];

// C0 controls other than tab, LF, and CR. CR is normalized before this check.
const FORBIDDEN_CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u;
// Bidirectional overrides can disguise prompt text; reject them outright.
const BIDI_CONTROL_CHARS = /[\u202A-\u202E\u2066-\u2069]/u;

export class SystemPromptFileError extends Error {
  constructor(message: string) {
    super(`CodegenError: ${message}`);
    this.name = "SystemPromptFileError";
  }
}

function startsWithBytes(bytes: Uint8Array, signature: number[]): boolean {
  if (bytes.length < signature.length) return false;
  return signature.every((byte, index) => bytes[index] === byte);
}

function detectBinaryReason(bytes: Uint8Array): string | null {
  if (bytes.includes(0)) return "it contains NUL bytes";

  for (const signature of BINARY_SIGNATURES) {
    if (startsWithBytes(bytes, signature.bytes)) {
      return `it matches the ${signature.name} binary signature`;
    }
  }

  return null;
}

function assertRelativePath(filePath: string): void {
  if (!filePath.trim()) {
    throw new SystemPromptFileError("'system_prompt_file' cannot be empty.");
  }
  if (filePath.includes("\0")) {
    throw new SystemPromptFileError(
      "'system_prompt_file' contains an invalid NUL character.",
    );
  }
  if (
    isAbsolute(filePath) ||
    /^[A-Za-z]:[\\/]/.test(filePath) ||
    filePath.startsWith("\\\\")
  ) {
    throw new SystemPromptFileError(
      `'system_prompt_file' must be a relative path inside the .sb source directory, got '${filePath}'.`,
    );
  }
}

function assertMarkdownExtension(filePath: string): void {
  if (!ALLOWED_EXTENSIONS.has(extname(filePath).toLowerCase())) {
    throw new SystemPromptFileError(
      `'system_prompt_file' only supports Markdown files (.md or .markdown), got '${filePath}'.`,
    );
  }
}

function assertInsideBase(baseDir: string, targetPath: string): void {
  const relativePath = relative(baseDir, targetPath);
  const escapesBase =
    relativePath === ".." ||
    relativePath.startsWith(`..${sep}`) ||
    isAbsolute(relativePath);

  if (relativePath === "" || escapesBase) {
    throw new SystemPromptFileError(
      "'system_prompt_file' must resolve inside the .sb source directory.",
    );
  }
}

/**
 * Loads and sanitizes a Markdown system prompt file.
 *
 * Security constraints:
 * - only relative `.md` / `.markdown` paths
 * - the resolved real path must stay inside `sourceDir` (symlinks included)
 * - maximum size of 256 KiB
 * - rejects NUL bytes, known binary signatures, invalid UTF-8, control
 *   characters, and bidirectional override characters
 * - strips a UTF-8 BOM and normalizes CRLF/CR to LF
 */
export function loadSystemPromptFile(
  filePath: string,
  sourceDir: string,
): string {
  assertRelativePath(filePath);
  assertMarkdownExtension(filePath);

  const baseDir = realpathSync(resolve(sourceDir));
  const candidatePath = resolve(baseDir, filePath);
  assertInsideBase(baseDir, candidatePath);

  let realPath: string;
  try {
    realPath = realpathSync(candidatePath);
  } catch {
    throw new SystemPromptFileError(
      `Cannot read 'system_prompt_file' '${filePath}': file not found.`,
    );
  }

  assertInsideBase(baseDir, realPath);
  assertMarkdownExtension(realPath);

  const stats = statSync(realPath);
  if (!stats.isFile()) {
    throw new SystemPromptFileError(
      `'system_prompt_file' '${filePath}' is not a regular file.`,
    );
  }
  if (stats.size > MAX_SYSTEM_PROMPT_FILE_BYTES) {
    throw new SystemPromptFileError(
      `'system_prompt_file' '${filePath}' exceeds the ${MAX_SYSTEM_PROMPT_FILE_BYTES}-byte limit.`,
    );
  }

  const bytes = new Uint8Array(readFileSync(realPath));
  if (bytes.length > MAX_SYSTEM_PROMPT_FILE_BYTES) {
    throw new SystemPromptFileError(
      `'system_prompt_file' '${filePath}' exceeds the ${MAX_SYSTEM_PROMPT_FILE_BYTES}-byte limit.`,
    );
  }

  const binaryReason = detectBinaryReason(bytes);
  if (binaryReason) {
    throw new SystemPromptFileError(
      `'system_prompt_file' '${filePath}' is not Markdown: ${binaryReason}.`,
    );
  }

  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new SystemPromptFileError(
      `'system_prompt_file' '${filePath}' is not valid UTF-8 text.`,
    );
  }

  text = text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");

  if (FORBIDDEN_CONTROL_CHARS.test(text)) {
    throw new SystemPromptFileError(
      `'system_prompt_file' '${filePath}' contains control characters.`,
    );
  }
  if (BIDI_CONTROL_CHARS.test(text)) {
    throw new SystemPromptFileError(
      `'system_prompt_file' '${filePath}' contains bidirectional control characters.`,
    );
  }

  const sanitized = text.trim();
  if (!sanitized) {
    throw new SystemPromptFileError(
      `'system_prompt_file' '${filePath}' is empty.`,
    );
  }

  return sanitized;
}
