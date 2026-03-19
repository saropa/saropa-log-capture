# Integration: Application and File Logs

## Implementation status (v1)

- **Tail during session:** `fs.watch` per configured file; new bytes appended after session start are buffered (cap `maxLinesPerFile`). Missing paths are skipped with an output-channel line.
- **Session end:** `externalLogs` provider snapshots buffers, then stops watchers; writes `basename.<label>.log` sidecars (label from `pathToLabel`). Fallback: if no tail buffers (e.g. tailers never started), reads last N lines from each path.
- **Viewer:** Same unified multi-source flow as terminal: discovers `basename.<label>.log` next to the main log (excluding `.terminal.log`); source id `external:<label>`; Filters → Sources checkboxes.
- **Commands:** Add external log path; Open external logs for this session (progress notification when opening multiple files).
- **Unified JSONL (Phase 4, separate setting):** `integrations.unifiedLog.writeAtSessionEnd` writes `basename.unified.jsonl` merging main + terminal + external sidecars; not part of the external-logs adapter toggle.
- **Deferred / not in v1:** `createIfMissing`, `followRotation`, glob paths, status bar “Tailing N files”.

## Problem and Goal

The debuggee is only one source of truth. Many setups use **multiple processes** (API server, worker, frontend dev server) or **external services** that write to **log files** (e.g. `logs/app.log`, `nginx/error.log`, IIS logs). When something fails, developers often need to open several files and mentally align timestamps. This integration allows **tailing or attaching one or more external log files** to the capture workflow so that their content appears **alongside** the Debug Console output—in a unified timeline, a separate panel, or as a merged view—making multi-process and multi-source debugging easier.

**Goal:** Let users configure a list of **log file paths** (relative to workspace or absolute) that the extension will **tail** during an active debug session (and optionally attach to the session on disk). Display options: (1) **interleaved by time** with debug output, (2) **separate panel/tab** per file, or (3) **sidecar files** written next to the main log so that "session X" includes both debug output and snapshots of those files for the same time range.

---

## Data Sources

| Source | Typical path / location | Content |
|--------|--------------------------|---------|
| **App server log** | `logs/app.log`, `logs/combined.log` | Application stdout/stderr or framework logs |
| **Web server** | `logs/nginx/error.log`, `logs/apache/error_log` | HTTP errors, access (if configured) |
| **IIS** | `C:\inetpub\logs\LogFiles\W3SVC*\*.log` | IIS access/error (Windows) |
| **Process-specific** | User-defined | Any text log file the user wants to correlate |
| **Rotated logs** | `app.log`, `app.log.1`, `app.log.2` | Optional: follow rotation (use current file by name) |

All sources are **text files**; no binary log formats in v1. Optional: support **glob** so that "latest" file in a directory can be followed (e.g. `logs/*.log` → pick most recently modified).

---

## Integration Approach

### 1. When to collect

- **Session start:** Resolve configured paths; for each file that exists, start **tailing** (read current content from end or from start, then watch for appends). If file does not exist, optionally create empty or wait until it appears (with a timeout).
- **Session end:** Stop tailing. Optionally write the **accumulated tail** to a sidecar file (e.g. `basename.app.log` or `basename.external.log`) so that the session artifact contains both debug output and the relevant portion of the external log.
- **Continuous:** New lines from tailed files are either (a) merged into a single in-memory timeline with debug lines (and written to a merged stream), or (b) written to separate sidecar files only (simpler), or (c) shown only in the UI (panel) without writing to disk. Recommendation: **(b) separate sidecar per configured file** for clarity and to avoid mixing formats; UI can show "tabs" or "sources" (Debug | app.log | nginx).

### 2. Storage layout

- **Main log:** Unchanged; only DAP Debug Console output.
- **Sidecars:** For each configured path, e.g. `basename.app.log` (or `basename_<sanitized-name>.log`). Content: from session start to session end, all new lines that appeared in that file (with optional prefix `[app.log] ` for clarity if ever merged in viewer). Alternatively, store in a subfolder: `basename_external/app.log`, `basename_external/nginx.log`.

### 3. Viewer experience

- **Tabs or source switcher:** Viewer can show "Debug" (main) and one tab per attached file ("app.log", "nginx"). Each tab has its own virtual scroll and search; no interleaving in storage, but user can switch context.
- **Unified timeline (optional):** If we store a merged stream (all sources with timestamps), viewer could show one timeline with a "source" badge per line (Debug vs app vs nginx). Requires consistent timestamps in external logs (or use "received at" time). More complex; can be phase 2.
- **Open sidecar:** Command "Open external log for this session" → open the sidecar file in editor (same as "Open Windows events").

---

## User Experience

### Settings (under `saropaLogCapture.externalLogs.*`)

| Setting | Type | Default | Description |
|--------|------|--------|-------------|
| `enabled` | boolean | `false` | Enable tailing external log files during session |
| `paths` | string[] | `[]` | Paths relative to workspace root (e.g. `["logs/app.log", "logs/nginx/error.log"]`) |
| `writeSidecars` | boolean | `true` | Write tailed content to sidecar files next to main log |
| `prefixLines` | boolean | `true` | Prefix each sidecar line with source name (e.g. `[app.log] `) for clarity |
| `maxLinesPerFile` | number | `10000` | Cap lines tailed per file (drop oldest if exceeded) |
| `createIfMissing` | boolean | `false` | If path does not exist at session start, create empty file and tail (e.g. for app that creates log on first write) |
| `followRotation` | boolean | `false` | If path is a glob or directory, follow "current" file by mtime (advanced) |

### Commands

- **"Saropa Log Capture: Add external log path"** — Quick input to add a path to `paths` (workspace setting).
- **"Saropa Log Capture: Open external logs for this session"** — Open the sidecar files (or folder) for the current log file in the viewer.

### UI

- **Viewer:** When sidecars exist, show tabs: "Debug" | "app.log" | "nginx" (or single "External" with dropdown). Load content from sidecar files when tab is selected.
- **Status bar:** Optional: "Tailing 2 external logs" during session.

---

## Implementation Outline

### Components

1. **Config and path resolution**
   - Read `saropaLogCapture.externalLogs.paths`; resolve each path with `vscode.workspace.workspaceFolders[0].uri` (or multi-root: first folder). Support absolute paths if path starts with `/` or `C:\` (document behavior). Validate: only regular files (no directories unless we support glob).

2. **File tailer**
   - **Node:** Use `fs.watch` on each path (or `fs.open` + periodic read from current position). On append, read new data, split lines, push to a buffer. Respect `maxLinesPerFile` (circular buffer or drop oldest). On session end, flush buffer to sidecar.
   - **VS Code:** Prefer `vscode.workspace.fs` for reading; but tailing requires watching file changes—use Node `fs.watch` for now (workspace.fs has no watch). Alternatively, use `FileSystemWatcher` (vscode.workspace.createFileSystemWatcher) for file change, then read with workspace.fs.
   - **Encoding:** UTF-8; skip or replace invalid bytes. Optional setting for encoding later.
   - **New file:** If `createIfMissing` and file does not exist, create via workspace.fs and then watch (or watch parent directory for creation).

3. **Sidecar writer**
   - When session ends (or on split?), for each tailed file write content to `basename_<label>.log` in the same folder as the main log. Label = sanitized filename (e.g. `app` for `app.log`). Use same `LogSession` folder (date-based). Write once at session end; no need to stream (simpler).

4. **Viewer**
   - When opening a log file, check for sidecars: list files matching `basename_*.log` (or read from `.meta.json` if we store list there). Add tabs or dropdown; load sidecar content via extension (read file, send to webview) and render in same virtual-scroll component (reuse existing viewer script).

5. **Session lifecycle**
   - In session start (after LogSession is created), start tailers for each path. Pass a callback or event to push "external line" to a buffer; on session end, stop tailers and write sidecars. If session splits (file split), decide: one set of sidecars per part or one for whole session. Simpler: one set per session (append to same sidecar until session end).

### Performance and safety

- **Memory:** Cap `maxLinesPerFile`; avoid holding huge files in memory.
- **Disk:** Sidecars can be large; same retention as main logs (user’s retention policy).
- **Missing files:** Do not fail session; log to Output Channel "External log not found: path" and continue.
- **Permissions:** Read-only for tailing; write only to reports/ (or configured log dir).

---

## Configuration Summary

- **Extension settings:** `saropaLogCapture.externalLogs.*` as above.
- **Workspace:** `paths` is typically workspace-specific (different projects, different log locations).

---

## Risks and Alternatives

| Risk | Mitigation |
|------|------------|
| Tailed file very large at start | Option: "tail from end" at start (only new lines); or "last N lines" and then tail |
| Many files | Limit to e.g. 5 paths; document |
| Log rotation during session | Option `followRotation`: watch directory, switch to new file when current is rotated |
| Binary or non-UTF-8 log | UTF-8 only; replace invalid; document |

**Alternatives:**

- **Merge into single log:** Write one file with interleaved lines and timestamps. Requires parsing timestamps from external logs; more complex.
- **No disk, UI only:** Show tailed content only in viewer during session; do not write sidecars. Lighter but no history for past sessions.
- **Terminal output:** See Terminal Output integration for capturing Integrated Terminal; that’s a different source (terminal vs file).

---

## References

- Existing: `log-session.ts`, session lifecycle, file splitter. No existing file tailer.
