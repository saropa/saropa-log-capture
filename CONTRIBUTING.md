# Contributing to Saropa Log Capture

Thank you for your interest in contributing! This document provides guidelines for contributors.

## Commit messages

- **No editor or tool trailers.** Do not add "Made-with: Cursor" or similar lines to commit messages. A `commit-msg` hook is provided to enforce this; install with: `cp scripts/git-hooks/commit-msg .git/hooks/commit-msg` (and `chmod +x .git/hooks/commit-msg` on Unix).

## Design Principles

These principles guide all development decisions:

1. **Zero Friction** — Works immediately on install. No config file to create, no project setup, no onboarding wizard.

2. **One Problem, Perfectly** — This is NOT a logging framework, NOT a log analysis platform, NOT a monitoring tool. It does ONE thing: captures VS Code Debug Console output to persistent files with a good viewer.

3. **Progressive Disclosure** — Simple surface, power underneath. A new user sees: sidebar with scrolling log, status bar with line count, log file on disk. A power user discovers: regex search, keyword watch, custom highlight rules, session comparison, file split rules.

4. **Multiple Surfaces, One Data Stream** — The same captured log data appears in: the sidebar viewer (real-time), the status bar (summary), the file on disk (persistence), the session history (archive), notifications (alerts).

5. **Never Lose Data** — Every line captured is written to disk immediately (append, not batch-write-on-close). If VS Code crashes, the log file is intact up to the last line.

6. **Respect the Host** — Use native VS Code patterns: TreeView for history, WebviewView for the viewer, status bar for counters, `--vscode-*` CSS variables for theming.

7. **Power User Escape Hatch** — Every automated behavior has a manual override.

8. **Performance is a Feature** — Virtual scrolling for 100K+ lines. Batched UI updates (200ms). Streaming file writes.

## Terminology Standard

Consistent vocabulary for all user-facing text in Saropa Log Capture.

**Scope:** Commands, settings descriptions, status bar, webview UI, notifications, walkthrough, README, CHANGELOG. Internal code (class names, variable names) is not required to change, but new code should prefer these terms.

**Notes:** For maintainability we also have to rename files and methods when touching related code. For discoverability, prefix "SAROPA" in the title of ALL windows opened in the main VS Code window (e.g. "Cross-Session Insights" → "SAROPA: Cross-Log Insights").

### Core Terms

| Term | Meaning | Use for | Never use |
|------|---------|---------|-----------|
| **Log** | A single recorded debug output, from start to finish | The thing you start, stop, rename, tag, clear, export, compare | "session", "capture" (as noun), "recording" (as noun) |
| **Log file** | The `.log` file on disk | The file you open, delete, split, search | "session file", "capture file" |
| **Line** | One text entry in a log | Status bar count, search results, filters | "message", "entry", "output" (for individual items) |
| **Log Viewer** | The main webview component | The panel you read logs in, pop out, interact with | "sidebar", "sidebar viewer" |
| **Panel** | A slide-out section within the Log Viewer | Project Logs panel, Filters panel, Options panel, etc. | "sidebar" (for these sub-sections) |
| **Capture** | The verb/action of recording debug output | "Start/stop capture", "captures debug output" | As a noun for the recorded unit |
| **Recording** | The active capture state | Status bar indicator when a log is being captured | As a noun for the recorded unit |

### Command Naming

Commands use the format: `Saropa Log Capture: <Verb> <Object>`

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

**Tree/Context menu:** Use "Rename Log", "Tag Log"; "Move to Trash" and "Restore from Trash" are already correct.

### Settings Naming

Settings use the prefix `saropaLogCapture.` Existing setting keys (`maxLogFiles`, `logDirectory`, `autoOpen`) are already "log"-based and should **not** change (breaking change for users). Only **descriptions** need updating to use consistent terminology. Any setting description that says "session" should say "log" instead.

### Webview UI Text

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

### Status Bar

| State | Current | Proposed |
|-------|---------|----------|
| Active | Recording. Click to open log file | **Recording. Click to open log file** (already correct) |
| Paused | Paused | **Paused** (already correct) |
| Count | N lines | **N lines** (already correct) |

"Recording" is kept as the state indicator — it's universally understood and short.

### Documentation (README, CHANGELOG)

- **README:** Use "log" (not "session") when referring to recorded output; "log file" (not "session file") for files; "Log Viewer" (not "sidebar viewer" or "panel viewer"); "Capture" only as a verb or in the extension name.
- **CHANGELOG:** New entries must follow this standard; existing entries are not retroactively edited (historical record).

### Exceptions

1. **Extension name:** "Saropa Log Capture" — "Capture" is part of the brand, not a term for the recorded unit.
2. **Internal code:** Class names like `LogSession`, `SessionManager` do not need renaming (internal only, would be a large refactor with no user benefit).
3. **VS Code API terms:** "Debug session" in VS Code API documentation context is fine since it refers to the VS Code concept, not our concept.
4. **DAP terminology:** "DAP output categories" in technical setting descriptions is acceptable.
5. **Existing setting keys:** Never rename setting keys (breaks user configs). Only update descriptions.

### Quick Reference

When writing user-facing text, ask:

- **What do you start/stop?** → A capture (verb) that produces a **log**
- **What's on disk?** → A **log file**
- **What's one text item?** → A **line**
- **Where do you read logs?** → The **Log Viewer**
- **What are the sub-sections?** → **Panels** (Project Logs panel, Filters panel, etc.)

## Code Quality Standards

### Hard Limits

- Functions: max 30 lines
- Parameters: max 4 per function
- Nesting: max 3 levels deep
- Files: max 300 lines

### Style Guidelines

- Use `const` by default, `let` only when reassignment needed
- Prefer `interface` over `type` for object shapes
- Use early returns / guard clauses
- Trailing commas in multi-line constructs
- Semicolons required

### VS Code API Patterns

- Use `vscode.workspace.fs` for all file operations (not node `fs`)
- Use `vscode.Uri.joinPath()` for path construction
- Register all disposables via `context.subscriptions.push()`
- Read settings fresh on each use — users can change them mid-session

## Documentation

### File-level doc headers

Every source file should start with a JSDoc block that describes:

- **What** the file is responsible for (one or two sentences).
- **When relevant**: key behavior, integration points, or "see also" references.

Use `/** ... */` before the first import. One line is fine for simple modules; use multiple lines for non-obvious or critical modules (e.g. message routing, config loading).

### JSDoc for public APIs

- **Exported functions and classes**: Add a short description. Use `@param` and `@returns` when the signature is not self-explanatory.
- **Exported interfaces/types**: Document the type and any non-obvious fields (e.g. units, valid values).
- **`@example`**: Use sparingly, only when it clarifies usage (e.g. pattern parsing, regex formats).
- **`@throws`**: Document when callers must handle specific errors.

Keep descriptions concise; avoid restating the name. Prefer "Returns the compiled rule set" over "This function returns the compiled rule set."

### Inline comments

- **Explain why, not what.** Prefer comments for non-obvious logic, workarounds, and magic numbers.
- **Branches and edge cases**: A short comment on non-obvious branches (e.g. "Skip when session is still recording") helps future readers.
- **Bug fixes**: Use a brief "BUG FIX:" or "Workaround:" when the code exists to address a specific issue.
- **Avoid noise**: Do not comment the obvious (e.g. "increment counter" above `i++`).

### Examples

**File header (concise):**

```ts
/** Dispatches incoming webview messages for the log viewer to the appropriate handlers. */
```

**File header (richer):**

```ts
/**
 * Highlight Rule Engine
 *
 * Pattern-based highlighting for log lines. Rules support plain strings (case-insensitive)
 * or regex literals (/pattern/flags). Stackable and priority-based; uses VS Code theme colors.
 */
```

**Function with params:**

```ts
/**
 * Compiles user highlight rules into efficient matchers. Invalid rules are skipped.
 * @param rules - Rules from user settings
 * @returns Compiled rules for matching; call once when rules change, not per line.
 */
```

**Inline (why, not what):**

```ts
// Skip when session is still recording so we don't rewrite under the writer's feet.
if (isSessionActive) { return; }
```

## Testing

### Where tests live

- Unit tests are in `src/test/`, mirroring `src/`: e.g. `src/test/modules/config/config.test.ts` for `src/modules/config/config.ts`.
- Tests use the **Mocha** API (`suite`, `test`) and run via **vscode-test** (Extension Development Host). Run with: `npm run test`.

### What to test

- **Public API**: Exported functions and classes; focus on behavior, not implementation.
- **Edge cases**: Empty input, boundary values, invalid or unexpected arguments.
- **Pure logic first**: Modules that do not depend on `vscode` or the file system are easiest to test; add tests when adding or changing such logic.

### When to add tests

- **New features**: Add tests for new public functions or notable branches.
- **Bug fixes**: Add a regression test that would have caught the bug.
- **Refactors**: Use existing tests to confirm behavior is unchanged.

### Running tests

```bash
npm run test
```

The `pretest` script runs type-check, lint, and compile first. Tests run inside a VS Code Extension Host; the first run may take longer while the test environment is set up.

### Coverage

```bash
npm run test:coverage
```

Runs tests with c8 and prints a coverage report. Note: many tests run inside the VS Code Extension Host (child process), so reported coverage may not include all code paths exercised there. Coverage is most accurate for pure logic tested in the same process (e.g. `selectFilesToTrash`, `EarlyOutputBuffer`, `FloodGuard`).

## Error handling, param validation, and logging

### Error handling

- **Boundaries**: Use try/catch at boundaries (message handlers, command handlers, async entry points). Log the error and either rethrow (with a clear message) or show a user-facing message and return.
- **Avoid empty catch**: Prefer `catch (err) { logError('context', err); throw new Error('...'); }` or handle meaningfully. If you intentionally swallow (e.g. "file not found"), add a one-line comment.
- **User-facing vs. log**: Use `vscode.window.showErrorMessage` / `showWarningMessage` for user-visible feedback; use the shared **extension logger** (see below) for diagnostic details so support can troubleshoot.

### Parameter validation

- **Public API**: Validate required parameters at the start of exported functions: early return or throw with a clear message if a required value is missing or invalid.
- **Defensive checks**: For values from the webview, config, or file system, coerce types (e.g. `Number(msg.lineIndex ?? -1)`) and guard against out-of-range or invalid state before use.
- **Helpers**: Use `assertDefined(value, name)` (from `modules/misc/assert`) for required non-null values in hot paths when you want a clear diagnostic on misuse.

### Warning and error logging

- Use the **extension logger** (`getExtensionLogger()`) so all messages go to the "Saropa Log Capture" output channel. Call `setExtensionLogger(channel)` once from the extension entry point.
- **Levels**: Use `logExtensionError` for failures and unexpected conditions; use `logExtensionWarn` for recoverable or degraded behavior; use `logExtensionInfo` sparingly (e.g. session start/stop, retention run).
- **Content**: Include a short context (e.g. "editLine", "file retention") and the error message or key data. Avoid logging secrets or full paths to user data unless necessary for support.

## Development Workflow

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes
4. Run quality checks:
   ```bash
   npm run check-types   # TypeScript type checking
   npm run lint          # ESLint
   npm run compile       # Full build
   npm run test          # Run tests
   ```
5. Test manually: press **F5**. When the Extension Development Host window opens, if you see "All installed extensions are temporarily disabled", click **Reload and Enable Extensions**. Then click the **Saropa Log Capture** icon in the left activity bar to open the viewer. Start a debug session in that window to see capture in action.
6. Commit with descriptive message
7. Open a Pull Request

## Publishing Prerequisites

To publish to the VS Code Marketplace, you need three things (in this order):

1. A **marketplace publisher** on marketplace.visualstudio.com
2. An **Azure DevOps organization** on dev.azure.com (same Microsoft account)
3. A **Personal Access Token (PAT)** with Marketplace scope

**Important:** The marketplace publisher and the Azure DevOps PAT must use the **same Microsoft account**. These are two separate Microsoft services that share a login.

### Step 1: Create or verify the marketplace publisher

1. Go to the [Marketplace publisher management page](https://marketplace.visualstudio.com/manage/publishers/)
2. Sign in with your Microsoft account
3. If the `saropa` publisher is listed, you're done with this step
4. If you see a "Create Publisher" form, create it with:
   - **Name:** `Saropa`
   - **ID:** `saropa`

### Step 2: Create a Personal Access Token (PAT)

The PAT must be created under the **same Microsoft account** that owns the publisher above.

1. Open the [Azure DevOps portal](https://go.microsoft.com/fwlink/?LinkId=307137) and sign in
   - **Not** portal.azure.com (that's Azure cloud, a different service)
   - Verify the account shown in the top right matches the publisher owner
   - If prompted, create an Azure DevOps organization (accept the defaults)
2. Click the **User Settings** icon (gear near your profile picture, top right)
3. Select **Personal access tokens**
4. Click **+ New Token**
5. Configure:
   - **Name:** `vsce-saropa` (or any descriptive name)
   - **Organization:** All accessible organizations
   - **Expiration:** your preference (max 1 year)
   - **Scopes:** select **Custom defined**, click **Show all scopes**, scroll to **Marketplace**, check **Manage**
6. Click **Create** and copy the token immediately (it won't be shown again)

### Step 3: Register the PAT locally

```bash
npx @vscode/vsce login saropa
```

Paste the token when prompted. The PAT is stored in your system keychain.

### Verifying the PAT

```bash
npx @vscode/vsce verify-pat saropa
```

The `publish_to_vscode.py` script checks this automatically during the prerequisite step.

## Commit Messages

- Use present tense ("Add feature" not "Added feature")
- Keep first line under 72 characters
- Reference issues when applicable

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
