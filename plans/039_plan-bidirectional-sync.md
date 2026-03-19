# Plan: Bidirectional sync (reload/merge when log file is modified externally)

**Feature:** When the log file is modified on disk (e.g. by another process or tool), reload or merge the changes into the viewer so the user always sees up-to-date content.

---

## What exists

- Viewer loads log content from file URI; possibly one-time load or load on open.
- File system watchers may exist elsewhere (e.g. for session list refresh).
- Session and log file path resolution.

## What's missing

1. **File watcher** — Watch the current log file (or session’s primary log file) for changes (create, change, delete) using `vscode.workspace.createFileSystemWatcher` or `fs.watch`.
2. **Reload or merge** — On change: either full reload (re-read file and replace viewer content) or incremental merge (append new lines, optional conflict handling if lines were edited).
3. **UX** — Avoid overwriting user’s scroll position or selection unnecessarily. Option: "File changed on disk. [Reload] [Ignore]"; or auto-reload with scroll preservation (e.g. keep same line index in view).
4. **Large files** — If file is tailed (e.g. still being written), only new content may be appended; support append-only merge to avoid re-reading entire file.

## Implementation

### 1. Watch

- When viewer opens a log URI, register a FileSystemWatcher for that path (or parent directory + filter). On `onDidChange`/`onDidCreate`, decide: reload or merge.
- Debounce rapid events (e.g. save every second) to a single "content changed" action.

### 2. Reload

- Read file contents (or from byte offset if append-only); parse lines; replace viewer model and re-render. Restore scroll to same line index or same relative position (e.g. 80% down).
- If file deleted: show "File was deleted" and optionally close or keep last snapshot read-only.

### 3. Merge (optional)

- For append-only: read from last known length to EOF; append new lines to viewer model; optionally auto-scroll to bottom.
- For arbitrary edits: full reload is simpler; merge (diff and patch) is complex and may be out of scope for MVP.

### 4. Settings

- `saropaLogCapture.reloadOnExternalChange` (default true); optional "Ask before reload" (default false) to show prompt instead of auto-reload.

## Files to create/modify

| File | Change |
|------|--------|
| Viewer provider or content loader | Register file watcher for current log URI; dispose on close |
| Reload/merge logic | On change: read file (or tail); update viewer model; preserve scroll |
| Optional: prompt | "File changed. Reload?" when ask-before-reload is true |
| `package.json` / settings | reloadOnExternalChange; askBeforeReload |

## Considerations

- Performance: avoid reloading huge file on every small write; debounce and, for append-only, prefer tail read.
- Concurrency: if extension also writes to the file (e.g. during capture), avoid feedback loop (watch fires on our write). Consider ignoring changes within N ms of our last write, or only watch when viewer is read-only.

## Effort

**3–5 days** for reload with scroll preservation; **+2–3 days** for append-only merge and ask-before-reload.
