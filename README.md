
![Saropa Log Capture banner](https://raw.githubusercontent.com/saropa/saropa-log-capture/main/images/banner.png)

```text
      F5 debug  ──►  output  ──►  saved to  reports/*.log
                                        │
                                        ▼
                    ┌─────────────────────────────────────────┐
                    │  VIEWER (what VS Code doesn't give you) │
                    │  · Search all logs (regex, history)     │
                    │  · Click  file.dart:42  →  open source  │
                    │  · Filter by error / warning / level    │
                    │  · Keep many sessions, compare two      │
                    │  · Export HTML, CSV, or share .slc      │
                    └─────────────────────────────────────────┘
```

VS Code deletes your Debug Console the moment you stop debugging. Every `print`, every stack trace, every clue — gone. Saropa Log Capture fixes that. Install it, hit F5, and every debug session is automatically saved, searchable, and browsable. No configuration. Works with any debug adapter: Dart, Flutter, Node, Python, C++, Go, Java, and more.

<!-- GitHub Activity -->
[![GitHub stars](https://img.shields.io/github/stars/saropa/saropa-log-capture?style=social)](https://github.com/saropa/saropa-log-capture)
[![GitHub forks](https://img.shields.io/github/forks/saropa/saropa-log-capture?style=social)](https://github.com/saropa/saropa-log-capture)
[![GitHub last commit](https://img.shields.io/github/last-commit/saropa/saropa-log-capture)](https://github.com/saropa/saropa-log-capture/commits)
[![GitHub issues](https://img.shields.io/github/issues/saropa/saropa-log-capture)](https://github.com/saropa/saropa-log-capture/issues)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Languages](https://img.shields.io/badge/UI%20languages-11%20locales-blue)](https://github.com/saropa/saropa-log-capture#translations)
[![Coverage](https://img.shields.io/badge/coverage-50%25%2B-brightgreen)](https://github.com/saropa/saropa-log-capture/actions)

> Feedback or ideas? [Open an issue](https://github.com/saropa/saropa-log-capture/issues/new).

---

## Quick Start

1. Install from the VS Code Marketplace
2. Start a debug session (F5)
3. Output is automatically captured to `reports/`
4. Click the **Saropa Log Capture** icon on the activity bar to view output in real time

> **Testing the extension (F5):** Use **VS Code** (not a downstream fork) to run the Extension Development Host: **File → Open Folder** → this repo, then press **F5**. Some forks may not load the extension when used as the F5 host.

---

## Screenshots

![Debug output in the log viewer with colored severity markers, framework classification, and run navigation](https://raw.githubusercontent.com/saropa/saropa-log-capture/main/images/screenshots/20260414_project_log_view.png)

![Log viewer showing Drift SQL queries with syntax highlighting and diagnostic badges](https://raw.githubusercontent.com/saropa/saropa-log-capture/main/images/screenshots/20260401_log_viewer_sql.png)

---

## Why Use This?

- **Never lose output again** — Debug Console output saved to `reports/*.log` automatically. Restart, switch targets — your logs survive.
- **Click to source** — Click `file.ts:42` in any log line to jump to the code (Ctrl+Click for split editor).
- **Search everything** — Regex search with history, floating overlay (Ctrl+F), cross-session search.
- **Filter the noise** — Eight severity levels, log source tiers (Flutter DAP / Device / External), source tag chips, exclusion patterns, and saved presets. Tags & Origins side panel for browsing sources.
- **Compare sessions** — Side-by-side diff of any two runs.
- **100K+ lines, no lag** — Virtual scrolling handles massive logs without freezing.
- **Signals** — Automatic detection of slow operations, N+1 queries, ANR risk, and error clusters with evidence-backed signal reports. Unified Signals panel with collections, all signals, hot files, and performance data.
- **Error intelligence** — Errors auto-classified as CRITICAL, TRANSIENT, or BUG with inline badges. Recurring patterns surfaced across sessions. Configurable alerts (flash, sound, badge, modal).
- **SQL diagnostics** — Drift ORM query fingerprinting, repeat compression, N+1 detection, slow query burst markers, and session SQL comparison.
- **Structured file support** — Open `.md`, `.json`, `.csv`, and `.html` files in the viewer with format-aware previews.
- **Typography controls** — Live font-size and line-height adjustment via keyboard shortcuts (Ctrl+=/-, Ctrl+Shift+=/-)  or the Options panel.
- **Post-capture workflow** — Actionable end-of-capture toasts: Open Log, Always Open, or Don't Ask Again.
- **Pop-out viewer** — Move the viewer to a second monitor for full-screen analysis.
- **Export anywhere** — HTML, CSV, JSON, shareable `.slc` bundles, or push to Grafana Loki.
- **Collections** — Pin logs and files into named collections. Dedicated slide-out panel for merging and managing grouped sessions.
- **Tail any log** — Open any workspace `.log` file and watch new lines live.
- **Run navigation** — Jump between Flutter runs (launch, hot restart, hot reload) inside a single log.
- **Session groups** — A debug session and its sidecar logs collapse into one entry in the Logs panel with severity totals.
- **Integration adapters** — Opt-in adapters attach Git state, lockfile hashes, env snapshots, test results, crash dumps, Docker inspect, and more to each session header.

---

## Features

<details>
<summary><strong>Click to expand full feature list</strong></summary>

### Capture & Storage
- **Auto-capture:** Debug Console output saved to `.log` files automatically.
- **Deduplication:** Identical rapid lines grouped as `Message (x54)`. Flood protection suppresses >100/sec repeats.
- **File retention:** Oldest logs auto-deleted when limit exceeded.
- **Auto file split:** Split logs by line count, size, keywords, duration, or silence.
- **Context header:** Each log starts with session metadata.
- **Integration adapters:** Opt-in adapters add header lines per session (packages, build/CI, Git, env, test results, coverage, crash dumps, Docker, performance, terminal output, Drift Advisor, and more). Configure via `saropaLogCapture.integrations.adapters`.
- **Full Debug Console capture:** Toggle "App Only" or set `captureAll` to include system/framework logs.
- **AI Activity (opt-in):** Stream Claude Code AI activity into the log viewer, with colored borders and category filters. Settings under `saropaLogCapture.aiActivity.*`.

### Viewer
- **Live sidebar viewer:** Real-time output with virtual scrolling, auto-scroll, and theme support.
- **Floating search:** Compact search overlay (Ctrl+F) with case, whole word, regex, match navigation, and highlight vs filter mode.
- **Pop-out viewer:** Open the viewer as a floating window on a second monitor.
- **Click-to-source:** Click `file.ts:42` to jump to source; Ctrl+Click for split editor.
- **Collapsible stack traces:** Grouped and collapsed by default. Click to cycle: preview (first 3 app frames) / expanded / collapsed.
- **Flutter exception grouping:** Every copy of an `Exception caught by …` block is banded as one incident (stderr, console, and `FlutterErrorDetails` shapes), and the verbose render-tree descendant dump folds into a collapsible group.
- **Structured files:** `.md`, `.json`, `.csv`, `.html` rendered with format-aware previews.
- **Insert markers (M), pin lines (P), annotate (N), bookmark (Ctrl+B).**
- **Inline peek:** Double-click to expand surrounding context. Escape to dismiss.
- **JSON rendering:** Embedded JSON shown as collapsible pretty-printed blocks.
- **ASCII art detection:** Box-drawing characters and figlet banners detected and grouped.
- **Scroll position memory:** Viewer remembers position per file when switching logs.
- **Tail mode:** Open any workspace file matching `tailPatterns` and append new lines live.
- **Run navigation:** "Run 1 of N" with Prev/Next; run separators with time range and issue counts.
- **Explain with AI:** Right-click a log line to get an explanation from the VS Code Language Model (e.g. GitHub Copilot Chat).

### Search & Filter
- **In-log search:** Floating overlay with case, whole word, regex, and recent terms.
- **Category filter:** Filter by DAP category (stdout, stderr, console).
- **Level filter:** Toggle buttons for all 8 severity levels. Per-file state persisted.
- **Log Sources:** Three tier radios — Flutter DAP, Device, External — each with All / Warn+ / None.
- **Tags & Origins panel:** Browse auto-discovered source tags and code origins with visibility toggles.
- **Source tag filter:** Auto-discovers logcat tags and bracket prefixes. Click chips to toggle.
- **Exclusion filter:** Patterns as removable chips with count badge.
- **Keyword watch:** Track patterns with live counters, flash alerts, and badges.
- **Saved filters:** Save and apply filter combinations; built-in presets included.
- **Cross-session search:** Search all log files via Quick Pick.

### Error Intelligence
- **Smart classification:** Errors auto-classified as CRITICAL, TRANSIENT, or BUG with inline badges. Configurable detection mode (strict/loose). User-editable severity keywords.
- **Alerts:** Flash border, sound, counter badge, optional modal popup on errors.
- **Multi-level classification:** Eight severity levels (Error, Warning, Info, Performance, TODO, Debug/Trace, Notice, Database) with dedicated colors and filters.

### Signals
- **Signals panel:** Single icon-bar panel (lightbulb). Accordion sections: Collections (named groups of logs/files), All Signals (unified cross-session list sorted by severity), Frequently Modified Files, and Performance (current, trends, database, errors).
- **Signal reports:** Evidence-backed reports for each detected signal with confidence labels, line links, and action buttons.
- **Database signals:** N+1 detection, slow query burst markers, baseline volume hints, and session SQL comparison — each independently togglable.

### Display & Layout
- **Line decorations:** Severity dots, counters, timestamps, elapsed time — each togglable independently.
- **Lint diagnostic badges:** Inline badges for lines referencing files with active VS Code diagnostics. Works with all linters.
- **Severity bar mode:** Colored left borders by log level.
- **Visual spacing:** Optional breathing room before/after level changes, markers, and stack traces (V key).
- **Font size / line height:** Adjustable via Options panel sliders or keyboard shortcuts.
- **Scrollbar minimap:** Visual overview showing search matches, errors, warnings, and viewport position.
- **Highlight rules:** Color lines matching patterns (configurable colors, labels).

### Collections
- **Named collections:** Group related logs and files for investigating a specific bug, feature, or incident.
- **Collections panel:** Dedicated slide-out panel (I key) for creating, merging, and managing collections.
- **Share:** Export as `.slc` bundle, Gist, deep link, or LAN share.
- **Import:** Command Palette → **Import .slc Bundle** to restore shared collections.

### Export
- **Per-level export:** Export filtered logs with preset templates (Errors Only, Full Debug, etc.) or custom level selection.
- **HTML export:** Static or interactive with search, filters, and theme toggle.
- **CSV / JSON / JSONL export:** Structured formats for external tools.
- **Export to Loki:** Push sessions to Grafana Loki.
- **Hover copy icon:** Hover any line to copy with one click.
- **Multi-format copy:** Plain text, markdown, raw, snippet (GitHub/GitLab fence).

### Status Bar & Audio
- **Status bar:** Pause/resume icon + line count with watch counts.
- **Audio alerts:** Configurable sounds for errors/warnings with volume, rate limiting, and preview.

### Infrastructure
- **Project index:** Lightweight index under `.saropa/index/` for faster analysis and doc matching.
- **Script fault isolation:** Each viewer feature runs in a separate script block.
- **App-only stack traces (A key), stack deduplication, session summary.**

</details>

---

## Works Best With

Saropa Log Capture works standalone, but unlocks richer diagnostics when paired with these companion extensions:

| Extension | What it adds to Log Capture |
|---|---|
| **[Saropa Lints](https://marketplace.visualstudio.com/items?itemName=saropa.saropa-lints)** | Bug reports include lint violations filtered by impact, OWASP summaries, health scores, and "Explain rule" links. |
| **[Saropa Drift Advisor](https://marketplace.visualstudio.com/items?itemName=saropa.drift-viewer)** | Session metadata carries query performance stats, schema summaries, anomaly counts, and index suggestions. Right-click SQL lines for "Open in Drift Advisor". |

> **One-click install:** Get all three with the [Saropa Suite](https://marketplace.visualstudio.com/items?itemName=saropa.saropa-suite) extension pack.

## Requirements

- **VS Code** ^1.108.1 — also available via Open VSX for compatible editors.
- **Node.js** >= **22** for building and tests. Optional: use the **Dev Container** (`.devcontainer/devcontainer.json`). See [CONTRIBUTING.md](CONTRIBUTING.md).

## Remote Development

Fully supports Remote SSH, WSL, and Dev Containers. Use a relative `logDirectory` (like `reports` or `.logs`) to keep captures inside your remote workspace. No extra setup required.

---

## Configuration

All settings are prefixed with `saropaLogCapture.` — see [docs/CONFIGURATION.md](docs/CONFIGURATION.md) for the full settings reference.

**Key settings:**

| Setting         | Default     | Description                                          |
| --------------- | ----------- | ---------------------------------------------------- |
| `enabled`       | `true`      | Enable/disable automatic log capture                 |
| `logDirectory`  | `"reports"` | Where to save log files (relative to workspace root) |
| `captureAll`    | `false`     | Capture all Debug Console output, bypassing filters  |

> **Tip:** To capture system/framework noise alongside your app logs, toggle **App Only: OFF** in the viewer or set `captureAll` to `true`.

---

## Extension API

Other VS Code extensions can consume a typed API from Saropa Log Capture:

```typescript
import * as vscode from 'vscode';

// In your extension's activate():
const ext = vscode.extensions.getExtension('saropa.saropa-log-capture');
if (!ext) { return; }
const api = ext.isActive ? ext.exports : await ext.activate();

// Subscribe to live log lines
context.subscriptions.push(
    api.onDidWriteLine((line) => {
        // `stderr` can carry non-error info; classify by text/category policy instead.
        if (/\b(error|exception|fatal|failed)\b/i.test(line.text)) {
            console.log(`Error: ${line.text}`);
        }
    }),
);

// Session lifecycle
context.subscriptions.push(
    api.onDidStartSession((session) => {
        console.log(`Capture started: ${session.projectName}`);
    }),
);

// Write lines into the active capture session
api.writeLine('Slow query detected (1250ms)', {
    category: 'drift-perf',
    timestamp: queryEndTime,
});

// Query current state
const info = api.getSessionInfo();
if (info?.isActive) {
    api.insertMarker('My extension checkpoint');
}

// Register an integration provider
context.subscriptions.push(
    api.registerIntegrationProvider({
        id: 'my-extension',
        isEnabled: () => true,
        onSessionStartSync: () => [{
            kind: 'header',
            lines: ['My Extension: active'],
        }],
    }),
);
```

See [api-types.ts](src/api-types.ts) for the full type definitions.

---

## Key Commands

| Command | Description |
| --- | --- |
| `Saropa Log Capture: Start Capture` | Start capturing to a new log file |
| `Saropa Log Capture: Stop Capture` | Stop capturing and finalize the file |
| `Saropa Log Capture: Pause/Resume Capture` | Toggle capture on/off |
| `Saropa Log Capture: Insert Marker` | Insert a visual separator into the log |
| `Saropa Log Capture: Search Log Files` | Search across all log files |
| `Saropa Log Capture: Compare Sessions` | Side-by-side diff of two log sessions |
| `Saropa Log Capture: Import .slc Bundle` | Import a shared `.slc` session bundle |
| `Saropa Log Capture: Getting Started` | Open the Getting Started walkthrough |

Full command list available via Command Palette (Ctrl+Shift+P → "Saropa").

---

## Keyboard Shortcuts

Press **F1** inside the viewer for the full interactive reference with descriptions and rebinding.

| Shortcut | Action |
| --- | --- |
| **F1** | Open keyboard shortcuts reference |
| **Ctrl+F** | Open search overlay |
| **F5** | Start debugging (VS Code built-in) |

See [docs/walkthrough/keyboard-shortcuts.md](docs/walkthrough/keyboard-shortcuts.md) for the complete list, or open **Options → Keyboard shortcuts...** in the viewer. All 51 power shortcuts are rebindable via `saropaLogCapture.viewerKeybindings`.

---

## Known Limitations

- **Empty or near-empty log files:** If the Debug Console has output but the open log shows only a header, use **Prev/Next** in the viewer and enable `diagnosticCapture` to inspect the pipeline. See [Runbook: Missing or empty log files](plans/integrations/010_runbook-missing-or-empty-logs.md).
- **Viewer line cap:** The viewer shows the first N lines (`viewerMaxLines`, default 50,000). The full file is kept on disk up to `maxLines` (default 100,000). Toolbar shows "Showing first X of Y lines" when truncated.
- **Debug Console only:** The main capture stream is from the VS Code Debug Console (DAP). Enable the `terminal` integration adapter to also capture Integrated Terminal output.

### Accessibility

The webview viewer supports keyboard and assistive tech. Main content has a `main` landmark; the icon bar is a `toolbar`; the log area has `role="log"` with live region announcements. Slide-out panels have `region` landmarks; focus moves into them on open and returns on Escape. For the full audit, see [plans/028_plan-webview-accessibility.md](plans/028_plan-webview-accessibility.md).

---

## Contributing

Contributions and feedback are welcome.

- **Broken** — tell us what happened, we'll fix it
- **Missing** — propose it, or better yet, submit a PR
- **Confusing** — help us improve the docs or UX

See [CONTRIBUTING.md](CONTRIBUTING.md) for developer setup, code quality standards, and contribution guidelines.

**Quick start:** Fork → feature branch → `npm run compile` → Pull Request.

**Testing (F5):** Open in VS Code → F5 → Extension Development Host. For the test suite, install the recommended **Extension Test Runner** and use the Testing view, or run `npm test`.

### Translations

The extension ships localized UI strings for 11 locales: Chinese (Simplified & Traditional), German, Spanish, French, Italian, Japanese, Korean, Portuguese (Brazil), and Russian. Corrections welcome — email [language@saropa.com](mailto:language@saropa.com).

---

## Documentation

| Document | Description |
| --- | --- |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Developer setup, code standards, and how to contribute |
| [CHANGELOG.md](CHANGELOG.md) | Version history and release notes |
| [ROADMAP.md](ROADMAP.md) | Links to feature plans and completed work |
| [docs/CONFIGURATION.md](docs/CONFIGURATION.md) | Full settings reference |
| [docs/STYLE_GUIDE.md](docs/STYLE_GUIDE.md) | Code style conventions and patterns |

---

## License

MIT — see [LICENSE](LICENSE). Use it however you like.

---

Built by [Saropa](https://saropa.com). Questions? Ideas? [Open an issue](https://github.com/saropa/saropa-log-capture/issues).

[GitHub](https://github.com/saropa/saropa-log-capture) | [Issues](https://github.com/saropa/saropa-log-capture/issues) | [Saropa](https://saropa.com)
