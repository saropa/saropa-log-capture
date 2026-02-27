NOTE: For maintainability we also have to rename files and methods.
NOTE: For discoverability we need to prefix "SAROPA" in the title of ALL windows that are opened in the main vs code window, e.g. "Cross-Session Insights"

# Terminology Standard

Consistent vocabulary for all user-facing text in Saropa Log Capture.

**Scope:** Commands, settings descriptions, status bar, webview UI, notifications, walkthrough, README, CHANGELOG.
Internal code (class names, variable names) is not required to change, but new code should prefer these terms.

---

## Core Terms

| Term | Meaning | Use for | Never use |
|------|---------|---------|-----------|
| **Log** | A single recorded debug output, from start to finish | The thing you start, stop, rename, tag, clear, export, compare | "session", "capture" (as noun), "recording" (as noun) |
| **Log file** | The `.log` file on disk | The file you open, delete, split, search | "session file", "capture file" |
| **Line** | One text entry in a log | Status bar count, search results, filters | "message", "entry", "output" (for individual items) |
| **Log Viewer** | The main webview component | The panel you read logs in, pop out, interact with | "sidebar", "sidebar viewer" |
| **Panel** | A slide-out section within the Log Viewer | Project Logs panel, Filters panel, Options panel, etc. | "sidebar" (for these sub-sections) |
| **Capture** | The verb/action of recording debug output | "Start/stop capture", "captures debug output" | As a noun for the recorded unit |
| **Recording** | The active capture state | Status bar indicator when a log is being captured | As a noun for the recorded unit |

---

## Command Naming

Commands use the format: `Saropa Log Capture: <Verb> <Object>`

### Current → Proposed

| Current | Proposed | Rationale |
|---------|----------|-----------|
| Start Capture | **Start Capture** | Keep — "capture" is the action verb |
| Stop Capture | **Stop Capture** | Keep |
| Pause/Resume Capture | **Pause/Resume Capture** | Keep |
| Clear Current Session | **Clear Current Log** | "Log" is the noun |
| Open Active Log File | **Open Active Log File** | Already correct |
| Delete Log File | **Delete Log File** | Already correct |
| Split Log File Now | **Split Log File Now** | Already correct |
| Search Log Files | **Search Log Files** | Already correct |
| Rename Session | **Rename Log** | |
| Tag Session | **Tag Log** | |
| Refresh Session History | **Refresh Log History** | |
| Cross-Session Insights | **Cross-Log Insights** | |
| Compare Sessions | **Compare Logs** | |
| Mark for Comparison | **Mark for Comparison** | Already correct |
| Compare with Marked Session | **Compare with Marked Log** | |
| Show Session Timeline | **Show Log Timeline** | |
| Apply Session Template | **Apply Log Template** | |
| Browse Session History | **Browse Log History** | Walkthrough step |

### Tree/Context Menu Commands

| Current | Proposed |
|---------|----------|
| Rename Session | **Rename Log** |
| Tag Session | **Tag Log** |
| Move to Trash | **Move to Trash** (already correct) |
| Restore from Trash | **Restore from Trash** (already correct) |

---

## Settings Naming

Settings use the prefix `saropaLogCapture.`

Existing setting keys (`maxLogFiles`, `logDirectory`, `autoOpen`) are already "log"-based and should **not** change (breaking change for users). Only the **descriptions** need updating to use consistent terminology.

Any setting description that says "session" should say "log" instead.

---

## Webview UI Text

| Location | Current | Proposed |
|----------|---------|----------|
| Session panel header | Project Logs | **Project Logs** (already correct) |
| Session panel empty state | No sessions found | **No logs found** |
| Session panel items | (session metadata) | Refer to each item as a "log" |
| Find in Files placeholder | Search all session files... | **Search all log files...** |
| Filters panel | Log Tags | **Log Tags** (already correct) |
| Session Info panel title | Session Info | **Log Info** |
| Footer line count | N lines | **N lines** (already correct) |
| Flood suppression | Flood-suppressed: N messages | **Flood-suppressed: N lines** |

---

## Status Bar

| State | Current | Proposed |
|-------|---------|----------|
| Active | Recording. Click to open log file | **Recording. Click to open log file** (already correct) |
| Paused | Paused | **Paused** (already correct) |
| Count | N lines | **N lines** (already correct) |

"Recording" is kept as the state indicator — it's universally understood and short.

---

## Documentation

### README
- Use "log" (not "session") when referring to recorded output
- Use "log file" (not "session file") for files
- Use "Log Viewer" (not "sidebar viewer" or "panel viewer") for the webview
- "Capture" only as a verb or in the extension name

### CHANGELOG
- New entries must follow this standard
- Existing entries are not retroactively edited (historical record)

---

## Exceptions

1. **Extension name:** "Saropa Log Capture" — "Capture" is part of the brand, not a term for the recorded unit
2. **Internal code:** Class names like `LogSession`, `SessionManager` do not need renaming (internal only, would be a large refactor with no user benefit)
3. **VS Code API terms:** "Debug session" in VS Code API documentation context is fine since it refers to the VS Code concept, not our concept
4. **DAP terminology:** "DAP output categories" in technical setting descriptions is acceptable
5. **Existing setting keys:** Never rename setting keys (breaks user configs). Only update descriptions.

---

## Quick Reference

When writing user-facing text, ask:

- **What do you start/stop?** → A capture (verb) that produces a **log**
- **What's on disk?** → A **log file**
- **What's one text item?** → A **line**
- **Where do you read logs?** → The **Log Viewer**
- **What are the sub-sections?** → **Panels** (Project Logs panel, Filters panel, etc.)
