/**
 * Pure helper for pop-out hydration: after loading the log from disk, live lines that arrived
 * during the async load must be replayed without duplicating lines already in the snapshot.
 * Session `lineCount` aligns with main log content line count for the cutoff.
 */

/** Pick deferred live lines to append after a disk snapshot (see PopOutPanel.runHydrationFromDisk). */
export function filterDeferredLinesAfterSnapshot<T extends { lineCount: number }>(
  deferred: readonly T[],
  loadedContentLength: number | undefined,
): T[] {
  if (loadedContentLength === undefined) {
    return [...deferred];
  }
  return deferred.filter((d) => d.lineCount > loadedContentLength);
}
