# Application and File Logs — Advanced (follow-up)

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
