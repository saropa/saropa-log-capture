# Integration: Package and Lockfile

## Problem and Goal

"Works on my machine" often comes down to **dependency versions**: a different lockfile or a different resolution can change behavior. The context header already records **Node version** (from the extension host). It does not record **package manager**, **lockfile state**, or **key dependency versions** for the project being debugged. This integration adds **lockfile and package context** to the session so that "exactly what was installed" is reproducible from the log—either in the header (hash + package count) or in a sidecar for full diff later.

**Goal:** At session start, optionally read **lockfile** (e.g. `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`, `Cargo.lock`, `go.sum`) and **package manifest** (e.g. `package.json`) and attach a **reproducibility fingerprint**: lockfile hash (or content hash), package manager and version, and optionally a short list of "direct dependency versions" (e.g. from package.json resolutions or lockfile). Store in header and/or sidecar so that anyone with the log can match the exact dependency tree (or re-run with same stack).

---

## Data Sources

| Source | File(s) | Data to capture |
|--------|---------|------------------|
| **npm** | package-lock.json, package.json | lockfileVersion, content hash; root dependencies from package.json |
| **Yarn** | yarn.lock, package.json | Yarn version (if in lockfile); content hash; root dependencies |
| **pnpm** | pnpm-lock.yaml, package.json | lockfileVersion; content hash; root dependencies |
| **Cargo (Rust)** | Cargo.lock, Cargo.toml | Package count or hash of Cargo.lock |
| **Go** | go.sum, go.mod | go.sum hash or go.mod version line |
| **Pip** | requirements.txt, Pipfile.lock | Hash of lock file if present |
| **Poetry** | poetry.lock | Hash or version |

**Recommended v1:** **Node ecosystem** (npm, Yarn, pnpm): detect which lockfile exists; compute hash (e.g. SHA-256 of file content or of normalized structure); read package.json for project name and optional "engines". Add **Cargo** and **Go** as optional (hash of lock/sum). Don’t parse full tree; just "fingerprint" for comparison.

---

## Integration Approach

### 1. When to collect

- **Session start:** Before or right after writing context header, if `saropaLogCapture.packages.enabled`, run **package context collector**: find workspace root (first folder); look for package-lock.json, yarn.lock, pnpm-lock.yaml, Cargo.lock, go.sum (in that order or by priority). For first found (or all?), compute hash and read minimal metadata. Append to SessionContext (e.g. `packageContext?: PackageContext`) and write in header and/or to `.meta.json`.
- **Sync:** Hashing is fast; can be synchronous so header includes "Lockfile: npm, sha256:abc...". If we want to support multiple ecosystems in one workspace, collect all found and list in header (one line per tool).

### 2. What to store

- **Header:** `Lockfile:    npm (package-lock.json) sha256:abc123...` and optional `Packages:    12 direct, 234 total` (if we can quickly parse count from lockfile). Or just hash.
- **.meta.json:** `packageContext: { packageManager, lockfilePath, contentHash, directDeps?: string[] }` for viewer and bug report.
- **Sidecar (optional):** `basename.packages.json` with full list of direct deps and versions (from package.json and lockfile resolution). Heavier; make it optional (e.g. `includeDependencyList: true`).

### 3. Viewer and bug report

- **Viewer:** In header block, show lockfile line; optional "Copy hash" for issue templates. "Reproduce: use same lockfile (hash abc...)."
- **Bug report:** Include "Lockfile hash" and "Package manager" so reporters can verify environment.

---

## User Experience

### Settings (under `saropaLogCapture.packages.*`)

| Setting | Type | Default | Description |
|--------|------|--------|-------------|
| `enabled` | boolean | `true` | Include package/lockfile context (low cost) |
| `lockfilePriority` | string[] | `["package-lock.json", "yarn.lock", "pnpm-lock.yaml"]` | Which lockfiles to look for first (first found wins for Node) |
| `includeHash` | boolean | `true` | Include content hash in header |
| `includeCounts` | boolean | `false` | Include direct/total package counts (may require parsing) |
| `includeDependencyList` | boolean | `false` | Write full direct dependency list to sidecar (for bug report) |
| `ecosystems` | string[] | `["node", "cargo", "go"]` | Which ecosystems to detect (node, cargo, go) |

### Commands

- **"Saropa Log Capture: Copy lockfile hash"** — Copy the current session’s lockfile hash (from meta or header) to clipboard for pasting in issues.

### UI

- **Header:** One or two lines: Lockfile and optional Packages count.
- **Bug report:** Section "Environment" already exists; add "Lockfile: npm, sha256:..." and optional "Direct dependencies: ...".

---

## Implementation Outline

### Components

1. **Discovery**
   - From workspace root (first folder), list files: package-lock.json, yarn.lock, pnpm-lock.yaml, Cargo.lock, go.sum, go.mod. Determine ecosystem(s) present. For Node, pick one lockfile by lockfilePriority (first that exists).

2. **Hash**
   - Read file with `vscode.workspace.fs.readFile`. Compute SHA-256 (Node crypto.createHash('sha256').update(content).digest('hex')). Normalize: for JSON lockfiles, optionally sort keys to avoid hash churn from key order; or hash raw content for simplicity (document "same content = same hash").

3. **Counts (optional)**
   - For package-lock.json: parse JSON and count `packages` keys (npm v2+ lockfile) or traverse node_modules in lockfile. For yarn.lock: count top-level entries. Cap time (e.g. 100 ms) so we don’t block; on timeout, skip counts.

4. **SessionContext and header**
   - Extend SessionContext with `packageContext?: { packageManager, lockfilePath, contentHash, directCount?, totalCount? }`. In `generateContextHeader`, append lines. If multiple ecosystems, append one line per (e.g. "Node: npm, sha256:...; Cargo: sha256:...").

5. **.meta.json**
   - Write packageContext to session meta when session is created (or at end if meta is written at end). Viewer reads and displays.

6. **Bug report**
   - In bug report collector, read packageContext from current log’s meta or from header parsing; add to "Environment" or new "Reproducibility" section.

### Multi-root

- Use first workspace folder for "workspace root" (or folder containing launch config if detectable). Document.

---

## Configuration Summary

- **Extension settings:** `saropaLogCapture.packages.*` as above.
- **Ecosystems:** node (npm/yarn/pnpm), cargo, go. Pip/Poetry can be added later with same pattern.

---

## Risks and Alternatives

| Risk | Mitigation |
|------|------------|
| Large lockfile | Only hash and optional counts; don’t load full tree |
| Multiple lockfiles | Priority order; or list all with hashes (one line each) |
| Hash instability | Prefer raw content hash; document that reformatting changes hash |
| No lockfile | Skip; no line in header |

**Alternatives:**

- **Full lockfile in sidecar:** Copy entire lockfile into session folder. Ensures reproducibility but duplicates large file; make optional.
- **Only package.json:** Lighter: just package.json name and version; no lockfile. Less reproducible.

---

## References

- Existing: environment-collector.ts (Node version), log-session-helpers (header), bug report sections.
