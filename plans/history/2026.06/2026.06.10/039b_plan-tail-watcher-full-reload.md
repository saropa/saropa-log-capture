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

---

## Finish Report (2026-06-10)

**Status: Implemented.** **This work will be reviewed by another AI.**

### Scope
(B) VS Code extension (TypeScript). No Flutter/Dart.

### What shipped
The single tail watcher now classifies every `onDidChange` and acts accordingly, reusing the existing re-entrancy guard (no second watcher):

- **Growth → append** (unchanged live-tail).
- **Shrink (truncate/rewrite) → full reload** — `clear()` + re-read + re-tail via the provider's existing `loadFromFile(uri, {tail:true})`.
- **Recreate** (`onDidCreate`, for tools that unlink-then-write) → treated as an external rewrite → reload.
- **Delete** (`onDidDelete`) → keep the last in-memory snapshot (viewer not blanked) + warn.

Two settings gate it: `reloadOnExternalChange` (default **on** — the escape hatch) and `reloadPromptOnExternalChange` (default **off** — shows "File changed on disk. Reload?" instead of reloading silently).

### Files
- **New:** `src/ui/provider/tail-change-classify.ts` (pure `classifyTailChange` → `append|reload|noop`), `src/ui/provider/log-viewer-provider-external-reload.ts` (`reloadOnExternalChange` policy + `warnExternalDelete`), `src/test/ui/tail-change-classify.test.ts` (6 cases).
- **Modified:** `log-viewer-provider-load.ts` (watcher: hooks param, shrink/recreate/delete branches, extracted `appendTailLines`/`handleTailChange`, `TailExternalHooks`/`TailWatcherOptions`), `log-viewer-provider-tailing.ts` (builds the hooks from the target), `log-viewer-provider.ts` (added `loadFromFile` to the tail-target interface contract; no new methods — kept under the 325-line cap by injecting behavior as hooks), `config-types.ts` + `config.ts` (two readers), `package.json` (two settings), 11 `package.nls*.json` (4 keys), `strings-a.ts` (4 runtime strings), `CHANGELOG.md`, `plans/guides/configuration.md`.

### Key design decisions
- **Hooks, not provider methods:** the reload/delete behavior is injected into `createTailWatcher` via a `TailExternalHooks` object built in the tailing helper, rather than added as `LogViewerProvider` methods. This kept the already-at-ceiling provider file under its 325-line limit and decouples the watcher from the reload machinery (a 5th positional param would have breached the 4-param limit, so inputs are bundled in `TailWatcherOptions`).
- **Pure decision function:** the grow/shrink/equal logic lives in a vscode-free module so it is unit-testable under `node --test` (the rest of the watcher needs the Extension Host).
- **Equal-length rewrite is a known gap:** a rewrite that preserves the exact line count is treated as no-op (we don't hash content). Logs almost never rewrite to an identical line count; documented rather than paying a per-change hash.

### Quality gates
- `check-types` clean; `lint` clean on all touched files (provider back under 325 lines after the hooks refactor); `compile` passes (verify-nls 483 keys × 11, verify:list-commands, dist-size, catalogs).
- `node --test tail-change-classify.test.js` — 6/6 pass. `test:file log-viewer-provider-load.test.js` (vscode harness, `executeLoadContent` unchanged) — 2/2 pass.

### Test audit (Section 4A)
Grepped `src/test/` for every changed symbol. Only the new `tail-change-classify.test.ts` references them. `log-viewer-provider-load.test.ts` imports `executeLoadContent` (untouched) — ran it, green. No config-shape test pins the key set, so the two new settings break nothing.

### Out of scope (by design, not buried)
- **Scroll-position preservation across a full reload** — a truncate/rewrite changes the content, so resetting to top is the correct result, not a missing feature. Append (the common live case) never disturbs scroll.
- **Equal-length in-place rewrite detection** (see above).
