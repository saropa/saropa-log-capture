# Plan 039b — External-change full reload (non-append) for the log viewer

**Split from [039 — Bidirectional sync](history/2026.03/2026.03.01/039_plan-bidirectional-sync.md) on 2026-06-10.** The append-only live-tail half of 039 shipped (see that archived plan); this plan carries only the remaining scope it did not cover.

---

## What already shipped (in 039)

`createTailWatcher` ([log-viewer-provider-load.ts](../src/ui/provider/log-viewer-provider-load.ts)) registers a `FileSystemWatcher` on the open log file and, on `onDidChange`, **appends** newly-written lines to the viewer with a re-entrancy guard (`getTailUpdateInProgress`) so rapid writes don't overlap. This covers the dominant case: a log still being written to by a live session.

## What's missing (this plan)

The watcher only handles **growth**. It early-returns when `contentLines.length <= lastCount`, so it does nothing when the file is:

1. **Truncated / rewritten in place** — an external tool rewrites the log shorter or with different content. The viewer keeps stale lines and silently diverges from disk.
2. **Deleted** — no `onDidDelete` handling; the viewer shows a file that no longer exists.

Also unbuilt from the original 039 scope:

3. **Full-reload path** — re-read the whole file, replace the viewer model, and **preserve scroll** (same line index or relative position) for the truncate/rewrite case where append cannot work.
4. **Settings + prompt** — `saropaLogCapture.reloadOnExternalChange` (default true) and an optional `askBeforeReload` ("File changed on disk. [Reload] [Ignore]") instead of silent auto-reload.

## Implementation outline

- In `createTailWatcher`, detect shrink/rewrite: when `contentLines.length < lastCount` **or** a content hash of the overlap prefix changed, take the full-reload branch instead of the append branch.
- Full reload: re-run the initial load path, then restore scroll via the existing viewport API (same approach the viewer already uses on filter changes).
- Add `onDidDelete` → show a "file was deleted" state (keep the last snapshot read-only; do not clear silently).
- Gate auto vs. prompt on the two new settings; respect the concurrency guard (ignore changes within N ms of our own writes during active capture) so the extension's own appends never trigger a reload loop.

## Considerations

- Reuse the existing debounce / re-entrancy guard — do not add a second watcher.
- Huge files: full reload is expensive; only take it when append is impossible (shrink/rewrite), never on ordinary growth.
