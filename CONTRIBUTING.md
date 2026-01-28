# Contributing to Saropa Log Capture

Thank you for your interest in contributing! This document provides guidelines for contributors.

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
5. Test manually in Extension Development Host (F5)
6. Commit with descriptive message
7. Open a Pull Request

## Commit Messages

- Use present tense ("Add feature" not "Added feature")
- Keep first line under 72 characters
- Reference issues when applicable

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
