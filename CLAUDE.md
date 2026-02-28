# Claude Code Instructions - Saropa Log Capture

## Project Overview

VS Code extension that automatically captures Debug Console output to persistent log files on disk, with a real-time sidebar viewer. Works with **any** debug adapter (Dart, Node, Python, C++, Go, etc.).

**Type:** VS Code Extension (TypeScript)
**License:** MIT
**Publisher:** saropa
**Bundler:** esbuild
**Test Framework:** Mocha via @vscode/test-cli

## Key Files & Structure

| Category | Location | Purpose |
|----------|----------|---------|
| **Extension entry** | `src/extension.ts` | Activation, wiring, command registration |
| **Core capture** | `src/modules/capture/tracker.ts`, `log-session.ts`, `deduplication.ts`, `ansi.ts` | DAP capture, session buffer, dedup, ANSI |
| **Session** | `src/modules/session/session-manager.ts`, `session-event-bus.ts`, `log-session.ts` in capture | Session lifecycle, event bus, file writer |
| **Config** | `src/modules/config/config.ts`, `file-retention.ts`, `gitignore-checker.ts` | Settings, retention, .gitignore |
| **Status bar** | `src/ui/shared/status-bar.ts` | Live counter, recording indicator |
| **Log viewer** | `src/ui/provider/log-viewer-provider.ts` | WebviewViewProvider for sidebar panel |
| **Viewer content** | `src/ui/provider/viewer-content.ts` | Webview HTML assembly (imports styles + script) |
| **Viewer styles** | `src/ui/viewer-styles/viewer-styles.ts` | Webview CSS styles |
| **Viewer script** | `src/ui/viewer/viewer-script.ts` | Webview JS (virtual scrolling, stack traces) |
| **Tests** | `src/test/` (e.g. `test/modules/`, `test/ui/`) | Extension tests |
| **Build config** | `esbuild.js`, `tsconfig.json` | Build pipeline |
| **Extension manifest** | `package.json` | Commands, settings, activation events |

## Current Status

**MVP complete** — Stages 1-3 plus post-MVP iterations A-D are implemented.

Completed features include: headless capture, live sidebar viewer with ANSI colors, virtual scrolling (100K+ lines), collapsible stack traces, search/filter, click-to-source, session history, keyword watch with alerts, pinning, exclusions, copy formats, session tagging, timing markers, and stack trace intelligence.

## Commands

| Command | Purpose |
|---------|---------|
| `npm run compile` | Type-check + lint + esbuild |
| `npm run check-types` | TypeScript type checking only |
| `npm run lint` | ESLint |
| `npm run package` | Production build |
| `npm run test` | Run tests via @vscode/test-cli |
| `npm run watch` | Watch mode (esbuild + tsc) |

## Workflow

### 1. Before Writing Code
- Understand the data flow: DAP OutputEvent → Tracker → Dedup → LogSession → File + UI
- Review existing code patterns in `src/modules/` and `src/ui/`

### 2. Implementation
- Follow TypeScript strict mode conventions
- Use VS Code API patterns (disposables, subscriptions, event emitters)
- Immediate-append file writes (never buffer entire session)
- Preserve raw ANSI escape codes in .log files
- All settings prefixed with `saropaLogCapture.`

### 3. Verification
- `npm run check-types` — zero errors
- `npm run lint` — zero warnings
- `npm run compile` — successful build
- Test in Extension Development Host (F5)

### 4. Commit
- Atomic commits (one logical change)
- Include Co-Authored-By line
- Update CHANGELOG.md

## Design Principles

1. **Zero Friction** — Works on install, no config needed
2. **One Problem, Perfectly** — Capture debug output, nothing else
3. **Never Lose Data** — Immediate-append writes, crash-safe
4. **Respect the Host** — Native VS Code patterns, --vscode-* CSS vars
5. **Performance is a Feature** — Virtual scrolling, batched updates, streaming writes

## Key Patterns

### VS Code Extension Patterns
- Register disposables via `context.subscriptions.push()`
- Use `vscode.workspace.fs` for file operations (not `fs` module)
- Activation via `onDebugAdapterProtocolTracker` (lazy)
- Commands prefixed `saropaLogCapture.*`
- Settings prefixed `saropaLogCapture.*`

### Error Handling
- Non-blocking async operations with `.catch()` for non-critical tasks
- Output channel (`Saropa Log Capture`) for diagnostic logging
- Never throw from event handlers — log and continue

### File Output
- Log directory: `reports/` (relative to workspace root, configurable)
- ANSI codes preserved in .log files (external tools render them)
- Context header as first block in every log file
- Deduplication: `Error (x54)` instead of 54 identical lines

## Webview Patterns

### Keyboard Shortcuts
- All keyboard handlers live in `viewer-script.ts` inside a single `keydown` listener
- Guard against input elements first: `if (e.target instanceof HTMLInputElement) return;`
- Ctrl/Cmd shortcuts (Ctrl+A, Ctrl+G, Ctrl+=, etc.) go before the plain-key `else if` chain
- Plain keys (F3, PgUp, PgDn, W, A, P, N) go in the `else if` chain
- Always `e.preventDefault()` and `return` for consumed shortcuts

### Context Menu
- `viewer-context-menu.ts` owns all right-click menu HTML and script
- Use `data-line-action` attribute on menu items that require a specific log line target
- Items without `data-line-action` are global (Copy selection, Select All) and always visible
- `showContextMenu(lineIdx)` accepts `-1` for no-line-target clicks (hides line-specific items)
- Use `positionContextMenu(menu, x, y)` to keep menu within viewport bounds

### Extension ↔ Webview Communication
- Webview → extension: `vscodeApi.postMessage({ type: 'messageName', ...data })`
- Extension → webview: `this.postMessage({ type: 'messageName', ...data })`
- For prompts requiring VS Code UI (e.g., Go to Line), use a round-trip: webview sends request → extension shows `showInputBox`/`showQuickPick` → extension posts result back
- All message types are handled in `handleMessage()` in `log-viewer-provider.ts`

### Search State
- `closeSearch()` hides the panel but preserves `matchIndices` and `currentMatchIdx`
- Only `clearSearchState()` resets match data (called when input is empty or on file change)
- `openSearch()` restores previous query text and re-runs search if matches exist

### Text Selection in Webviews
- Use `window.getSelection()` API for reading native text selection
- Use `document.createRange()` + `selectNodeContents(viewportEl)` for Ctrl+A
- Webview `document.execCommand('copy')` does not work — must postMessage to extension host which calls `vscode.env.clipboard.writeText()`

## Quality Standards

**Hard Limits:**
- Functions ≤30 lines
- Parameters ≤4 per function
- Nesting ≤3 levels deep
- Files ≤300 lines of code (blank lines and comments excluded by ESLint `skipBlankLines`/`skipComments`)

**Staying Under 300 Lines:**
- Extract logical sections into separate files when a module grows (see `viewer-styles-*.ts` pattern)
- Compress multi-line JSDoc to single-line `/** ... */` when the description is short
- Never remove blank lines or comments just to hit the line limit — readability comes first

**Principles:**
- Prefer deletion over addition
- No premature abstraction
- Clarity over cleverness
- Test edge cases: empty, null, rapid output, crash recovery
