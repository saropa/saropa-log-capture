# Application and File Logs — Advanced (follow-up) — COMPLETE

> **Status: COMPLETE (2026-06-14).** All four items below shipped. See the
> Finish Report at the end. This plan is archived to history.



The External Logs integration shipped its v1 (tail configured files during a
session, write `basename.<label>.log` sidecars, multi-source viewer, the
**Add external log path** / **Open external logs** commands, and unified-JSONL
merge). That plan is complete and archived under
`history/2026.06/2026.06.14/application-file-logs.md`.

This follow-up tracks the items v1 deliberately deferred. None are started; each
is optional/advanced and independent of the others.

## Deferred items

1. **`createIfMissing`** — when a configured path does not exist at session
   start, create an empty file (or watch the parent directory for its creation)
   and begin tailing once it appears. For apps that only create their log on
   first write. Needs a new boolean setting + a parent-directory watch fallback
   in `external-log-tailer.ts`.

2. **`followRotation`** — when the tailed file is rotated mid-session
   (`app.log` → `app.log.1`, new `app.log` created), detect the truncation/inode
   change and continue tailing the current file by name. Watch the directory,
   not just the file handle. Needs a new boolean setting and rotation detection
   in the tailer's read loop.

3. **Glob / "latest file" paths** — allow a configured path to be a glob
   (`logs/*.log`) and tail the most-recently-modified match, re-resolving when a
   newer file appears. Pairs with `followRotation`. Needs glob resolution at
   start + on directory-change.

4. **Status-bar "Tailing N files" indicator** — a small status-bar item shown
   while external-log tailers are active during a session, cleared at session
   end. Pure affordance; the lightest of the four. Mirror the existing
   status-bar item lifecycle.

## Notes

- All four touch `external-log-tailer.ts` (the singleton fs.watch tailer) and/or
  `IntegrationExternalLogsConfig`; items 1–3 add settings and must extend the
  existing config struct (not new top-level params).
- Keep the read-only-for-tailing, write-only-to-the-log-dir safety posture from
  v1. Missing/unreadable files must never fail session end.

---

## Finish Report (2026-06-14)

### Scope
VS Code extension (TypeScript). Two new settings, one new status-bar item, and
a restructure of the external-log tailer. No Flutter/Dart code.

### What shipped
The External Logs tailer was a single monolithic function that watched one
fixed, already-existing file per path and could not handle a log that appeared
late, rotated, or was addressed by a wildcard. It is now split into a per-file
`TailWorker` plus a glob resolver, covering all four deferred cases.

- **Glob / latest-file paths** (`external-log-glob.ts`): a configured path whose
  final segment contains `*`/`?` resolves to the most recently modified match in
  the literal directory. Pure `isGlobPattern`/`globToRegExp`/`pickLatestMatch`
  are separated from fs access for unit testing; `resolveExternalLogPath` is
  used by both the tailer and the session-end fallback so they agree.
- **createIfMissing** (`integrations.externalLogs.createIfMissing`): for a
  concrete (non-glob) path that does not exist at session start, an empty file
  (and parent directories) is created so the app can append immediately;
  creation failure logs and falls back to watching the directory for appearance.
- **followRotation** (`integrations.externalLogs.followRotation`): the
  `TailWorker` detects inode change (recreated file) and size shrink
  (truncation), re-tailing from the new start, and — for glob paths — switches
  to a newer match when one appears. A parent-directory watch backs the
  per-file watch so renames are caught.
- **Status-bar indicator** (`external-log-tail-status.ts`): a dedicated
  "Tailing N logs" item, driven by the tailer's active-count callback, shown
  while files are attached and disposed at session end.

### Architecture
- `external-log-tailer.ts` is now an orchestrator: it resolves paths, owns the
  buffers/worker list/debounce timers, and exposes the unchanged public API
  (`startExternalLogTailers`, `stopExternalLogTailers`, `getExternalLogBuffers`,
  `pathToLabel`). The per-file mechanics live in `TailWorker`.
- `startExternalLogTailers` dropped its redundant `paths` parameter (it reads
  `config.paths`) and gained an optional active-count callback; the lifecycle
  passes the status updater, and finalize disposes the status item alongside the
  existing tailer/logcat/db-tail teardown.

### Verification
- `npm run compile` — clean (types, lint, NLS parity + coverage, all catalogs,
  bundle).
- Tests: `external-log-glob` (7 new), `external-log-tailer` pathToLabel (3,
  unchanged), `integration-settings-manifest` (6) all pass. The fs.watch-driven
  worker behavior is exercised manually (see handoff), not in unit tests.

### Notes
- New `.title` keys synced across all `package.nls.*` locales; nls-coverage data
  regenerated. Runtime `statusBar.tailingLogs` strings added to `strings-a.ts`.
- The two new booleans were added to the existing `IntegrationExternalLogsConfig`
  struct (not as parallel parameters), per the extend-the-inventory rule.

### Status
COMPLETE — all four deferred items shipped. Archived to history.
