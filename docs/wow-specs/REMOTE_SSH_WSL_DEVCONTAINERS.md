# Wow Spec: Remote workspace / SSH, WSL, Dev Containers

**Status:** Proposed (Roadmap Task 90)  
**Source:** ROADMAP §1 Task 90 (Remote workspace / SSH), §3.1 #3 (Remote / SSH / Dev Containers)  
**Dependencies:** VS Code Remote extensions (Remote - SSH, WSL, Dev Containers); extension runs in workspace (remote) context  
**Related:** [VS Code Remote Development](https://code.visualstudio.com/docs/remote/remote-overview), [Extension guidelines for remote](https://code.visualstudio.com/api/advanced-topics/remote-extensions), [docs/integrations/wsl-linux-logs.md](../integrations/wsl-linux-logs.md)

---

## 1. Overview

### 1.1 Goal

Ensure **Saropa Log Capture** works correctly when the user develops in a **remote** context: **Remote - SSH**, **Remote - WSL**, or **Dev Containers**. Capture, session storage, session history, and the log viewer should all function in the remote environment so that developers debugging on SSH hosts, in WSL, or inside containers never lose debug output and can use the same workflow as on a local workspace.

### 1.2 Value Proposition

- **Enterprise and DevOps:** Teams that develop or debug on SSH hosts (e.g. staging servers, headless Linux) can capture and inspect debug console output without leaving VS Code.
- **WSL users:** Developers on Windows who open a folder in WSL get logs written and stored in WSL; no cross-boundary path or permission issues.
- **Dev Containers:** Reproducible environments in containers get the same capture and viewer experience as local workspaces.
- **Single codebase:** The extension uses VS Code’s workspace and file APIs in a remote-safe way so one code path works for local and remote.

### 1.3 Out of Scope (for this spec)

- **Hybrid local UI + remote capture:** We do not support “run extension on local machine, capture from remote debuggee” as a separate mode; when the user attaches to a remote workspace, the extension runs in that remote (see §3.1).
- **Cross-remote session sync:** Syncing or copying sessions between different remotes or from remote to local is not in scope (could be a future feature).
- **Remote-specific integrations:** WSL/Linux log sidecars (dmesg, journalctl) are covered by [wsl-linux-logs.md](../integrations/wsl-linux-logs.md); this spec focuses on core capture, storage, and viewer in remote workspaces.

---

## 2. User Stories

| # | As a… | I want to… | So that… |
|---|--------|-------------|-----------|
| 1 | Developer on SSH host | Open a folder via Remote - SSH and run/debug my app | Logs are captured and stored on the remote host and I can open them in the viewer. |
| 2 | Developer using WSL | Open a WSL folder and capture debug sessions | Log files and session history live in WSL and I don’t have path or permission issues. |
| 3 | Developer in Dev Container | Use the extension inside a Dev Container | Capture and viewer work the same as on my local machine. |
| 4 | Developer in any remote | See session history and open previous sessions | My remote workspace’s log directory and .saropa data are used consistently. |
| 5 | Developer in any remote | Export, search, and use integrations (e.g. bug report, Crashlytics) | All features that depend on workspace paths and files work in the remote context. |

---

## 3. Technical Design

### 3.1 How VS Code Remote Works (relevant parts)

- **Extension host location:** When the user opens a **remote** workspace (SSH, WSL, Dev Containers), VS Code runs the **extension host** in that remote environment. Extensions that need to access the workspace and run in that context should declare `"extensionKind": ["workspace"]` so they run on the **remote** (not on the UI host). Then:
  - `vscode.workspace.workspaceFolders[0].uri` is a **remote** URI (e.g. `vscode-remote://ssh-remote+myhost/home/user/project`).
  - `vscode.workspace.fs` (readFile, writeFile, etc.) operates on the **remote** filesystem.
  - Debug sessions and the Debug Adapter Protocol (DAP) run in the same remote context, so the existing DAP-based capture already receives output from the remote debuggee when the extension runs in the remote.
- **Implication for Saropa:** If the extension is **workspace**-kind, it will run in the remote when the user is in a remote window. Capture, log directory, session metadata, and viewer data (loaded via URIs) will all be on the remote. No special “remote mode” is required beyond correct use of URIs and `workspace.fs`, and declaring the right `extensionKind`.

### 3.2 Extension Manifest (package.json)

- **extensionKind:** Set `"extensionKind": ["workspace"]` so the extension runs in the remote when the user opens a remote workspace. This ensures:
  - Capture runs where the debug session runs.
  - Log directory and `.saropa` are on the remote filesystem.
  - All workspace-relative paths resolve on the remote.
- **Optional:** Support both UI and workspace with `["ui", "workspace"]` only if there is a clear use case for running on the UI host (e.g. a local-only feature). For “capture debug console in the workspace,” **workspace** is required. Default for extensions that use `workspace.getWorkspaceFolder` and workspace files is **workspace**.

### 3.3 Path and File Access Rules

To behave correctly in any workspace (local or remote), the codebase must avoid assuming a local filesystem:

| Do | Don’t (in workspace code paths) |
|----|-----------------------------------|
| Use `vscode.Uri.joinPath(workspaceFolder.uri, ...)` for paths under the workspace | Use `path.join(workspaceFolder.uri.fsPath, ...)` for workspace-relative paths (fsPath can differ by OS/scheme; path separators differ) |
| Use `vscode.workspace.fs.readFile` / `writeFile` / `createDirectory` with URIs | Use Node `fs.readFileSync` / `fs.writeFileSync` with paths derived from workspace (they resolve to the extension host’s filesystem, which is correct when extension runs in remote, but mixing path and Uri can cause bugs) |
| Use `vscode.Uri.file(...)` only for user-provided absolute paths (e.g. config) or when the path is known to be on the same machine as the extension host | Use `Uri.file()` with paths built from `workspaceFolder.uri.fsPath` + string concatenation (prefer `Uri.joinPath`) |
| Resolve “log directory” and “.saropa” via `getLogDirectoryUri(workspaceFolder)` / `getSaropaDirUri(workspaceFolder)` (already URI-based) | Assume `process.cwd()` or a fixed local path is the workspace root |

**Existing good patterns in codebase:** `config.ts` uses `vscode.Uri.joinPath(workspaceFolder.uri, config.logDirectory)` and similar; session lifecycle and metadata use workspace URIs. The spec recommends an **audit** to find any remaining `path.join(workspaceFolder.uri.fsPath, ...)` or Node `fs` usage for workspace files and replace with Uri + `workspace.fs`.

### 3.4 Configuration and “Current” Workspace

- **Multi-root:** If the workspace has multiple folders, the extension already uses `workspaceFolders?.[0]` in many places. In a remote window, all folders are remote, so no change. When no folder is present (e.g. single file open), fallbacks (e.g. `process.cwd()`) run in the extension host (remote when in remote). Document that “log directory” is relative to the first workspace folder when available.
- **Absolute log directory:** If the user sets `saropaLogCapture.logDirectory` to an **absolute** path, that path is resolved on the **extension host** (remote when in remote). Document that for remote workspaces, a **relative** log directory (e.g. `logs` or `.logs`) is recommended so logs stay under the workspace.

### 3.5 Save Dialogs and Default URIs

- **Export / Save As:** When showing a save dialog (e.g. export to file, export HTML, bug report markdown), use a **defaultUri** that is under the workspace (e.g. `vscode.workspace.workspaceFolders?.[0]?.uri` or the log directory URI) so the default location is on the remote when in a remote workspace. Avoid `vscode.Uri.file('exported-logs.txt')` without a workspace base, which can end up in an unclear or local path.

### 3.6 Child Processes and Shell Commands

- When the extension runs in the remote, `child_process.spawn` and similar run **on the remote**. So:
  - **WSL Linux logs:** When in Remote - WSL, running `dmesg` or `journalctl` (see wsl-linux-logs.md) runs inside WSL; no need for `wsl -e ...` from Windows.
  - **Remote - SSH:** Any future “tail” or shell-based integration runs on the SSH host.
  - **Dev Containers:** Same: commands run inside the container.
- No change to the existing logic for “extension on Windows, debuggee in WSL” (wsl-linux-logs): when the extension is in WSL (Remote - WSL), it runs Linux commands directly; when the extension is on Windows and the **target** is WSL, the integration doc already describes using `wsl -e ...`.

### 3.7 Viewer and Webview

- Webviews and custom editor views run in the remote context when the extension runs in the remote. Loading log content via `vscode.workspace.fs.readFile(logUri)` and passing data to the webview works as long as `logUri` is a workspace (remote) URI. No special handling needed for “remote viewer.”

### 3.8 Environment and Session Metadata

- The extension already records `vscode.env.remoteName` (e.g. `wsl`, `ssh-remote`, `dev-container`) in environment/session context (e.g. `environment-collector.ts`, `log-session-helpers.ts`). This can be surfaced in the session header or About so the user sees “Remote: ssh-remote” or “Remote: wsl” when relevant. Optional: show a small “remote” badge in the UI when `remoteName` is set.

---

## 4. Implementation Phases

### Phase 1 — Declare and harden for remote

- **Manifest:** Add `"extensionKind": ["workspace"]` to `package.json` so the extension runs in the remote when the user opens a remote workspace.
- **Audit:** Search for `workspaceFolder.uri.fsPath` used with `path.join` or Node `fs` for workspace files; replace with `Uri.joinPath` and `vscode.workspace.fs` where appropriate. Prefer URI-based helpers (e.g. `getLogDirectoryUri`, `getSaropaDirUri`) everywhere.
- **Save dialogs:** Ensure export/save flows use a workspace-based defaultUri (e.g. first workspace folder or log directory) instead of a bare filename.
- **Docs:** Add a short “Remote development” section to README: supported scenarios (SSH, WSL, Dev Containers), recommendation to use relative log directory in remote workspaces, and that the extension runs in the remote so logs are stored on the remote host/container.
- **Manual test:** Run capture and viewer in Remote - SSH and Remote - WSL; confirm sessions are stored and openable, and that export/session history work.

### Phase 2 — Dev Containers and UX hints

- **Dev Containers:** Verify behavior in a Dev Container (same code paths as SSH/WSL; mainly verification and any container-specific edge cases, e.g. read-only workspace).
- **UI hint:** Optionally show “Remote: &lt;remoteName&gt;” in the session header or status (already available in context); document in README.
- **README:** Explicitly list “Remote - SSH”, “WSL”, “Dev Containers” as supported and link to VS Code remote docs.

### Phase 3 — Edge cases and polish

- **No workspace folder:** When no workspace folder is open, document that log directory falls back to `process.cwd()` (extension host’s cwd); in remote, that’s the remote cwd.
- **Absolute log path:** Document that an absolute `logDirectory` is resolved on the extension host (remote when in remote); recommend relative path for portability.
- **Testing:** Add or extend tests that use remote-like URIs (e.g. `vscode.Uri.parse('vscode-remote://ssh-remote+host/path')`) where relevant to avoid regressions. Manual testing on at least one of SSH / WSL / Dev Containers remains required for each release that touches remote behavior.

---

## 5. Dependencies and Constraints

- **VS Code:** Remote development requires the user to have the appropriate VS Code extension (Remote - SSH, WSL, or Dev Containers). The extension does not implement SSH or containers itself.
- **Extension host:** The extension must run in the workspace (remote) to capture and store logs there; `extensionKind: ["workspace"]` is required.
- **No native modules:** The codebase is TypeScript/JavaScript; no native Node modules that would need to be compiled for the remote OS. If any are added later, they must be built for the remote platform (e.g. when developing in a Linux container, native deps must be Linux-compatible).
- **Testing:** Automated tests can mock `workspace.workspaceFolders` with remote URIs; full E2E in a real remote environment is manual or CI with a remote runner.

---

## 6. Success Criteria

- With `extensionKind: ["workspace"]`, opening a folder via Remote - SSH, WSL, or Dev Containers causes the extension to run in the remote; capture, session list, and viewer work without errors.
- Log files and `.saropa` data are created under the remote workspace (or configured remote path); no reliance on local-only paths in those code paths.
- Export, session history, and integrations (e.g. bug report, Crashlytics, WSL Linux logs when in WSL) work in the remote context.
- README documents remote support and recommends a relative log directory for remote workspaces.
- No regressions in local (non-remote) usage.

---

## 7. References

- [VS Code Remote Development](https://code.visualstudio.com/docs/remote/remote-overview)
- [Extension guidelines for remote extensions](https://code.visualstudio.com/api/advanced-topics/remote-extensions)
- [extensionKind](https://code.visualstudio.com/api/references/extension-manifest#extension-kind)
- [WorkspaceFolder.uri](https://code.visualstudio.com/api/references/vscode-api#WorkspaceFolder) (scheme can be `vscode-remote`)
- Existing: `src/modules/config/config.ts` (getLogDirectoryUri, getSaropaDirUri), `src/modules/misc/environment-collector.ts` (remoteName), `docs/integrations/wsl-linux-logs.md`
- ROADMAP §1 Task 90, §3.1 #3
