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

The `dev.py` script checks this automatically during the prerequisite step.

## Commit Messages

- Use present tense ("Add feature" not "Added feature")
- Keep first line under 72 characters
- Reference issues when applicable

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
