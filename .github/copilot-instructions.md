# Copilot & AI Agent Instructions for Saropa Log Capture

## Project Overview

- **Type:** VS Code Extension (TypeScript)
- **Purpose:** Automatically capture Debug Console output to persistent log files, with a real-time sidebar viewer. Works with any debug adapter.
- **Key Directories:**
  - `src/extension.ts`: Extension entry, activation, command registration
  - `src/modules/`: Core logic (capture, session, deduplication, config, file retention)
  - `src/ui/`: Sidebar viewer, webview, status bar, UI logic
  - `reports/`: Log file output (configurable)
  - `test/`: Mocha tests

## Architecture & Data Flow

- **Main flow:** DAP OutputEvent → `tracker.ts` → `deduplication.ts` → `log-session.ts` → file write + UI update
- **Session management:** `session-manager.ts` coordinates lifecycle, history, and metadata
- **Viewer:** Webview (`log-viewer-provider.ts`, `viewer-content.ts`, `viewer-script.ts`) supports virtual scrolling, search, pinning, stack trace folding, and more
- **Settings:** All config is under `saropaLogCapture.*` (see `package.json` and `README.md`)
- **File output:** Immediate-append, crash-safe, ANSI codes preserved, deduplication (e.g. `Error (x54)`)

## Developer Workflows

- **Build:** `npm run compile` (type-check, lint, esbuild)
- **Watch:** `npm run watch` (tsc + esbuild, background)
- **Test:** `npm run test` (Mocha via @vscode/test-cli)
- **Lint:** `npm run lint`
- **Type-check:** `npm run check-types`
- **Debug:** F5 in VS Code (Extension Development Host)
- **Package:** `npm run package`

## Key Patterns & Conventions

- **VS Code API:** Use `vscode.workspace.fs` (not `fs`), register disposables via `context.subscriptions.push()`
- **Commands:** All prefixed `saropaLogCapture.*` (see `package.json`)
- **Settings:** All prefixed `saropaLogCapture.*`
- **Log files:** Written to `reports/` (configurable), with context header and raw ANSI
- **Error handling:** Non-blocking async ops, log to Output Channel, never throw from event handlers
- **Quality:**
  - Functions ≤30 lines, ≤4 params, ≤3 nesting, files ≤300 lines
  - Prefer deletion over abstraction, clarity over cleverness
- **Testing:** Cover edge cases (empty, null, rapid output, crash recovery)

## Integration & Extensibility

- **Activation:** `onDebugAdapterProtocolTracker` (lazy, only when debugging)
- **UI:** Webview-based, uses VS Code theme vars
- **Exports:** HTML (static/interactive), CSV, JSON, JSONL
- **Session tags, deep links, quick search, and more (see README.md for full features)**

## Examples

- To add a new log export format, see `src/modules/export-formats.ts`
- To add a new viewer feature, see `src/ui/viewer-*.ts` and `viewer-script.ts`
- To add a new session metadata field, update `log-session.ts` and `session-metadata.ts`

## References

- See `README.md` for features, settings, and keyboard shortcuts
- See `CLAUDE.md` for detailed architecture and workflow notes
- See `package.json` for commands, settings, and activation events

---

**When in doubt, follow the patterns in `src/modules/` and `src/ui/`, and prefer clarity and simplicity.**
