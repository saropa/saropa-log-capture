# Integration: Build and CI

## Problem and Goal

Debug sessions are often run **after** a build (local or CI). When something fails in the debuggee, knowing whether "the last build was green," which pipeline run produced the current binary, or whether the failure might be due to a **flaky build** or **wrong artifact** is critical. Today that context lives in a separate tab (GitHub Actions, Azure DevOps, Jenkins). This integration links **build and CI metadata** to the log session so that the context header (or a side panel) shows last build result, build ID, and a direct link to the pipeline run—making "did the build pass?" and "which build is this?" visible at a glance.

**Goal:** Optionally attach **last build / CI run** information to each session: build status (success/failure/cancelled), build ID or run number, commit SHA (if applicable), and a **deep link** to the run in the user’s CI system (GitHub Actions, Azure Pipelines, GitLab CI, Jenkins, or generic). Data can come from local build output, CI API, or a small script the user runs before debugging.

---

## Data Sources

| Source | How to get build info | Typical data |
|--------|------------------------|--------------|
| **GitHub Actions** | API `GET /repos/:owner/:repo/actions/runs` (filter by branch/commit) or `gh run list` | status, run ID, url, conclusion |
| **Azure Pipelines** | REST API with PAT; or `az pipelines build list` | buildId, result, link |
| **GitLab CI** | API `GET /projects/:id/pipelines` (branch/commit) | pipeline id, status, web_url |
| **Jenkins** | REST API or local job metadata file | build number, result, url |
| **Local build** | User runs script that writes `.last-build.json` to workspace or reports/ | status, timestamp, optional link |
| **Generic** | User-provided URL or JSON path (e.g. env var `CI_BUILD_URL`) | link, status |

Prefer **commit-based** correlation: at session start we have git commit (from environment-collector). Query CI API for "latest run for this commit" or "latest run for this branch" and attach that to the session.

---

## Integration Approach

### 1. When to collect

- **Session start:** After gathering `DevEnvironment` (we have branch, commit), optionally call a **build-info provider** that returns `{ status, buildId, url, conclusion?, timestamp? }`. If provider is async (API), do not block session start—fetch in background and when result arrives, either (a) append to context header (if we support appending—current design may not), or (b) write to `.meta.json` and show in viewer when log is opened.
- **Session start (alternative):** Read a **stale file** written by the user or by a pre-launch task: e.g. `reports/.last-build.json` or `.saropa/last-build.json`. Content: `{ status, buildId, url, commit?, timestamp }`. No API call; zero latency. User or their build script is responsible for updating the file.
- **Recommended:** Support **both**: (1) optional **file** (user/script writes before debug), and (2) optional **API** (GitHub/Azure/GitLab) with token for "latest run for this commit." File takes precedence if present and recent (e.g. within last hour).

### 2. Where to store and display

- **Context header:** If build info is available at session start (synchronous file read), add lines: `Last build:    success (Build #123)` and `Build link:    https://...`. If from API (async), we cannot append to already-written header; then store in `.meta.json` only.
- **`.meta.json`:** Add `lastBuild: { status, buildId, url, conclusion?, timestamp }`. Viewer and bug report can read from here.
- **Viewer:** When opening a log, if `.meta.json` contains `lastBuild`, show a line or badge in the header section: "Build: success · #123" with link. Or a small "CI" tab that shows build details and link.
- **Bug report:** Include "Last build" and build link in the bug report template when available.

### 3. Providers (pluggable)

- **File provider:** Read from `saropaLogCapture.buildCi.buildInfoPath` (default `.saropa/last-build.json` or `reports/.last-build.json`). JSON schema: `{ status: "success"|"failure"|"cancelled", buildId?: string, url?: string, commit?: string, timestamp?: string }`.
- **GitHub Actions:** Use `GITHUB_TOKEN` or `saropaLogCapture.buildCi.githubToken` (secret); `GET /repos/:owner/:repo/actions/runs?branch=:branch&per_page=1` or `...?commit_sha=:sha`. Map to status and run URL.
- **Azure Pipelines:** PAT in setting; call Azure DevOps REST for latest build for branch/commit. Map to status and build URL.
- **GitLab:** Token; pipelines for project and branch/commit. Map to status and pipeline URL.
- **Jenkins:** Base URL + token or no auth; job name from config; get last build for branch. Map to status and build URL.

---

## User Experience

### Settings (under `saropaLogCapture.buildCi.*`)

| Setting | Type | Default | Description |
|--------|------|--------|-------------|
| `enabled` | boolean | `false` | Enable build/CI context |
| `source` | `"file"` \| `"github"` \| `"azure"` \| `"gitlab"` \| `"jenkins"` | `"file"` | Where to get build info |
| `buildInfoPath` | string | `".saropa/last-build.json"` | Path (relative to workspace) for file source |
| `fileMaxAgeMinutes` | number | `60` | If file older than this, ignore (and optionally try API) |
| `githubToken` | string (secret) | — | GitHub token for Actions API (stored in secretStorage) |
| `azurePat` | string (secret) | — | Azure DevOps PAT |
| `azureOrg` | string | `""` | Azure org/project (e.g. `org/project`) |
| `gitlabToken` | string (secret) | — | GitLab token |
| `gitlabProjectId` | string | `""` | GitLab project ID or path |
| `jenkinsUrl` | string | `""` | Jenkins base URL |
| `jenkinsJob` | string | `""` | Job name (e.g. `myapp/main`) |
| `includeInHeader` | boolean | `true` | When available at start, add build line to context header |

### Commands

- **"Saropa Log Capture: Refresh build info"** — Re-read file or re-call API and update `.meta.json` for the current session (if active) or prompt to select a session folder.
- **"Saropa Log Capture: Open last build"** — Open the build URL from current session’s meta (or from workspace last-build file) in browser.

### UI

- **Header (when sync available):** `Last build: success (Run #456)` and `Build link: https://...`
- **Viewer:** In header block or "CI" section: same info with clickable link. If build failed, optional warning style.
- **Status bar:** Optional: "Build: ✓" or "Build: ✗" when build info is present.

---

## Implementation Outline

### Components

1. **Build info providers**
   - **File provider:** `getBuildInfoFromFile(workspaceRoot, path, maxAgeMs)`: read JSON, check mtime, return or undefined.
   - **GitHub provider:** `getBuildInfoFromGitHub(owner, repo, commitOrBranch, token)`: GET runs, map first run to status + url. Repo from git remote (parse GitHub URL).
   - **Azure provider:** Similar; use Azure REST. Org/project from config or from `azure-pipelines.yml` path?
   - **GitLab/Jenkins:** Same pattern; one function per provider.
   - All return `BuildInfo | undefined`; never throw (log and return undefined).

2. **Orchestrator**
   - At session start (in session-lifecycle or session-manager), if `buildCi.enabled`: first try file (if source is file or "auto"); if file missing or stale and source is API, call API. Pass result to `SessionContext` or write to a store keyed by session id; when LogSession is created, if build info already available, include in header (need to extend `SessionContext` or pass optional `buildInfo` to `generateContextHeader`). If async, write to `.meta.json` after session folder is known.
   - **Session folder:** We know it after first write (date + base filename). So: async build info can be written to `reports/<date>/<basename>.meta.json` (if we have such a file) or to a separate `reports/<date>/<basename>.build.json`. Viewer then reads both.

3. **Header extension**
   - Extend `SessionContext` with `buildInfo?: BuildInfo`. In `generateContextHeader`, if present, append `Last build:` and `Build link:` lines. If not present at header write time, no lines (async will go to meta only).

4. **Viewer**
   - When loading a log, check for `.meta.json` or `.build.json` in same folder with same base name. If `lastBuild` exists, show in header block or CI panel with link.

5. **Bug report**
   - In bug report collector, read session meta; add section "Last build" with status and link when available.

### Security and tokens

- Store GitHub/Azure/GitLab tokens in `context.secrets` (VS Code secretStorage). Never log tokens.
- Document: "Create a token with minimal scope (e.g. Actions read-only, Pipelines read)."

---

## Configuration Summary

- **Extension settings:** `saropaLogCapture.buildCi.*` as above.
- **File format:** Documented JSON for `.last-build.json` so users or scripts can write it (e.g. in a "preLaunchTask" that runs a script after build).

---

## Risks and Alternatives

| Risk | Mitigation |
|------|------------|
| API rate limits | Cache result; one call per session start; use commit SHA to get single run |
| Wrong repo/org | Derive from git remote; allow override in settings |
| No token | File-only; or disable build integration |
| Many CI systems | Ship GitHub + file first; Azure/GitLab/Jenkins as follow-up |

**Alternatives:**

- **Pre-launch task only:** Rely entirely on user’s launch.json preLaunchTask to write `.last-build.json`; no API. Simplest.
- **CI webhook:** CI posts to extension (e.g. via VS Code API or local server). More complex; not v1.

---

## References

- GitHub Actions API: [List workflow runs](https://docs.github.com/en/rest/actions/workflow-runs)
- Azure Pipelines API: [Builds - List](https://docs.microsoft.com/en-us/rest/api/azure/devops/build/builds/list)
- Existing: `environment-collector.ts` (commit, branch), `log-session-helpers.ts` (header).
