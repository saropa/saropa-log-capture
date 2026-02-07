# Article Series Plan: Building a VS Code Extension

Three-part series chronicling the creation of Saropa Log Capture — from first `yo code` scaffold to advanced debugging intelligence — in 11 days, 180 commits, 188 TypeScript files, and ~25,500 lines of code.

**Timeline:** Jan 27 – Feb 7, 2026 (11 days)
**Commits:** 180 (non-merge)
**Versions published:** 0.0.1 → 0.3.1 (10 tagged releases)
**Source files:** 188 `.ts` files across `src/`

---

## Article 1: "From Zero to VSIX — Building and Publishing a VS Code Extension"

**Angle:** Practical walkthrough of the entire extension lifecycle, aimed at developers who've never shipped an extension. Uses our real project as the case study — every step is illustrated with actual commits, actual mistakes, and actual code.

### Outline

#### 1. Why build an extension?
- The itch: Debug Console output disappears when a session ends. You hit F5, reproduce a bug, see the stack trace flash by... and it's gone when the session stops. No save button. No history. No search.
- Evaluating alternatives: copy-paste (doesn't scale), Output channel API (wrong channel — the Debug Console is separate), external file loggers (require code changes), terminal capture tools (don't see DAP events)
- Decision: solve it inside VS Code via the Debug Adapter Protocol, which provides a clean interception point that works with every language

#### 2. Scaffolding with `yo code`
- **Commit `50072eb` (Jan 27, 10:42am):** `Initial scaffold via yo code` — the generator creates `package.json`, `src/extension.ts`, `tsconfig.json`, `.vscode/launch.json`, and boilerplate. Total: ~15 files, all template code.
- What the generator gives you: a working "Hello World" command, an F5 launch config for the Extension Development Host, a `package.json` with `engines.vscode` set, and a `.vscodeignore`
- What it does NOT give you: a bundler, a CI pipeline, meaningful tests, or any idea what activation events are
- **Commit `97bbae5` (Jan 27, 12:42pm):** `Add dev tooling: icon, setup script, editor config` — immediately added `.editorconfig`, a setup script, and an extension icon because the marketplace requires one
- Activation events matter: we use `"onDebugAdapterProtocolTracker"` so the extension loads lazily only when someone starts debugging, not `"*"` which loads on every VS Code startup

#### 3. The extension manifest (`package.json`)
- The manifest is the most important file — VS Code reads it before your code ever runs. Every command, setting, view, menu item, and activation event is declared here.
- **Commit `c673bb7` (Jan 27, 12:42pm):** `Add extension manifest with commands, settings, activation` — first real manifest with:
  - `activationEvents: ["onDebugAdapterProtocolTracker"]`
  - Commands: `saropaLogCapture.start`, `saropaLogCapture.stop`
  - Settings: `saropaLogCapture.outputDirectory`, `saropaLogCapture.maxLogFiles`
  - Views: `saropaLogCapture.logViewer` (WebviewViewProvider)
- Contribution points that matter for this kind of extension:
  - `debugAdapterProtocolTracker` — register to intercept DAP messages
  - `views` / `viewsContainers` — register a sidebar or panel webview
  - `configuration` — declare settings with types, defaults, descriptions
  - `commands` — register commands that appear in the Command Palette
  - `menus` — wire commands to context menus, title bars, editor actions
- By v0.3.1, the manifest grew to include 20+ commands, 30+ settings, view title bar actions, editor context menus, and keyboard shortcuts
- **Real example:** the `saropaLogCapture.fileTypes` setting (added in commit `7d21c2e`, v0.2.6) is declared as `"type": "array", "items": { "type": "string" }` with default `[".log", ".txt", ".md", ".csv", ".json", ".jsonl", ".html"]`. This one JSON declaration makes it appear in VS Code's Settings UI with proper array editing.

#### 4. Building and bundling
- **esbuild, not webpack:** The `yo code` generator offers webpack, but we chose esbuild for speed. Our `esbuild.js` (70 lines) bundles everything into a single `dist/extension.js`. Dev builds with sourcemaps take <1 second; production builds with minification take ~2 seconds.
- **The build pipeline** (`npm run compile`):
  1. `tsc --noEmit` — type-check only, no output files (strict mode catches ~90% of bugs)
  2. `eslint` — enforce code quality (we use `max-lines: 300` as a hard limit)
  3. `esbuild` — bundle `src/extension.ts` into `dist/extension.js` (CJS format, `vscode` external)
- **Codicon font copying:** Webviews can't load VS Code's fonts (they're sandboxed). Commit `d965a1d` (v0.2.2) learned this the hard way — icons were invisible. Our `esbuild.js` now has a `copyCodiconAssets()` step that copies `@vscode/codicons` font files into `media/codicons/` at build time.
- **Watch mode:** `npm run watch` runs esbuild in watch mode + `tsc --watch` in parallel for instant rebuilds during development

#### 5. Testing inside VS Code
- Tests use `@vscode/test-cli` and `@vscode/test-electron` which launch a real VS Code instance (the Extension Development Host) and run Mocha suites inside it. This means your tests have access to the full `vscode` API.
- **Convention:** `suite()` for grouping, `test()` for individual cases, `assert.strictEqual()` over `assert.equal()`
- **Build-time syntax validation** (commit `a06867b`, v0.1.10): After a regex `SyntaxError` in a webview script killed the entire viewer in production, we added a test that extracts all `<script>` blocks from the generated HTML and validates each with `new Function()`. This catches syntax errors before release.
- **Commit `8d7915e`:** `fix: correct overly broad assertions in formatLine tests` — a reminder that tests need maintenance too; over-broad assertions masked real regressions
- The F5 key in VS Code launches the Extension Development Host — a second VS Code window with your extension loaded from source. `console.log` goes to the Debug Console of the *first* window. This is your primary dev loop.

#### 6. Packaging and publishing
- **`vsce package`** produces a `.vsix` file — a ZIP containing:
  - `extension/package.json` (manifest)
  - `extension/dist/extension.js` (bundled code)
  - `extension/media/` (codicon fonts, audio files, images)
  - `extension/CHANGELOG.md`, `extension/README.md`, `extension/LICENSE`
- **`.vsixignore`** controls what goes in: exclude `src/`, `node_modules/`, `.vscode/`, tests, scripts. Our VSIX is ~200KB because esbuild produces a single bundle.
- **The publish pipeline** (commit `cd617a0`, v0.2.1): `scripts/dev.py` is a 16-step gated workflow:
  1. Check prerequisites (Node, npm, vsce, git)
  2. Check environment (VS Code version, extension compatibility)
  3. Verify project state (clean git, version bumped, changelog updated)
  4. Run `npm run compile` (type-check + lint + bundle)
  5. Run tests
  6. Build production VSIX
  7. `--analyze-only` stops here for local dev builds
  8. Full publish continues: `vsce publish`, GitHub release, tag
- **Commit `a28ec3e`:** The dev.py script itself grew to 1,756 lines and had to be refactored into 9 focused modules under `scripts/modules/` — the extension wasn't the only code that needed file-size discipline
- **Publisher accounts:** Register at `https://marketplace.visualstudio.com/manage`, create a Personal Access Token, run `vsce login saropa`, then `vsce publish`
- **Commit `5c74b4b` (Jan 27, 1:01pm):** `Prepare v0.1.0 for marketplace publishing` — only 2.5 hours after the first scaffold, the extension was on the marketplace

#### 7. Content Security Policy — the invisible wall
- CSP is the single biggest source of "it works in dev, breaks in production" bugs for webview extensions
- **Commit `cf9487f` (Jan 31):** `fix: viewer controls blocked by Content Security Policy` — EVERY button and control in the viewer was broken because inline `onclick`/`onchange` handlers are blocked by CSP. Had to convert all handlers to `addEventListener` calls. This was the first time the extension was tested outside the Extension Development Host.
- **Commit `68fe8c3` (Feb 2):** `fix: correct options panel layout, remove dead inline context, fix audio CSP` — Audio preview buttons did nothing because `media-src` used the wrong URI authority
- **Commit `d965a1d` (Feb 2):** `fix: load codicon font in webview for visible icons` — codicon font blocked because webviews don't inherit VS Code's fonts; needed `font-src` plus bundling `@vscode/codicons`
- **Commit `0244ff3` (Feb 3):** Icons invisible because CSP nonces in `style-src` silently disabled `'unsafe-inline'`, blocking inline `style` attributes on level dots. Had to move ALL inline styles to CSS classes.
- **Lesson:** Test your webview in the raw VSIX install, not just the Extension Development Host. The dev host is more permissive.

#### 8. The VS Code API: what it gives you and what it won't
- **What the WebviewView API exposes for `view/title`:** Icon buttons that trigger commands (via `contributes.menus > view/title`), `when` clauses for conditional show/hide, inline vs overflow placement. That's it.
- **What it does NOT expose:** Text input fields in the title bar, dropdown selectors, native filter widgets. The filter bars in Problems/Output/Debug Console are built-in VS Code workbench chrome rendered *outside* the webview — extensions can't replicate them.
- **Design decision (documented in `bugs/discussion/view-title-filter-bar.md`):** We evaluated 4 options (A: title bar icons only, B: embedded filter bar in webview top edge, C: keep current icon bar architecture, D: hybrid). Chose D — add 2-3 toggle icons to the view title bar for quick access, keep the full slide-out panels for detailed config. Reason: our filtering already exceeds native panels (7 severity levels with context lines vs Problems panel's 3, regex exclusions, app-only classification, filter presets, source tag filtering — none of which native panels offer).
- **The VS Code minimap limitation** (documented in `bugs/discussion/minimap-context-menu-shows-irrelevant-actions.md`): Right-clicking the VS Code editor minimap shows Cut/Copy/Paste — meaningless actions. Extensions can't override it. The minimap shares the editor's context menu by design. No API exposure, no upstream fix planned. This kind of API boundary is typical: you can build *inside* the webview, but you can't customize VS Code's own chrome.

#### 9. Lessons learned (the hard way)
- **`retainContextWhenHidden`** (commit `3dc9593`, v0.2.9): Switching from the Log Capture panel to the Terminal tab and back *destroyed the entire webview* — all state, scroll position, filters, selected file — because VS Code disposes webviews when hidden by default. One line fix: `{ retainContextWhenHidden: true }` in the webview provider registration. Cost: ~4 hours of debugging.
- **Disposable management:** VS Code extensions must register disposables via `context.subscriptions.push()`. Miss one and you get memory leaks, stale event handlers, or commands that stop working after reload. We register every `vscode.commands.registerCommand()`, every `vscode.debug.registerDebugAdapterTrackerFactory()`, every `vscode.window.registerWebviewViewProvider()`.
- **The webview sandbox:** No `fs`, no `path`, no Node.js APIs. No `document.execCommand('copy')` — clipboard must go through `postMessage` to the extension host which calls `vscode.env.clipboard.writeText()`. No access to VS Code's theme fonts — must bundle your own. No persistent state without `webview.state` or `workspaceState`.
- **The `as string` trap** (commit `01aabfe`): `packageJson.version as string ?? ''` makes TypeScript treat the version as always a string, so the `??` fallback is unreachable dead code. Use `String(packageJson.version ?? '')` instead.
- **Template literal JavaScript:** All our webview JS is generated as TypeScript template literals tagged with `/* javascript */`. This means escape sequences are doubly interpreted. Commit `a06867b` fixed `\\\\s` (which produced literal `\s` text instead of a whitespace regex character class) in 3 separate files.

### Key commits to reference
| Commit | Date | What happened |
|--------|------|---------------|
| `50072eb` | Jan 27 10:42am | Initial scaffold via `yo code` |
| `c673bb7` | Jan 27 12:42pm | First real manifest (commands, settings, activation) |
| `724716a` | Jan 27 12:42pm | Core capture modules (config, tracker, dedup) |
| `5c74b4b` | Jan 27 1:01pm | Published v0.1.0 to marketplace (2.5 hours after scaffold) |
| `cf9487f` | Jan 31 8:36pm | CSP blocked every viewer control |
| `a06867b` | Feb 1 10:45am | Script fault isolation after regex killed webview |
| `d965a1d` | Feb 2 2:40pm | Codicon font bundling for webview icons |
| `cd617a0` | Feb 2 12:50pm | 16-step publish pipeline |
| `3dc9593` | Feb 4 10:13am | `retainContextWhenHidden` discovery |

---

## Article 2: "Never Lose Your Debug Output — Why We Built Saropa Log Capture"

**Angle:** The problem space and core architecture. Less "how to build an extension," more "why this extension needs to exist and how the capture pipeline works." Grounded in specific engineering decisions, bug investigations, and the hard-won understanding of what DAP actually delivers.

### Outline

#### 1. The problem nobody talks about
- VS Code's Debug Console is a black hole. Start debugging, see output scroll by, stop debugging — gone. No save. No search. No clipboard that works reliably at 10K+ lines.
- The Debug Console is NOT the Output channel. They look similar but are completely different systems. The Output channel (`vscode.window.createOutputChannel()`) is extension-controlled. The Debug Console is driven by the Debug Adapter Protocol. You can't just redirect one to the other.
- Mobile debugging makes it worse: Flutter's debug output includes Android logcat (`D/FlutterJNI`, `I/Choreographer`, `E/MediaCodec`), iOS system logs, and your app's `print()` calls — all interleaved. Crash? The app restarts and the logs are gone.
- The workaround tax: teams paste errors into Slack, screenshot stack traces, say "I saw that error earlier but I can't reproduce it now." Hours lost.

#### 2. Design principles (not just words — enforced by code)
- **Zero friction:** Activation event is `onDebugAdapterProtocolTracker` — no commands to run, no config to set. Hit F5 and capture starts. Commit `c673bb7` established this from day one.
- **One problem, perfectly:** Capture debug output. Don't try to be a log analysis platform, a monitoring tool, or a debugger. (We'll see in Article 3 how this principle got tested.)
- **Never lose data:** Immediate-append writes to disk. Every line hits the file system the moment it arrives. No buffering, no batching, no "write on session end." If VS Code crashes, you have everything up to the crash. This was validated by commit `88b0546` (v0.3.1) which discovered that the async session initialization created a window where output was silently dropped — and added an early event buffer to fix it.
- **Respect the host:** Use VS Code's own patterns: `--vscode-*` CSS custom properties for theming, disposable pattern for lifecycle, `vscode.workspace.fs` for file ops (not Node.js `fs`), `workspaceState` for persistence. Never inject global styles or fight VS Code's layout.
- **Performance is a feature:** You can't slow down debugging to capture it. Virtual scrolling (not DOM-per-line), debounced search, O(log n) viewport calculation via prefix-sum arrays.

#### 3. The Debug Adapter Protocol (DAP) — the key insight
- DAP is the protocol between VS Code and debug adapters (Node.js debugger, Python debugger, Dart debugger, etc.). It defines events like `OutputEvent` which carries the actual debug output.
- VS Code provides `DebugAdapterTrackerFactory` — you register it and VS Code gives you a `DebugAdapterTracker` that sees every DAP message. This is a first-class API, not a hack.
- **Commit `724716a` (Jan 27, 12:42pm):** `Add core capture modules: config, tracker, deduplication` — the `tracker.ts` module is only ~80 lines. The `DebugAdapterTracker.onDidSendMessage()` handler checks for `event.type === 'event' && event.event === 'output'`, extracts the body, and pipes it downstream.
- DAP `OutputEvent` carries: `category` (stdout, stderr, console, telemetry), `output` (the text), `source` (optional file/line reference), `variablesReference` (for structured data). We capture `output` and `category`; source location is opt-in via `includeSourceLocation` setting (commit `036da9a`).

#### 4. The "capture all" investigation — what DAP actually delivers (and doesn't)
- **Why capture ALL categories:** Commit `88b0546` (v0.3.1) fixed a critical bug: with default settings, debug adapters that send output under non-standard DAP categories (e.g. Flutter system logs) were silently dropped because `captureAll` defaulted to `false`. Changed to `true` — matching the "never lose data" principle.
- **The missing-logs investigation** (documented in `bugs/history/app-only-off-does-not-capture-all.md`): Users reported missing system/framework logs despite "App Only: OFF." We investigated and reclassified the bug — the backend `captureAll` logic was correct. The real issue has three possible root causes:
  1. **DAP adapter not emitting all lines:** The VS Code Debug Console can display output from sources other than DAP `output` events (adapter-internal logging, process stdout captured directly by VS Code). Our extension only captures DAP `output` events via `DebugAdapterTracker.onDidSendMessage()`. Lines that reach the Debug Console through other channels are invisible to us. This is a fundamental limitation of the tracker API.
  2. **Non-standard DAP categories:** Some adapters use categories like `'important'` or `'telemetry'` or custom strings. With `captureAll: false`, these are filtered. With `captureAll: true` (now the default), this is not an issue.
  3. **User-configured exclusions:** Exclusion patterns matching system/framework log formats silently drop those lines even with `captureAll: true`.
- **Diagnostic tool:** We added `saropaLogCapture.verboseDap` (commit `036da9a`, v0.2.2) which logs all raw DAP protocol messages (`[dap->]`, `[dap<-]`, `[dap:event]`) to the log file, allowing users to compare DAP traffic against Debug Console output.
- **Design lesson for the article:** The gap between "what the Debug Console shows" and "what DAP actually emits" is the most surprising aspect of building this extension. The Debug Console is not just a DAP output renderer — it has its own internal channels.

#### 5. The capture pipeline (event flow with real code)
- **Full pipeline:** DAP OutputEvent → `tracker.ts` (intercept) → `deduplication.ts` (debounce + group) → `session-manager.ts` (route) → `log-session.ts` (file write + UI push)
- **Commit `724716a`:** Tracker receives raw DAP events, strips trailing newlines, classifies category
- **Deduplication** (`deduplication.ts`): Identical rapid lines become `Error (x54)` instead of 54 identical lines. Uses a debounce window — if the same message arrives within N ms, increment the counter instead of writing a new line. Commit `8b456a0` (Jan 27, 11:52pm) fixed dedup scan performance because the initial implementation was O(n) on every line.
- **Session manager** (`session-manager.ts`, extracted in commit `879a87a`): Routes events to the correct `LogSession` based on debug session ID. Handles multiple concurrent debug sessions.
- **Log session** (`log-session.ts`): Manages per-session state: the file handle, the write buffer, the line counter, pause/resume. Each line is appended immediately — `vscode.workspace.fs.writeFile()` with append semantics.
- **The early event buffer** (commit `88b0546`, v0.3.1): DAP tracker activates synchronously but session initialization is async (directory creation, file creation, header writing). Output events arriving in this window were silently dropped. Fix: buffer events in an array, replay them once session init completes. This was a "never lose data" violation that went undetected for weeks.
- **Exclusions bypass fix** (same commit): `captureAll` previously bypassed BOTH category filtering AND exclusion filtering. But exclusions are user-configured "I never want to see this" rules — they should always apply. Now `captureAll` only bypasses category filtering; exclusions are independent.

#### 6. The log file format
- **Context header** (first block in every file):
  ```
  ============================
  Saropa Log Capture v0.3.1
  Date: 2026-02-07T10:00:00.000Z
  Workspace: saropa-log-capture
  Debug Adapter: dart
  Configuration: Flutter (debug)
  VS Code: 1.108.1
  Platform: win32
  ============================
  ```
  Added in commit `aa01038`. Parsed back when loading historical files (commit `85622c2`, v0.2.2) — the `Date:` line provides the date component for reconstructing timestamps.
- **ANSI codes preserved:** Raw ANSI escape sequences are kept in `.log` files. External tools (like `cat` with ANSI support, or `less -R`) render them. The viewer converts ANSI to HTML via `ansi.ts` (commit `bc49ad2`). Decision: never strip data from the canonical file.
- **Timestamps:** Each line gets `[HH:MM:SS.mmm]` prepended. When loading historical files, these are parsed back to enable elapsed-time decorations (commit `85622c2`, v0.2.0).
- **File naming evolution:** Started as `session_HH-MM.log`, then `YYYYMMDD_HHMMSS_name.log` (commit `dea3922`, v0.1.11) for uniqueness. The old format caused collisions (two sessions in the same minute). Rename and metadata parsing had to handle both legacy (`HH-MM`, `HH-MM-SS`) and current (`HHMMSS`) formats. Session display in the UI trims seconds for compactness (commit `85622c2`).
- **File retention:** Configurable `maxLogFiles` setting. Old files auto-deleted when limit exceeded. `file-retention.ts` module (commit `aa01038`).
- **Gitignore safety:** On first run, checks if `reports/` is in `.gitignore`. If not, offers to add it. Users shouldn't accidentally commit 50MB of debug logs. Module: `gitignore-checker.ts` (commit `aa01038`).

#### 7. The live viewer — a webview from scratch
- VS Code webviews are sandboxed iframes. No Node.js, no `fs`, no shared memory with the extension host. Communication is exclusively via `postMessage()`.
- **Architecture decision:** All webview HTML/CSS/JS is generated as TypeScript template literals (tagged `/* javascript */`). No separate `.html` files, no build step for the webview. This means the viewer is a single bundled file — no asset loading in the webview sandbox.
  - Downside: debugging is harder (no source maps for template literal JS), and escape sequences are doubly interpreted (the `\\\\s` bugs in commit `a06867b`)
  - Upside: the entire webview is a function call, parameterized by CSP nonces, URIs, and settings
- **Virtual scrolling** (commit `2c418c3`, Jan 27 6:09pm — only 7.5 hours after scaffold): With 100K+ lines, you can't create a DOM element per line. The viewer maintains a data array and only renders the visible window (plus a small buffer). Scroll events trigger viewport recalculation.
  - **Prefix-sum array** (commit `a1c2490`, v0.2.5): Original viewport calculation was O(n) — iterate all lines to find which line is at scroll offset Y. Replaced with a prefix-sum array enabling O(log n) binary search. Stack frame height lookup went from O(n²) nested scans to O(1) via cached group headers.
  - **Why endless scroll across sessions is hard** (documented in `bugs/discussion/multi-log-mode.md`): We investigated seamlessly loading previous/next sessions on scroll. It's fundamentally hard because prepending breaks virtual scrolling — the prefix-sum array, scroll position, and trim logic all assume append-only data. Prepending requires rebasing every offset and adjusting `scrollTop` to prevent viewport jumping. The 50K line limit conflicts with session-sized chunks. Active recording + upward historical loading = two competing data flows. Decided to ship "Session N of M" navigation bar (Stage 1) instead and defer endless scroll unless users actively request it.
- **The postMessage bridge:**
  - Extension → webview: `this.webview.postMessage({ type: 'addLines', lines: [...] })`
  - Webview → extension: `vscodeApi.postMessage({ type: 'openFile', path: '...' })`
  - All message types handled in `handleMessage()` in `log-viewer-provider.ts`
  - **The clipboard problem:** Webview `document.execCommand('copy')` doesn't work. Must postMessage the text to the extension host, which calls `vscode.env.clipboard.writeText()`. Discovered during Ctrl+A implementation (commit `a1c2490`).
  - **The Go-to-Line roundtrip:** Originally (commit `a1c2490`): webview sends `{ type: 'requestGoToLine' }` → extension shows `vscode.window.showInputBox()` → extension sends `{ type: 'goToLine', line: N }` back. Latency was noticeable. Replaced with inline overlay that scrolls instantly while typing (commit `a22fb92`, v0.2.6) — numbers-only input, Escape reverts, Enter confirms.
- **Content Security Policy:** See Article 1 section 7 for the full CSP horror story. The short version: we hit CSP issues in commits `cf9487f`, `68fe8c3`, `d965a1d`, `0244ff3`, and `4ee3b32`. Each time something different was blocked.

#### 8. Works with any debug adapter — but some are harder than others
- DAP is language-agnostic. The same `OutputEvent` handler captures Dart, Node.js, Python, C++, Go, Rust — any debug adapter VS Code supports.
- **Android logcat is the hard case.** Flutter's debug adapter forwards logcat lines like `D/FlutterJNI(12345): ...`, `I/flutter(12345): app output`, `E/MediaCodec(12345): Service not found`. These carry meaning in the prefix:
  - `D/` = debug, `I/` = info, `W/` = warning, `E/` = error, `V/` = verbose, `F/` = fatal (aka `Log.wtf()` — "What a Terrible Failure")
- **The tag is NOT your app** (documented in `bugs/logcat.md`): The logcat tag is chosen by whatever code calls `Log.e(...)` — including Android OS frameworks (`CCodec`, `MediaCodecList`, `scudo`), native libraries linked into your process, and third-party SDKs (Firebase, AdMob). Even when the PID matches your app, the message may originate from system code running inside your process space. The tag tells you WHO is logging, not WHERE it happened.
- **Framework vs. app classification** (`stack-parser.ts:isFrameworkLogLine()`): Only `I/flutter` is considered app code for logcat. Everything else (`D/FlutterJNI`, `I/Choreographer`, `D/FirebaseSessions`, etc.) is framework. This powers the "App Only" filter.
- **The logcat prefix is NOT an authority on severity** — a key design insight:
  - `E/MediaCodec: Service not found` is benign framework noise — the error is handled internally
  - `I/flutter: FormatException: Invalid JSON` is a real app error despite the `I/` (info) prefix
  - The prefix prevents false text-pattern promotion: `I/CCodecConfig: query failed` should NOT be classified as an error just because it contains "failed"
  - But the prefix IS useful as a baseline: `E/` lines from your own app code probably ARE errors
  - **Resolution** (commit `6136ce0`, v0.3.1): logcat prefix takes priority over text pattern matching. Content-type patterns (performance, TODO) still refine `D/`/`V/`/`I/` lines.
- **The "App Only" bug** (commit `a1c2490`, v0.2.5): The toggle only hid framework stack frames (`    at ...` lines), ignoring regular output. Android logcat lines (`D/FlutterJNI`, `D/FirebaseSessions`) passed through unfiltered. Had to extend classification to ALL line types — regular output, stack frames, logcat, and launch boilerplate. **Lesson:** a classifier that only handles stack frames will silently pass through everything else.
- **The `deemphasizeFrameworkLevels` setting** (v0.3.1): Framework log lines with `fw=true` no longer show error/warning text coloring when this setting is on. This resolves the visual mismatch where framework `E/` lines showed red text but a blue severity bar — confusing users into thinking framework noise was app errors.

### Key commits to reference
| Commit | Date | What happened |
|--------|------|---------------|
| `724716a` | Jan 27 12:42pm | Core capture: config, tracker, deduplication |
| `aa01038` | Jan 27 12:42pm | Session lifecycle, file retention, gitignore checker |
| `d23c836` | Jan 27 12:42pm | Wire extension entry point, status bar, commands |
| `240c6eb` | Jan 27 1:00pm | Sidebar log viewer with real-time streaming |
| `2c418c3` | Jan 27 6:09pm | Virtual scrolling for 100K+ lines |
| `bc49ad2` | Jan 27 6:02pm | ANSI-to-HTML converter |
| `8b456a0` | Jan 27 11:52pm | Fix dedup scan performance |
| `036da9a` | Feb 2 2:53pm | Verbose DAP logging, source location, elapsed time |
| `88b0546` | Feb 7 1:49am | Early event buffer (never lose data fix) |
| `6136ce0` | Feb 7 9:42am | Logcat prefix takes priority over text patterns |
| `a1c2490` | Feb 2 11:06pm | Scroll rewrite + prefix-sum arrays |

### Data flow diagram (for the article)
```
┌─────────────┐    DAP OutputEvent    ┌──────────┐
│ Debug       │ ──────────────────── │ tracker  │
│ Adapter     │                       │ .ts      │
│ (Dart, Node,│                       └────┬─────┘
│  Python...) │                            │
└─────────────┘                            ▼
                                    ┌──────────────┐
                                    │ deduplication │
                                    │ .ts           │
                                    └──────┬───────┘
                                           │
                                           ▼
                                    ┌──────────────┐
                                    │ session-     │
                                    │ manager.ts   │
                                    └──────┬───────┘
                                           │
                              ┌────────────┴────────────┐
                              ▼                         ▼
                       ┌─────────────┐          ┌──────────────┐
                       │ log-session │          │ broadcaster  │
                       │ .ts         │          │ .ts          │
                       │ (file write)│          │ (UI push)    │
                       └─────────────┘          └──────┬───────┘
                              │                        │
                              ▼                   ┌────┴────┐
                        reports/               ▼         ▼
                        session.log     sidebar    pop-out
                                        webview    webview
```

---

## Article 3: "From Log Viewer to Debugging Intelligence — How Features Evolve"

**Angle:** The journey from a simple log viewer to an analysis platform, told chronologically through the git history. Every feature is grounded in a specific commit, a specific bug, a specific user complaint, or a design decision that had to be argued for.

### Outline

#### 1. Day one: scaffold to marketplace in 2.5 hours (Jan 27 morning)
- **10:42am** `50072eb` — `yo code` scaffold
- **12:42pm** `c673bb7` through `d23c836` — 4 commits in 40 seconds (manifest, capture modules, session lifecycle, wiring). The core capture pipeline was built in one sitting.
- **1:00pm** `240c6eb` — sidebar log viewer with real-time streaming
- **1:01pm** `5c74b4b` — v0.1.0 published to marketplace
- At this point: auto-capture worked, viewer showed lines, ANSI colors rendered, but no search, no filters, no session history. The "minimum" in MVP.

#### 2. Day one afternoon: the real work begins (Jan 27 afternoon/evening)
- **1:32pm** `8554330` — Collapsible stack traces and pause indicator. Stack traces were detected by indentation (`    at ...`) and grouped under a header.
- **6:02pm** `bc49ad2` — ANSI-to-HTML converter. Debug output has ANSI escape codes; the viewer now renders them as colored `<span>` elements.
- **6:09pm** `2c418c3` — Virtual scrolling. First real log file had 12K lines; the viewer froze. Switched from DOM-per-line to virtual scrolling in one commit.
- **7:29pm – 7:46pm** `32f27d6` through `589e66c` — Stage 3 blitz: click-to-source, search with regex, category filter, keyboard shortcuts, session history tree, HTML export. Six features in 17 minutes of commits.
- **9:40pm – 10:50pm** `31e1515` through `21ee943` — Post-MVP Iteration A: keyword watch with live counters, flash animations, view badges. The keyword watcher data flow: DAP output → `session-manager.broadcastLine()` → `KeywordWatcher.testLine()` checks all patterns → hits attached to `LineData` as `watchHits[]` → status bar updates, sidebar badge increments, webview receives counts.
- **9:53pm – 10:00pm** `5c2a406` through `d8a2cd4` — Iteration B: pin lines, exclusion filters, multi-format copy, session rename/tagging with sidecar `.meta.json` files
- **10:09pm – 11:02pm** — Iteration C (annotations, elapsed time) and Iteration D (stack frame classification, app-only mode, dedup with count badges)
- **11:52pm** `8b456a0` — Fix stack parser false positives and dedup scan performance. Day one's code was fast enough for demos but O(n) on every line.
- At end of day one: 70+ commits, the extension had capture, viewer, search, stack traces, keyword watch, exclusion filters, annotations, elapsed time, and session history. All in one day.

#### 3. Day two: polish and the first refactoring crisis (Jan 28)
- **Morning:** Iterations E-G (auto file split, search analytics, interactive HTML export, deep links, auto-tag engine, custom highlight rules)
- **1:03pm** `a21a4da` — Filter presets, context menu, walkthrough, inline decorations. The viewer was getting feature-rich but the codebase was getting large.
- **The 300-line crisis:** By midday, 12 TypeScript files exceeded the 300-line limit. Commit `93847c0` (Jan 31) split them into 29 files. Then in v0.1.5, 6 more files (630-391 lines each) needed splitting into 17 modules (commit `b910238`). The 300-line hard limit was painful but forced better architecture.
- **End of Jan 28:** v0.1.0 on the marketplace with full feature set: export (HTML/CSV/JSON/JSONL), session comparison, templates, and the `scripts/dev.py` toolkit

#### 4. The CSP reckoning (Jan 31 evening)
- The extension worked perfectly in the Extension Development Host. Then someone installed the VSIX.
- **Commit `cf9487f` (Jan 31, 8:36pm):** `fix: viewer controls blocked by Content Security Policy` — Every single button was broken. Every `onclick` handler, every `onchange` handler — all blocked by CSP. This was the biggest single bug in the project's history.
- Root cause: inline event handlers like `<button onclick="foo()">` are blocked when CSP doesn't include `'unsafe-inline'` in `script-src`. The Extension Development Host is more permissive than a real install.
- Fix: Convert ALL inline handlers to `addEventListener` calls. This touched every interactive element in the viewer.
- **Commit `b01ce2d` (Jan 31, 8:37pm):** `color and button presses` — the follow-up fix for ANSI color rendering, also CSP-blocked
- **Lesson for the article:** Test your extension as a VSIX install, not just F5. The dev host lies to you about CSP.

#### 5. The viewer grows up — a bug safari (v0.1.3 – v0.1.15)
- **v0.1.3** (commit `93847c0`): First file size refactoring. Source tag filter, full debug console capture, line decorations, level filter, inline peek. Panel moved from sidebar to bottom panel (commit `4ebf7b6`) — log lines need horizontal space.
  - **CSP bug #2** (same release): `'unsafe-inline'` added for ANSI color rendering, but ALL inline `onclick`/`onchange` handlers were blocked too. Had to convert every handler.
  - **Filter coordination bug:** Applying one filter could override another's visibility decisions. Category filter would show a line that level filter had hidden. Fixed via shared `recalcHeights()`.
  - **Falsy-zero bug:** Setting `filterContextLines` or `contextViewLines` to 0 was treated as "use default" because `if (!value)` is true for zero. Had to use explicit `=== undefined` checks.
- **v0.1.4** (commit `4cd2e51`): Error breakpoints (flash + sound + badge), scrollbar minimap (8px overlay), search enhancements (case, whole word, regex)
  - **Session history empty viewer:** Selecting a log file resulted in blank viewer because the webview hadn't initialized yet. Added retry loop waiting up to 1 second.
  - **Session history sorting:** Mixed-format filenames (`HH-MM` vs `HHMMSS`) sorted incorrectly by date string. Fixed by sorting on file modification time instead.
  - **Double-click viewport jumping:** `scrollIntoView` caused random position changes because the virtual scrolling DOM is not the real document. Replaced with manual scroll calculation.
- **v0.1.5** (commit `b910238`): Stack trace preview mode (3 non-framework frames), 7 severity levels (Error/Warning/Info/Performance/TODO/Debug/Notice), audio volume control, visual spacing. Second file size refactoring: 6 files (630-391 lines each) split into 17.
- **v0.1.6** (commit `995ba00`): Smart error classification — CRITICAL/TRANSIENT/BUG badges. The moment the extension started having opinions about what errors mean.
- **v0.1.8** (commit `01aabfe`): A festival of silent failures:
  - **Ghost panel intercepting clicks:** Options panel hidden off-screen with `right: -25%`, but `min-width: 280px` meant it was partially visible in narrow viewports (z-index 250). It silently intercepted clicks on footer buttons including the options toggle itself. Fix: `right: -100%` with `pointer-events: none`.
  - **Doubled audio path:** `initAudio()` appended `/audio/` to a URI already pointing to the `audio/` directory → `audio/audio/swipe_low.mp3`. Sounds never loaded.
  - **Padding gibberish:** `padStart(5, '&nbsp;')` used the 6-character HTML entity `&nbsp;` as a JavaScript padding string. padStart treats it as 6 characters, so padding to width 5 truncated it to `#&nb` instead of displaying numbers.
  - **Dead audio mute code:** `audioMuted` variable, `toggleAudioMute()`, and `updateAudioMuteButton()` all referenced a nonexistent `audio-mute-toggle` element — no HTML, no event wiring. Pure dead code.
  - **Split breadcrumb wrong:** `setSplitInfo(totalParts, totalParts)` passed `totalParts` for both arguments. Breadcrumb always showed "Part N of N" regardless of actual position.
  - **Type assertion trap:** `version as string ?? ''` — TypeScript treats `as string` as a guarantee, so the `??` fallback is unreachable dead code.
- **v0.1.10** (commit `a06867b`): **The regex that killed the viewer.** An invalid character class `[=\\-+...]` in `isSeparatorLine` produced a character range from `\` to `+` where start > end → `SyntaxError`. All 33 concatenated scripts ran in one `<script>` block, so one error = total failure. Nothing worked.
  - Fix: Split into separate `<script>` blocks per feature (fault isolation). Added global error handler showing a red banner. Added build-time syntax validation test.
  - **Double-escaped regexes** (same release): `extractContext` used `\\\\s` / `\\\\d` which produced literal text `\s` / `\d` instead of whitespace/digit character classes. Template literal JavaScript doubly interprets escapes.
  - **Export join bug:** `lines.join('\\\\n')` produced literal backslash-n instead of newline characters.
  - **Race condition:** Loading a historical log file while webview was re-resolving (tab switch) could silently fail. Added generation counter and pending-load retry.
- **v0.1.11** (commit `01aabfe`): Viewer flickering — the minimap called `renderViewport` with `setTimeout(updateMinimap, 50)` on every scroll, creating a feedback loop (scroll → render → 50ms minimap DOM rebuild → layout recalc → scroll). Minimap marker placement was O(n²) — re-iterated all preceding lines for each marker. Session info referenced non-existent `handleSetContent` function.
  - **Decoration counter gibberish:** `padStart(5, '&nbsp;')` again, different location, same bug.
  - **Session info always blank:** Header lines stripped before reaching webview, plus JavaScript hook referenced a nonexistent function. Two independent failures masking each other.
- **v0.1.13** (commit `8377d09`): The great footer consolidation — 7 toggle buttons removed, options panel redesigned with logical sections.
  - **Options panel reading undefined `exclusionsActive`:** Checkbox was bound to a non-existent variable instead of `exclusionsEnabled`. Never reflected actual state.
  - **Preset "None" not working:** Called the wrong function — just cleared the preset name instead of calling `resetAllFilters()`.
  - **Mouse wheel scroll hijacking:** Custom `wheel` listener applied 0.5x multiplier and called `preventDefault()`, killing browser-native smooth/inertia scrolling. Choppy, erratic. Removed the handler entirely.
- **v0.1.15** (commit `68ae9ae`): Performance bug trifecta:
  - **ResizeObserver loop:** Called `renderViewport(true)` unconditionally, bypassing bail-out check. Every DOM replacement → resize observation → render → resize observation... RAF debounce fixed it.
  - **Layout thrashing:** `jumpBtn.style.display` write between DOM reads forced synchronous reflow on every scroll frame.
  - **`transition: all` stutter:** `#viewer-header` and `#error-badge` used `transition: all 0.2s ease`, animating layout properties during re-renders.

#### 6. The UI overhaul — design decisions and their consequences (v0.2.0 – v0.2.9)
- **v0.2.0** (commit `68c2ad0`, Feb 2): Icon bar — VS Code's own activity bar pattern, applied to the webview. Three icons (Sessions, Search, Options) with slide-out panels and mutual exclusion. Session history moved from native tree view to in-webview panel. This was the architectural pivot from "a viewer with some buttons" to "a mini-IDE panel."
  - **ID mismatch bug:** `level-warn-toggle` vs `level-warning-toggle` — abbreviated IDs in the button HTML but full names in `toggleLevel()`. `getElementById` returned null, `active` class never toggled. Same bug in `resetLevelFilters()`.
  - **Visual spacing never applied:** Logic ran after early returns for markers, stack-headers, and stack-frames — so it never executed. CSS selectors scoped to `.line` only. Had to move computation before early returns and broaden CSS selectors.
  - **Search blocking repaints:** `updateSearch()` ran synchronously on every keystroke — regex matching, height recalc, DOM render — all blocking the browser from repainting the input. Characters appeared to not register on large files. Fixed with 150ms debounce.
  - **Level circle counts invisible in dark mode:** No explicit `color` set, so browser default (black) was used regardless of theme. `color: inherit` fixed it.
- **v0.2.1** (commit `b544f41`, Feb 2, 2:13pm): CSP strikes again — icon bar icons invisible in dark mode.
  - **Click-outside handler killed search:** Clicking the mode toggle button inside the search panel triggered the document-level click-outside handler, closing the panel. Root cause: `textContent` assignment detaches the original click target text node, so `contains()` couldn't find it in the DOM anymore. Fixed by stopping propagation at the search bar boundary.
  - **Minimap scrolled away:** Positioned absolute inside the scrollable `#log-content` container. Moved to a non-scrolling wrapper.
- **v0.2.2** (commit `621d446`, Feb 2, 3:22pm): Pop-out viewer via broadcast architecture. The decision: should the pop-out be an independent viewer or a mirror? Chose mirror — `viewer-broadcaster.ts` forwards the same messages to all `ViewerTarget` instances. Both sidebar and floating panel show the same data, the same filters, the same live stream. Closing and reopening preserves the connection.
  - **Design decision — header bar removed:** Reclaimed vertical space by removing the filename + collapse toggle header. Filename and version moved to footer as `·`-separated segments: `● 42 lines · dart_session.log · v0.2.2`.
  - **Banner image 404:** README pointed to wrong GitHub repo (`saropa_lints`). Nobody noticed until marketplace page showed a broken image.
- **v0.2.3-v0.2.4** (Feb 2): UX polish day.
  - **Stats counters accumulating across file loads:** Level counts listened for 'reset' but not 'clear'. Loading a new file sent 'clear', not 'reset'. Phantom counts misled users about current file content.
  - **Context lines UX feedback** (from `bugs/history/errors-showing-after.md`): User reported "The context should be the records leading UP to the error and possibly 1 after. Currently it looks like 3 records after only." Led to redesigning context line display in v0.2.9 with dashed separators and dimmed styling.
  - **Level flyup redesigned multiple times:** v0.2.0 had inline circle buttons. v0.2.3 redesigned as rows with emoji + text + count. v0.2.5 changed to clickable dots + fly-up menu. v0.2.9 added double-click to solo. Each iteration responded to confusion about what the dots meant and how to interact with them.
  - **Search toggles redesigned:** Replaced custom text buttons with codicon icons (`codicon-case-sensitive`, `codicon-whole-word`, `codicon-regex`) positioned inline inside the search input, using VS Code's `--vscode-inputOption-*` theme variables. Matching VS Code's own search layout reduced learning curve.
- **v0.2.5** (commit `a1c2490`, Feb 2, 11:06pm): **The big one.** Context menu (12 actions), Go to Line, Page Up/Down, keyboard zoom, Ctrl+A, CSS animations, and — most importantly — **complete virtual scrolling rewrite**:
  - Prefix-sum array replaces O(n) linear scans with O(log n) binary search
  - Stack frame height lookup: O(n²) → O(1) via cached group headers
  - Row height measured from DOM instead of hardcoded (font size changes no longer break spacer heights)
  - Trimming old lines (50K limit) adjusts scroll position by removed height
  - Auto-scroll no longer causes double-render feedback loops
  - **Minimap redesigned from invisible 8px overlay to 60px interactive panel.** The original minimap was rendered at 8px wide behind the native scrollbar, invisible to users. Redesigned as a flex-sibling panel that replaces the native scrollbar. Supports click-to-scroll, drag-to-scroll, and mouse wheel forwarding.
  - **"App Only" fixed to classify ALL line types.** The biggest functional bug — the toggle only filtered stack frames (`    at ...`), not regular logcat lines. `D/FlutterJNI`, `D/FirebaseSessions`, `I/Choreographer` all passed through. Extended `isFrameworkLogLine()` to detect logcat tags and launch boilerplate.
  - **Feature removed — source preview hover popup:** Floating tooltip on stack trace source links was easily triggered accidentally and obscured content. Removed entirely. Click-to-source already worked.
  - **Feature removed — minimap toggle:** Made always-on because there's no reason not to have it.
  - **Design decision — double-click restores native behavior:** Removed the double-click handler for inline peek. Users expected double-click to select words. Peek moved to right-click → "Show Context."
- **v0.2.6** (commit `270f5c2`, Feb 3, 10:08am): Bookmarks panel, Find in Files (concurrent search across all log files), configurable file types, source link context menu, inline Go to Line replacing VS Code roundtrip. NINE minimap bugs fixed:
  - Markers stacked at top (percentage-based positioning failed in flex)
  - Empty minimap for info-level content
  - No update on panel resize
  - Click-vs-drag conflated (any mouse movement after click caused scrolling)
  - Drag scrolling erratic (`suppressScroll` reset too early)
  - Stale cached height in scroll mapping
  - `deltaMode` not handled (line/page scroll modes barely moved content)
  - Markers hidden behind viewport indicator (z-index)
  - Missing performance markers (only errors/warnings shown)
  - **False "performance" classification:** `slow` and `lag` keywords in the performance regex matched words like "slow-cooked" in normal log data.
  - **Right-click line detection broken:** Log line elements were missing `data-idx` attributes. Context menu couldn't identify which line was right-clicked. All line-specific menu items (Copy Line, Pin, etc.) were invisible.
- **v0.2.7-v0.2.8** (Feb 3): More CSP and icon issues.
  - `codicon-search-view` doesn't exist in codicons 0.0.44 — had to use `codicon-list-filter` instead. No error, just a blank square where the icon should be.
  - Bookmarks panel moved from separate tree view to icon bar slide-out. The native tree view, its commands, and its menu entries were all removed.
  - Context menu clipped at top of viewport: right-clicking the top row pushed the menu to negative `top`, hiding items. Clamped to viewport edges with `max-height` + `overflow-y: auto`.
  - CSP nonces in `style-src` silently disabled `'unsafe-inline'`, blocking inline `style` attributes on level dots. Had to move ALL inline visual styles to CSS classes loaded via the nonce-tagged `<style>` block.
- **v0.2.9** (commit `7db51c0`, Feb 5-7):
  - **Level detection mode** (`strict` vs `loose`): Previous behavior flagged lint descriptions like "complicates error handling" as errors. Strict mode requires keywords in label positions (`Error:`, `[ERROR]`, `TypeError:`). Loose mode matches keywords anywhere but excludes descriptive compounds (`error handling`, `error recovery`).
  - **Double-click to solo a level filter** (from `bugs/history/double-click-dot.md`): User feedback: "double clicking a color dot hides all others. this is great. but double clicking again should select all." Implemented the toggle-back behavior.
  - **`retainContextWhenHidden`** — the big fix. Switching tabs destroyed everything. One-line fix, 4 hours of debugging.
  - **Mousewheel scrolling jumps:** Fast scroll with acceleration caused jumps to start/end. Root cause: Chromium's `overflow-anchor` CSS property couldn't find stable anchor nodes after virtual scrolling DOM rebuilds. Fixed by disabling `overflow-anchor` entirely and intercepting wheel events with manual `scrollTop` control.
  - **Click-to-source spawning new editor groups:** `ViewColumn.Active` resolved to the sidebar webview instead of an editor column. Every click opened a new split. Now targets the last-focused text editor's group.
  - **Search text erased while typing:** In highlight mode, every debounced keystroke called `clearSearchFilter()` → `recalcAndRender()` even though highlight mode never sets `searchFiltered` flags. This triggered a full O(n) height recalc, prefix-sum rebuild, and viewport render that was completely unnecessary — and also cleared the search input. Added `searchFilterDirty` flag to short-circuit.
  - **Search mode toggle broken by the above bug:** Switching from highlight to filter mode guarded `updateSearch()` behind `searchInputEl.value` — which was empty because the input had been cleared. Removed the guard so mode switches always re-run search.

#### 7. Debugging intelligence — the cross-session analysis system (v0.3.x — Feb 7)
- **The overnight push:** Commits `88b0546` through `6136ce0` (Feb 7, 1:49am – 9:42am) — four massive feature commits in 8 hours
- **What started as "search other sessions"** became a 28-file, ~3,000-line multi-dimensional investigation surface (documented in `bugs/discussion/cross-session-analysis.md`):

  **The architecture: five parallel streams**
  When a user right-clicks a log line → "Analyze Line," the system:
  1. Extracts tokens from the line text (source files, error classes, HTTP status codes, URLs, quoted strings, class.method patterns) via `line-analyzer.ts` (46 lines)
  2. Extracts stack frames below the error from the log file, classifying each as APP vs FW
  3. Builds a progressive HTML shell with spinner placeholders
  4. Launches five concurrent analysis streams:
     - `runSourceChain()` → source file lookup, git blame, diff summary, line-range history, import extraction (12 languages: Dart, TS, JS, Python, Go, Rust, Java, Kotlin, Swift, C/C++, C#, Ruby, PHP)
     - `runDocsScan()` → search project markdown files for token matches
     - `runSymbolResolution()` → VS Code workspace symbol provider lookup
     - `runTokenSearch()` → concurrent scan of all past session files, capped at 50 results
     - `runCrossSessionLookup()` → fingerprint the error line (FNV-1a hash after normalizing timestamps, UUIDs, numbers, hex addresses, paths), match against all session metadata
  5. `Promise.allSettled()` collects metrics from all streams
  6. `scoreRelevance()` produces findings + section collapse levels
  7. Executive summary banner: 2-4 relevance-scored insights. Low-relevance sections auto-collapse.

  **Design decisions made along the way:**
  - **QuickPick vs webview for analysis results?** Webview panel — richer, persistent, supports progressive loading. QuickPick can't show multi-section results.
  - **Auto-tags: eager or lazy?** Eager — computed on session end via `correlation-scanner.ts`. No runtime cost for viewing.
  - **Git cached or fresh?** Fresh — git is fast enough for blame + log; no caching layer adds complexity.
  - **Non-git projects?** Graceful skip — git functions return empty arrays, sections show "no data." Never crash.
  - **Progressive rendering:** Sections appear independently as their data arrives — spinners → content. User sees results within 200ms even if the full analysis takes 2 seconds.
  - **Cancellation:** AbortController-based. User can stop mid-flight. Each stream checks the signal.

  **Key design principles from the cross-session analysis doc:**
  1. Speed over completeness — analysis should feel instant
  2. Index lazily — don't scan all files on activation
  3. Progressive disclosure — start with summary, expand into details
  4. Non-destructive — analysis is read-only; metadata goes in sidecars
  5. Two-directional — bridge logs ↔ source; logs explain what happened, source explains why
  6. Silence is golden — don't show sections with no data
  7. Attention is finite — score, rank, collapse, summarize

- **Commit `88b0546` (1:49am):** Cross-session analysis, correlation tags, early output buffering. Error fingerprinting: normalize the error text (strip timestamps, UUIDs, numbers), hash with FNV-1a, store in sidecar `.meta.json`. Identical errors across sessions get the same fingerprint even with different timestamps or IDs.
- **Commit `938d822` (2:34am):** Bug report generation — right-click an error line → "Generate Bug Report" → structured markdown with: error + fingerprint, stack trace (app vs framework frames with badges), log context (15 lines before), environment, dev environment (git state, runtime versions), source code around crash site, git history, imports, documentation references, symbols, cross-session matches. Auto-copied to clipboard and shown in preview panel.
  - **Session timeline:** SVG chart plotting errors/warnings/performance issues over time. Click a dot to navigate to that line. Dense sessions are auto-bucketed for smooth rendering.
- **Commit `5477ca9` (7:33am):** Deep analysis with progressive loading, docs scanner, import extraction, symbol resolution.
- **Commit `6136ce0` (9:42am):**
  - **Executive summary:** "Key Findings" banner with 2-4 relevance-scored insights. Scoring considers: recent blame (HIGH), recurring error (HIGH), nearby FIXME/BUG annotations (MEDIUM), doc references (LOW).
  - **Root cause correlation:** When a crash line was recently modified, the system compares the git blame date against the error fingerprint's cross-session first appearance. A match within 3 days → "Error likely introduced by commit `abc1234`." Includes commit diff summary (files changed, insertions, deletions).
  - **Stack trace deep-dive:** Frames parsed and displayed with APP/FW badges. Click an app-code frame → inline source preview + git blame. Framework frames dimmed, not clickable.
  - **Error trend chart:** Recurring errors show a compact SVG bar chart of occurrences per session. Turns "Seen 5 times across 3 sessions" into a scannable visual timeline.

- **Logcat classification fix** (same release): `I/CCodecConfig: query failed` was misclassified as 'error' because text pattern matching overrode the logcat prefix `I/`. Now the prefix takes priority. This is philosophically interesting: the log level prefix is just the opinion of the code author. Framework `E/` logs are often benign (`E/MediaCodec: Service not found` is handled internally). The prefix prevents false text-pattern promotion (e.g. `I/` + "failed" should not = error).

#### 8. Patterns that emerged over 180 commits

**The composable filter pattern:**
Every filter (category, level, exclusion, app-only, search, source tag) follows the same pattern:
1. Store classification on the line item in `addToData()` (e.g. `item.fw`, `item.level`)
2. Set a filter flag (e.g. `item.levelFiltered = true`) in an apply function
3. Add the flag check to `calcItemHeight()` — the SINGLE source of truth for visibility
4. Call `recalcHeights()` then `renderViewport(true)`
5. Set initial height correctly in `addToData()` — new lines arriving while a filter is active must respect it
6. Never filter markers — always skip `item.type === 'marker'`
This pattern emerged from commit `a1c2490` (v0.2.5) after discovering that filters were overriding each other — category filter would show a line that level filter had hidden. Now they compose: if ANY filter says hide, the line is hidden.

**The settings pipeline (8 steps):**
A setting goes: `package.json` (definition) → `config.ts` (interface + reader) → `extension.ts` (reads config, calls `broadcaster.setXxx()`) → `viewer-target.ts` (interface method) → `viewer-broadcaster.ts` (forwards to all targets) → `log-viewer-provider.ts` / `pop-out-panel.ts` (`postMessage()` to webview) → webview JS (receives message, sets JS var) → rendering code (uses the var). Eight steps. Miss one link and the feature breaks silently with no error. The `fw` flag travels: `classifyFrame()` (extension side) → `PendingLine.fw` (batch message) → `addToData(... fw)` → stored on `lineItem.fw`. If any link drops the property, the feature breaks silently.

**The 300-line discipline:**
- Commit `93847c0` (v0.1.3): 12 files over 300 lines → 29 files
- Commit `b910238` (v0.1.5): 6 more files (630-391 lines) → 17 new modules
- Commit `fa17393` (v0.1.11): `commands.ts` (305 lines) → split `commands-comparison.ts`
- Commit `a28ec3e` (v0.2.1): `dev.py` (1,756 lines) → 9 modules
- Every time, the forced split improved the architecture. Viewer styles split into `viewer-styles.ts`, `viewer-styles-ui.ts`, `viewer-styles-modal.ts`. Scripts split into `viewer-script.ts`, `viewer-search.ts`, `viewer-data-helpers.ts`, `viewer-context-menu.ts`.
- Compression strategies when approaching the limit: remove JSDoc from non-exported functions, inline comments in template strings, consolidate blank lines.

**Classification must cover ALL line types:**
The "App Only" bug (v0.2.5) taught this: the framework filter only classified stack frames (`    at ...` lines). Regular logcat lines (`D/FlutterJNI`, `I/Choreographer`) passed through unfiltered. Lesson: when classifying lines, the classifier must handle every line format — regular output, stack frames, logcat, launch boilerplate. A classifier that only handles stack frames will silently pass through everything else.

**The webview sandbox forces good architecture:**
No shared state between extension and webview. Every piece of data must be explicitly sent via `postMessage`. This sounds like a pain, but it forced a clean separation that made the broadcast pattern (v0.2.2) trivial — just forward the same messages to multiple webview targets. It also made the analysis panel possible — the five parallel analysis streams each post their HTML independently, and the webview inserts them into the correct placeholder.

**Removing features is as important as adding them:**
- v0.2.4: Removed the `×` clear button from search input (Escape works, select-all+delete works)
- v0.2.5: Removed source preview hover popup (accidentally triggered, obscured content)
- v0.2.5: Removed minimap toggle (always-on, no reason to hide it)
- v0.2.5: Removed watch count chips from footer (duplicated level classification counts)
- v0.2.2: Removed "Show inline context (file >> function)" option — it never worked for regular log lines, only stack frames
- v0.1.8: Removed dead `audioMuted` code referencing nonexistent HTML elements

#### 9. UX decisions that went back and forth

**The level filter UI (4 redesigns):**
1. v0.1.3: All/Errors/Warn+ segmented buttons in footer
2. v0.2.0: 7 inline level-circle buttons with count overlay
3. v0.2.0: Compact dots with fly-up popup containing full toggle buttons
4. v0.2.3: Dots enlarged, opacity raised, "Levels" label added, emoji+text+count rows in flyup
5. v0.2.5: Dots directly toggle on click, "All"/"3/7" label opens flyup
6. v0.2.9: Double-click to solo a level, zero-count dots hidden

Each change responded to real confusion: users didn't know the dots were interactive, couldn't tell active from inactive states, didn't discover the fly-up existed, or couldn't tell how many of each level existed.

**Where should the log viewer live?**
- v0.1.0: Sidebar (Activity Bar) — provided dedicated space but narrow width
- v0.1.3: Bottom panel (next to Output/Terminal) — more horizontal space for log lines
- Stayed in bottom panel. Log lines need width.

**Double-click behavior:**
- v0.1.3: Double-click opens inline peek (surrounding context)
- v0.2.5: Reverted to native word selection. Peek moved to right-click → "Show Context."
- Users expected double-click to select words. Overriding a universal behavior was wrong.

**Session info display (3 redesigns):**
- v0.1.5: Collapsible header block at top of viewer (never worked — data stripped before reaching webview, JS hook referenced nonexistent function)
- v0.1.11: Compact prefix line + ℹ️ button opening a modal (modal persisted across session loads — `clear` handler dismissed peek but not modal)
- v0.2.2: Moved to icon bar slide-out panel with mutual exclusion

#### 10. By the numbers

| Metric | Value |
|--------|-------|
| Time from scaffold to marketplace | 2 hours 19 minutes |
| Total development time | 11 days (Jan 27 – Feb 7) |
| Commits | 180 (non-merge) |
| TypeScript source files | 188 |
| Lines of TypeScript | ~25,500 |
| Published versions | 10 tagged releases |
| CSP-related bug fixes | 5+ separate incidents |
| File size refactorings | 4 major splits |
| Virtual scrolling rewrites | 3 (basic, prefix-sum, overflow-anchor fix) |
| Minimap redesigns | 3 (invisible overlay, always-on panel, interactive) |
| Minimap bugs fixed in v0.2.6 alone | 9 |
| Level filter UI redesigns | 6 |
| Cross-session analysis modules | 28 files, ~3,000 lines |
| Languages supported by import extractor | 12 |

#### 11. What's next — and the tension of scope
- **The fundamental question:** The design principle says "one problem, perfectly — capture debug output, nothing else." But v0.3.x added cross-session analysis, bug report generation, root cause correlation, and error trend charts. Is this still a log capture extension, or has it become a debugging platform?
- **Future ideas under discussion** (from `bugs/discussion/cross-session-analysis.md`):
  - **Predictive error surfacing:** On session end, auto-score all errors for relevance. "Your latest session has 2 recurring errors and 1 new error in recently-changed code." The user doesn't have to hunt.
  - **"What Changed?" regression detector:** Automatically compare against previous session. New errors, disappeared errors, output volume changes.
  - **Ghost errors — intermittent bug tracker:** Track error frequency across sessions. `SocketException` appears in 60% of sessions (intermittent), `NullPointerException` in 100% (consistent).
  - **Debugging velocity score:** How many sessions to resolve an error? Track fix rate over time.
  - **"Why Did This Break?" story mode:** Template-based narrative combining blame data, commit messages, cross-session frequency, and import changes into a human-readable explanation.
- **The multi-log mode question** (from `bugs/discussion/multi-log-mode.md`): Users want to step through sessions seamlessly. Stage 1 (navigation bar) is shipped. Stage 2 (concatenated view) is planned. Stage 3 (endless scroll) is deferred because prepending breaks the virtual scrolling architecture — every assumption is append-only.
- **What we chose NOT to build:** A filter bar in the view title (VS Code API doesn't support text inputs there — documented evaluation in `bugs/discussion/view-title-filter-bar.md`). A custom minimap right-click menu (VS Code doesn't expose it — documented in `bugs/discussion/minimap-context-menu-shows-irrelevant-actions.md`). These limitations shaped what we built instead.

### Key changelog entries to quote verbatim
- **v0.1.10 regex kill:** "An invalid character class range in `isSeparatorLine` (`[=\\-+...]` produced range `\` to `+` with start > end) caused a SyntaxError that killed the entire webview script block."
- **v0.2.5 scroll rewrite:** "Complete rewrite of the virtual scrolling system. Toggling filters, collapsing stack traces, or changing font size no longer jumps the view to a random position — the first visible line stays anchored."
- **v0.2.9 tab switch:** "Switching from the Saropa Log Capture panel to another bottom panel tab (Problems, Output, Terminal, etc.) and back reset the entire viewer — deselecting the file, clearing filters, losing scroll position, and resetting all options."
- **v0.3.1 logcat fix:** "Android logcat prefixes (`E/`, `W/`, `I/`, `D/`, `V/`, `F/`) are now used as the primary level signal. Previously, text pattern matching could override the prefix — e.g. `I/CCodecConfig: query failed` was misclassified as 'error' due to the word 'failed'."
- **v0.3.1 early buffer:** "The DAP tracker activates synchronously but session initialization is async (disk I/O). Output events arriving during this window were silently dropped."
- **v0.1.8 options panel ghost:** "The slide-out options panel used `right: -25%` to hide off-screen, but with `min-width: 280px` it remained partially visible in narrow sidebar viewports (z-index 250), silently intercepting clicks on footer buttons including the options toggle."
- **v0.1.8 doubled path:** "`initAudio()` appended `/audio/` to a URI that already pointed to the `audio/` directory, creating an invalid path like `audio/audio/swipe_low.mp3`."
- **v0.1.11 padding gibberish:** "`padStart(5, '&nbsp;')` used the 6-character literal HTML entity as a JavaScript padding string, causing truncated gibberish `#&nb`."
- **v0.2.1 click-outside kill:** "Toggle buttons were especially affected because `textContent` assignment detaches the original click target text node, making `contains()` fail."
- **v0.2.9 search erased:** "Every debounced keystroke called `clearSearchFilter()` → `recalcAndRender()` even though highlight mode never sets `searchFiltered` flags — triggering a full O(n) height recalc, prefix-sum rebuild, and viewport render that was entirely unnecessary."
- **v0.2.5 App Only bug:** "The 'App only (hide framework)' toggle only hid framework stack frames (`    at ...` lines), ignoring regular output. Android logcat lines (`D/FlutterJNI`, `D/FirebaseSessions`, `I/Choreographer`, etc.) passed through unfiltered."

### Bug report sources used
| Source file | What it contributed to the articles |
|-------------|-------------------------------------|
| `bugs/logcat.md` | Android log level system, tag ≠ app, `Log.wtf()` = "What a Terrible Failure" |
| `bugs/history/app-only-off-does-not-capture-all.md` | Full investigation: 3 root causes, DAP limitation, verbose DAP diagnostic |
| `bugs/history/double-click-dot.md` | User feedback driving UX: "double clicking again should select all" |
| `bugs/history/errors-showing-after.md` | Context lines showing after error, not before — led to redesign |
| `bugs/discussion/cross-session-analysis.md` | 28-module architecture, design principles, future roadmap, 20 feature ideas |
| `bugs/discussion/multi-log-mode.md` | Why endless scroll is hard (append-only assumptions), staged approach |
| `bugs/discussion/view-title-filter-bar.md` | VS Code API limitations, 4-option evaluation, why we can't replicate native filter bars |
| `bugs/discussion/minimap-context-menu-shows-irrelevant-actions.md` | VS Code API boundary — can't customize minimap context menu |

---

## Series Metadata

| Field | Value |
|-------|-------|
| **Target length** | 2,500 - 4,000 words each |
| **Tone** | Technical but conversational, first-person plural ("we"), war-stories style |
| **Code samples** | Short focused snippets + commit hashes for readers to explore |
| **Audience** | VS Code extension developers, Flutter/mobile devs, tooling enthusiasts |
| **Publishing** | Dev.to, Medium, or project blog |
| **Cross-links** | Each article references the others; Article 3 links back to 1 and 2 |
| **Repo link** | `https://github.com/saropa/saropa-log-capture` |

## Suggested Titles (alternatives)

### Article 1
- "Ship Your First VS Code Extension: A Complete VSIX Guide"
- "The Anatomy of a VS Code Extension — From yo code to Marketplace"
- "2.5 Hours from Scaffold to Marketplace: Building a VS Code Extension"

### Article 2
- "Your Debug Console Output Deserves Better"
- "Building a Zero-Config Debug Log Capture for VS Code"
- "The Debug Adapter Protocol Trick That Saves All Your Logs"

### Article 3
- "What Happens When You Keep Saying Yes to Feature Requests"
- "From 500 Lines to 25,000: How a Log Viewer Became a Debug Platform"
- "180 Commits in 11 Days: The Real Story of Building a VS Code Extension"
- "9 Minimap Bugs, 6 Level Filter Redesigns, and 5 CSP Incidents"
