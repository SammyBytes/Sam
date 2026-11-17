import { rm } from "node:fs/promises";

/**
 * Removes a generated `sam-run-*.ts` file.
 *
 * Cleanup is best-effort:
 * - `force` makes an already-deleted (or never-created) file a no-op, so an
 *   external process removing it cannot break the run.
 * - `recursive` enables `maxRetries` for transient lock errors on Windows.
 * - errors are swallowed so cleanup never masks the flow result or error.
 */
export async function cleanupEphemeralFile(tempFile: string): Promise<void> {
  await rm(tempFile, {
    force: true,
    recursive: true,
    maxRetries: 5,
    retryDelay: 100,
  }).catch(() => {});
}
