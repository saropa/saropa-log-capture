/**
 * Pure tail-change classification for the log viewer's live follow (plan 039b).
 *
 * Kept free of the VS Code API so the grow/shrink/equal decision is unit-testable without the
 * Extension Host. The file-reading wrapper that acts on this lives in `log-viewer-provider-load.ts`.
 */

/** What a tail `onDidChange` should do, decided purely from the before/after content-line counts. */
export type TailChangeAction = "append" | "reload" | "noop";

/**
 * Classify a tail change. Growth → append the new lines; shrink → the file was truncated/rewritten
 * and append can't represent it, so full reload; equal → the watcher fired on a metadata-only touch,
 * nothing to do.
 */
export function classifyTailChange(prevCount: number, newCount: number): TailChangeAction {
  if (newCount < prevCount) {
    return "reload";
  }
  if (newCount === prevCount) {
    return "noop";
  }
  return "append";
}
