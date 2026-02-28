# Integration: Crash Dumps

## Problem and Goal

When the debuggee **crashes** (native crash, unhandled exception, or OOM), the Debug Console may show a last message, but the **full picture** is often in a **crash dump** (minidump on Windows, core dump on Linux, or .dmp/.core files). Developers need to know "was a dump generated?" and "where is it?" so they can open it in a debugger or send it for analysis. This integration **discovers and links crash dumps** that were created during (or shortly after) the session time window and attaches that information to the session—so that the header or a panel lists dump files and provides "Open folder" or "Open in WinDbg" links.

**Goal:** (1) **Discover dumps:** At session end (or on demand), scan configured **directories** (e.g. workspace, temp, user AppData) for crash dump files (`.dmp`, `.mdmp`, `.core`) whose **modified time** (or creation time) falls within the session time range (with optional lead/lag). (2) **Attach to session:** Store list of found paths (or copy dumps into session folder for archival). (3) **Display:** Add "Crash dumps: 2 found" and list (or link) in header or viewer; command to open folder or open the dump in the default handler (e.g. WinDbg).

---

## Data Sources

| Source | Location (examples) | File types |
|--------|---------------------|------------|
| **Windows** | %LOCALAPPDATA%\CrashDumps, %TEMP%, workspace | .dmp, .mdmp |
| **Linux / WSL** | /var/crash, workspace, cwd | .core, .dmp |
| **Node** | process.cwd(), NODE_OPTIONS=--enable-dump (dir) | .dmp (Node can write minidumps) |
| **.NET** | Same as Windows; created by runtime | .dmp, .mdmp |
| **User config** | Custom paths in settings | Any extension user specifies |

We do **not** create or trigger dumps; we only **find** existing files by path/pattern and mtime.

---

## Integration Approach

### 1. When to discover

- **Session end:** When session ends, compute time range: session start minus lead (e.g. 1 min) to session end plus lag (e.g. 5 min). Scan configured directories for files matching extensions (`.dmp`, `.mdmp`, `.core`) and mtime in range. Collect list of absolute paths (and optionally file sizes).
- **On demand:** Command "Saropa Log Capture: Find crash dumps for this session" re-runs the scan and updates sidecar/meta.

### 2. Where to store and display

- **Sidecar:** `basename.crash-dumps.json`: `{ found: [ { path, size, mtime } ] }`. Or just list paths in `.meta.json` under `crashDumps: string[]`.
- **Header:** One line: `Crash dumps: 2 (see basename.crash-dumps.json or Open folder)`. Or no header line if none found.
- **Viewer:** "Crash dumps" section when any found: list filenames with "Open" and "Open folder" buttons (VS Code: open file, or reveal in explorer). Optional: "Copy path."

### 3. Copy vs link

- **Link only (default):** Store paths; do not copy. Dumps can be large; user may have their own retention. Viewer shows "Open" (open file in default app) and "Reveal in File Explorer."
- **Copy (optional):** Setting "copyDumpsToSession: true" copies each dump into session folder (e.g. `basename_crash_1.dmp`) so that the session folder is self-contained. Risk: large files; document.

---

## User Experience

### Settings (under `saropaLogCapture.crashDumps.*`)

| Setting | Type | Default | Description |
|--------|------|--------|-------------|
| `enabled` | boolean | `false` | Enable crash dump discovery |
| `searchPaths` | string[] | `["${workspaceFolder}", "${env:LOCALAPPDATA}/CrashDumps", "${env:TEMP}"]` | Paths to scan; support vars |
| `extensions` | string[] | `[".dmp", ".mdmp", ".core"]` | File extensions to consider |
| `leadMinutes` | number | `1` | Minutes before session start to include file mtime |
| `lagMinutes` | number | `5` | Minutes after session end |
| `maxFiles` | number | `20` | Cap number of dumps to list |
| `copyToSession` | boolean | `false` | Copy found dumps into session folder (can be large) |
| `includeInHeader` | boolean | `true` | Add "Crash dumps: N" line when any found |

### Commands

- **"Saropa Log Capture: Find crash dumps for this session"** — Run discovery and update sidecar/meta; show result.
- **"Saropa Log Capture: Open crash dump folder"** — Open the folder containing the first (or selected) dump; or session folder if dumps were copied.
- **"Saropa Log Capture: Open crash dump"** — Quick pick of found dumps; open selected file (VS Code or default app).

### UI

- **Viewer:** When `crashDumps` in meta/sidecar has entries, show "Crash dumps (2)" with list; each item: "Open" | "Reveal in folder."

---

## Implementation Outline

### Components

1. **Path expansion**
   - Expand `searchPaths`: replace `${workspaceFolder}` with first workspace folder path; `${env:VAR}` with process.env.VAR. Support multiple workspace folders (e.g. first one, or all). Skip missing or invalid paths.

2. **Scanner**
   - For each expanded path, use `vscode.workspace.fs` or Node `fs` to read directory (recursive if desired; or one level only for known flat dirs like CrashDumps). For each file, check extension (case-insensitive) and mtime. If mtime in [sessionStart - lead, sessionEnd + lag], add to list. Sort by mtime; take first maxFiles.
   - **Performance:** Avoid scanning huge trees; limit depth (e.g. 2) or only scan known crash dirs by default. Document.

3. **Session end hook**
   - When session ends, if `crashDumps.enabled`, run scanner with session start/end from session lifecycle. Write result to `basename.crash-dumps.json` or merge into `.meta.json`. If copyToSession, copy each file to session folder with unique name; store copied paths in meta.

4. **Viewer**
   - Read sidecar/meta; if crashDumps.length > 0, show section with list. "Open" → `vscode.env.openExternal(vscode.Uri.file(path))` or `vscode.commands.executeCommand('vscode.open', uri)`. "Reveal" → `vscode.commands.executeCommand('revealInExplorer', uri)`.

5. **Header**
   - If includeInHeader and we have count (from sync write at end, or from meta when opening), append line. Challenge: header is written at session start; crash dumps are found at session end. So header can’t include count unless we support "append to header" or a "post-session header block." Simpler: don’t put count in main header; only in viewer when opening the log (from meta/sidecar) and in "Crash dumps" section.

---

## Configuration Summary

- **Extension settings:** `saropaLogCapture.crashDumps.*` as above.
- **Variables:** Document supported vars in searchPaths (workspaceFolder, env:VAR).

---

## Risks and Alternatives

| Risk | Mitigation |
|------|------------|
| Large directories | Limit depth; cap maxFiles; only scan configured paths |
| Sensitive dumps | Dumps can contain memory; document; do not auto-upload |
| Cross-platform paths | Use path expansion; Windows vs Linux paths for env (e.g. LOCALAPPDATA vs XDG) |
| Dump from other process | mtime window may include unrelated dumps; user can delete from list or narrow paths |

**Alternatives:**

- **No copy:** Always link only; avoid disk use.
- **Manual attach:** User runs "Attach crash dump" and picks file; we add to session meta. No auto-scan.

---

## References

- Windows CrashDumps: [LOCALAPPDATA\CrashDumps](https://docs.microsoft.com/en-us/windows/win32/wer/collecting-user-mode-dumps)
- Existing: session lifecycle (end event), meta/sidecar pattern, viewer sections.
