# Bug 002 — Security: workspace-setting-driven exfiltration and command injection

## Status: Open

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
<!-- Fill in when a fix is written. -->

## Tests Added
<!-- List new or updated test files and what they verify. -->

## Commits
<!-- Add commit hashes as fixes land. -->
