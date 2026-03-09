# Plan: Build/CI API Sources

**Adapter:** `buildCi`
**Provider:** `src/modules/integrations/providers/build-ci.ts`

## What exists

File-based source only: reads `buildInfoPath` JSON at session start (sync), returns header + meta with status/buildId/url/commit.

## What's missing

API-based sources for GitHub Actions, Azure DevOps, and GitLab CI. The spec describes these as async (fetched via `onSessionStartAsync` or `onSessionEnd`) so they don't block session start.

## Sub-features

### 1. Config additions

Add to `IntegrationBuildCiConfig`:
- `source`: `'file' | 'github' | 'azure' | 'gitlab'` (default `'file'`)

Add to `package.json` settings:
- `saropaLogCapture.integrations.buildCi.source` — enum, default `"file"`

Token storage: use VS Code `SecretStorage` API, not plain settings. Provide commands to set/clear each token:
- `saropaLogCapture.setBuildCiGithubToken`
- `saropaLogCapture.setBuildCiAzurePat`
- `saropaLogCapture.setBuildCiGitlabToken`

### 2. GitHub Actions

- `onSessionStartAsync`: use `fetch` or `https` to call `GET /repos/{owner}/{repo}/actions/runs?branch={branch}&per_page=1`
- Auth: `Authorization: Bearer <token>` from SecretStorage
- Parse: `workflow_runs[0]` → status, conclusion, id, html_url, head_sha
- Map to `BuildInfo` and return header + meta contributions
- Timeout: 10s, fail silently (log to output channel)

### 3. Azure DevOps

- Endpoint: `GET https://dev.azure.com/{org}/{project}/_apis/build/builds?$top=1&branchName=refs/heads/{branch}&api-version=7.0`
- Auth: Basic with PAT
- Parse: `value[0]` → status, result, buildNumber, _links.web.href, sourceVersion

### 4. GitLab CI

- Endpoint: `GET https://gitlab.com/api/v4/projects/{id}/pipelines?ref={branch}&per_page=1`
- Auth: `PRIVATE-TOKEN: <token>`
- Parse: `[0]` → status, id, web_url, sha

### 5. Provider changes

- Keep `onSessionStartSync` for file source (unchanged)
- Add `onSessionStartAsync` that checks `source` config and dispatches to the right API fetcher
- Return `Contribution[]` with header line(s) + meta, same shape as file source

### 6. Files to modify

| File | Change |
|------|--------|
| `src/modules/config/config-types.ts` | Add `source` to `IntegrationBuildCiConfig` |
| `src/modules/config/integration-config.ts` | Read `source` setting |
| `package.json` | Add `source` enum setting, register set/clear token commands |
| `src/modules/integrations/providers/build-ci.ts` | Add `onSessionStartAsync` with API fetchers |

### 7. Considerations

- Secret storage requires activation event — tokens stored via command palette
- Each API source should be a separate helper function for testability
- No new dependencies — use Node `https` module (already available in VS Code extension host)
- Respect user's proxy settings via `vscode.workspace.getConfiguration('http')`
