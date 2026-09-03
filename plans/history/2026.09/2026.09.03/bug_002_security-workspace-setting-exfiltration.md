# Bug 002 — Security: workspace-setting-driven exfiltration and command injection

## Status: Fixed

## Severity: Critical

Untrusted workspace settings can exfiltrate a user's GitLab token or execute arbitrary shell commands.

## Problem

Two independent security issues in workspace-setting-driven integrations:

1. `gitlabBaseUrl` is read from workspace settings and used verbatim as the target for API requests. The `PRIVATE-TOKEN` header is attached and sent on every session start, with no workspace trust gate. A malicious repo can commit a `.vscode/settings.json` that points `gitlabBaseUrl` at an attacker-controlled server and harvest the user's GitLab personal access token on next session start. (`src/ui/integrations/providers/build-ci-api.ts:126-131`)
2. Shell-string injection: `execSync(`${runtime} ${args}`)` interpolates an unquoted WSL distro name and unescaped PowerShell log paths directly into a shell command string. A workspace setting such as `wslDistro: "; rm -rf /"` (or a crafted log path containing `;`/`&&`/backticks) executes arbitrary commands on the user's machine. (`src/ui/integrations/providers/docker-containers.ts:16`, `linux-logs.ts:51`, `windows-event-log.ts:25-28`)

## Reproduction

1. Create a workspace with `.vscode/settings.json` setting `saropaLogCapture.gitlabBaseUrl` to an attacker-controlled host.
2. Open the workspace and start a debug/log session; observe the `PRIVATE-TOKEN` header sent to the attacker host.
3. Separately, set `saropaLogCapture.wslDistro` (or an equivalent path setting) to a value containing a shell metacharacter (e.g. `; calc`).
4. Trigger the code path that shells out (Docker containers / Linux logs / Windows Event Log provider) and observe the injected command executes.

**Frequency:** Always

## Root Cause

Integration providers trust workspace settings as safe input without sanitization or a workspace-trust check. `execSync` is called with a single interpolated string, so any unescaped value in that string is interpreted by the shell rather than treated as a literal argument.

## Proposed Fix

- Add a `vscode.workspace.isTrusted` gate before using workspace-scoped settings in shell commands and HTTP requests; fall back to safe defaults or prompt the user in untrusted workspaces.
- Quote/escape all interpolated values, or better, replace `execSync` string concatenation with `execFile`/`spawn` using an argument array so no shell parsing occurs.
- Validate `gitlabBaseUrl` against an allowlist or require explicit user confirmation the first time a non-default host is used.

## Changes Made

- `src/modules/integrations/providers/build-ci-api.ts`: added `resolveTrustedGitLabBaseUrl()`, which gates a non-default `gitlabBaseUrl` on `vscode.workspace.isTrusted`, falling back to the hardcoded `GITLAB_DEFAULT_BASE_URL` in untrusted workspaces so the `PRIVATE-TOKEN` header can never be sent to an attacker-controlled host committed via `.vscode/settings.json`.
- `src/modules/integrations/providers/docker-containers.ts`: replaced `execSync` string concatenation with `execFileSync(runtime, args, …)`, passing `runtime`/`containerId`/`containerNamePattern`-derived values as a literal argv array so shell metacharacters are inert.
- `src/modules/integrations/providers/linux-logs.ts`: replaced `exec`/joined-string invocation with `execFile` (promisified); `wslDistro` is passed as a discrete `-d <distro>` argv entry, never interpolated into a shell-string template.
- `src/modules/integrations/providers/windows-event-log.ts`: replaced `execSync` string concatenation with `execFileSync('powershell', [...])`, and added `escapePowerShellSingleQuoted()` to double any embedded `'` in workspace-scoped event-log names before they are embedded in the PowerShell `@('...')` literal.

## Tests Added

- `src/test/modules/integrations/bug-002-injection-regression.test.ts` — static regression guard (a live `child_process` monkey-patch was attempted but `child_process`'s exports are non-configurable in this runtime and cannot be swapped). Verifies:
  - `docker-containers.ts` uses `execFileSync` and never `execSync` with a template-string command, and no longer imports `execSync`.
  - `linux-logs.ts` uses `execFile` and never joins argv into a single command string or interpolates `wslDistro` into a `wsl ${...}` template.
  - `windows-event-log.ts` uses `execFileSync` and never launches `powershell` via a concatenated command string; every log name is routed through `escapePowerShellSingleQuoted()` before being quoted into the script.
  - `build-ci-api.ts` gates `gitlabBaseUrl` on `vscode.workspace.isTrusted`, defines a hardcoded default host to fall back to, and defines the trust-gate function textually before the `PRIVATE-TOKEN` header is attached (so a future reorder can't silently bypass the gate).
  - Verified passing via a Mocha-global shim over the compiled `out/test/...` output (all 5 assertions pass).

## Commits
<!-- Add commit hashes as fixes land. -->
