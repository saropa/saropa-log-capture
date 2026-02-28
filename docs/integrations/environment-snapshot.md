# Integration: Environment and Config Snapshot

## Problem and Goal

Reproducing a failure often depends on **environment variables**, **config file contents**, or **feature flags** that aren’t visible in the debug output. The extension already redacts and optionally includes **env** from the launch config in the context header. This integration **extends environment and config capture** so that a more complete (but still safe) snapshot is available: checksums of config files, non-sensitive env var names (with values redacted), and optional key-value pairs from config files (e.g. `app.env` or `.env.example`), making "what was the environment?" answerable from the log alone.

**Goal:** (1) **Env snapshot:** At session start, record **names** of all env vars (from process.env or launch config) and **redacted values** (per existing redact patterns); optionally include a **checksum** of "env block" for comparison. (2) **Config file snapshot:** Optionally list **config files** (e.g. `.env`, `config.json`, `appsettings.Development.json`) with **checksums** or **first N non-secret lines** so that changes can be detected without storing secrets. (3) **Display:** Header lines or sidecar; viewer "Environment" section; optional "Diff config" (compare current file checksum to stored).

---

## Data Sources

| Source | Data | How to get it |
|--------|------|---------------|
| **Launch config** | env, cwd, args | Already in SessionContext; extend redaction and optional "env names only" |
| **Process env** | process.env (extension host or debuggee) | Extension host: Node; debuggee: only if DAP exposes (rare). Prefer launch config env. |
| **Config files** | .env, config.*.json, appsettings.*.json | Read from workspace; compute hash; optional safe key list (keys only, or redacted values) |
| **Feature flags** | User-defined path to flags file | Read and hash or list keys |

**Recommended v1:** (1) **Env:** Already in header; add optional "Env checksum: sha256:..." (hash of sorted KEY=redacted pairs) for quick "same env?" check. (2) **Config files:** Setting `configFiles: [".env", "config.json"]`; at session start read each file (if exists), compute content hash; store in header or meta as "config.env: sha256:..., config.json: sha256:...". Do not store contents. Optional: list **keys** from .env (no values) for "which vars were set."

---

## Integration Approach

### 1. When to collect

- **Session start:** Read launch config env (already have); compute env block checksum. For each path in `configFiles`, read file, hash, store. All sync and fast.

### 2. What to store

- **Header:** `Env checksum: sha256:abc...` (optional). `Config: .env sha256:..., config.json sha256:...`.
- **.meta.json:** `environmentChecksum`, `configChecksums: { [path]: hash }`.
- **Viewer:** "Environment" expandable: checksums and "Config files" list. Optional "Compare" (diff current file hash to stored).

### 3. Privacy

- Never store raw .env or secret config values. Only hashes and optional key names. Redaction follows existing `redactEnvVars` patterns for any displayed env.

---

## User Experience

### Settings (under `saropaLogCapture.environment.*`)

| Setting | Type | Default | Description |
|--------|------|--------|-------------|
| `includeEnvChecksum` | boolean | `false` | Add env block checksum to header |
| `configFiles` | string[] | `[]` | Paths (relative to workspace) to include checksums for |
| `includeInHeader` | boolean | `true` | Add config checksum line(s) to header |

### Commands

- **"Saropa Log Capture: Compare config with session"** — For a stored session, compare current workspace config file hashes to stored; show "changed" / "unchanged."

---

## Implementation Outline

- **Env checksum:** Serialize launch config env (redacted) to sorted string; hash. **Config hashes:** For each path, `workspace.fs.readFile`; hash content. Store in SessionContext and generateContextHeader. Viewer reads meta and displays.

---

## Risks and Alternatives

- **Large config:** Only hash; don’t store. **Secrets:** Never store values; only hashes and key names.
- **Alternatives:** Full config backup in sidecar (risky); or only env names (no checksum).

---

## References

- Existing: config redaction in log-session-helpers, environment-collector.
