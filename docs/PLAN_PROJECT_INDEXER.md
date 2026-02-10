# Project Indexer — Extended Source Scanning & Indexing

## Problem

Today the extension indexes only the `reports/` log directory (`search-index.ts`). The docs scanner (`docs-scanner.ts`) re-reads `docs/` and `bugs/` from disk on every analysis request with no caching. There is no unified, persistent index of project knowledge files that could accelerate token lookups, cross-reference searches, and future features like project-wide "find in docs".

## Goal

Build a **lightweight, delta-aware project indexer** that:

1. Scans configurable project directories (default: `docs/`, `bugs/`) and file types (default: `.md`, `.txt`)
2. Produces timestamped index files stored unobtrusively in the workspace
3. Supports incremental (delta) updates — only re-indexes changed files
4. Is fully configurable and can be enabled/disabled by the user
5. Integrates with existing consumers: `docs-scanner.ts`, analysis panel, and the viewer search

---

## Current State

| Component | Scope | Cache | Delta Support |
|-----------|-------|-------|---------------|
| `search-index.ts` | `reports/` only | `.search-index.json` in log dir | mtime + size comparison |
| `docs-scanner.ts` | `docsScanDirs` + root `*.md` | None — full rescan every time | None |
| `line-analyzer.ts` | Single log line | None | N/A |
| `correlation-scanner.ts` | Single log file | None | N/A |

### Existing Settings

| Setting | Default | Purpose |
|---------|---------|---------|
| `docsScanDirs` | `["bugs", "docs"]` | Dirs for docs-scanner token matching |
| `fileTypes` | `[".log", ".txt", ".md", ...]` | File types for reports/ listing |
| `includeSubfolders` | `true` | Recurse into subdirs |

---

## Design

### Architecture Overview

```
Workspace
├── docs/           ← scanned (content tokenization)
├── doc/            ← scanned (content tokenization)
├── bugs/           ← scanned (content tokenization)
├── .github/        ← scanned (templates, config)
├── adr/            ← scanned (architecture decisions)
├── rfcs/           ← scanned (proposals)
├── design/         ← scanned (specs)
├── wiki/           ← scanned (knowledge base)
├── guides/         ← scanned (how-to docs)
├── reports/        ← scanned (sidecar metadata only)
│   ├── *.log + *.meta.json   ← session files (unchanged)
│   └── (no more .crashlytics/ subfolder — moved to .saropa/)
├── README.md       ← scanned (root files)
└── .saropa/
    ├── index/
    │   ├── manifest.json        ← master manifest
    │   ├── docs.idx.json        ← per-source index
    │   ├── bugs.idx.json        ← per-source index
    │   ├── reports.idx.json     ← completed session index
    │   └── root-files.idx.json  ← root-level loose files
    └── cache/
        └── crashlytics/
            └── {issueId}.json   ← crash event detail (moved from reports/.crashlytics/)
```

#### `.saropa/` as the single tooling root

All extension-generated artifacts (indexes, caches) live under `.saropa/`. User-facing output (`reports/`) stays clean — only log files and their `.meta.json` sidecars.

| Subfolder | Contents | Owner |
|-----------|----------|-------|
| `.saropa/index/` | Project index files | `project-indexer.ts` |
| `.saropa/cache/crashlytics/` | Crash event detail JSON (immutable) | `firebase-crashlytics.ts` |

**Migration:** On first run after upgrade, if `reports/.crashlytics/` exists, move its contents to `.saropa/cache/crashlytics/` and delete the old directory. Cache files have no TTL (crash events are immutable records) so they're valuable to preserve.

#### How `reports/` is indexed (special handling)

Log files are fundamentally different from knowledge files — machine-generated, high-volume, noisy. But completed sessions are static and contain valuable historical data. The indexer handles `reports/` with a distinct strategy:

**What's different from docs/bugs:**

| Concern | docs/bugs strategy | reports strategy |
|---------|-------------------|-----------------|
| Token source | File content (whitespace/markdown parsing) | `.meta.json` sidecar (`correlationTags`, `fingerprints`) |
| File reading | Read full file content | Read only the small sidecar JSON, never the log file |
| Active files | N/A | Skip active sessions (`sessionManager.activeSessionCount`) |
| Trashed files | N/A | Skip sessions where `meta.trashed === true` |
| Token types | General keywords, headings | Semantic only: `file:app.dart`, `error:NullPointerException` |

**Why sidecar-first:**
- The `.meta.json` sidecars already store `correlationTags` (source files, error classes) and `fingerprints` (error signatures) — extracted by `correlation-scanner.ts` during session finalization
- Reading a 2 KB sidecar is orders of magnitude cheaper than parsing a 50K-line log file
- Tokens are already semantic and deduplicated — no stop-word filtering or noise reduction needed
- If a sidecar has no `correlationTags` yet (legacy session), the indexer can optionally queue a background extraction

**Session eligibility:**
- Completed (not actively recording) — checked by absence from `sessionManager`'s active session set (the set of `ownerSessionIds`)
- Not trashed (`meta.trashed !== true`)
- Has a `.meta.json` sidecar (sessions without one get a minimal metadata-only entry)

**Reports index entry (differs from docs):**

```jsonc
{
  "relativePath": "reports/20260209_143022_flutter-app.log",
  "uri": "file:///...",
  "sizeBytes": 524288,
  "mtime": 1739097735000,
  "lineCount": 12847,
  "displayName": "Flutter App Debug",
  "tags": ["flutter", "debug"],
  "correlationTokens": ["file:app.dart", "file:home_screen.dart", "error:NullPointerException"],
  "fingerprints": ["NullPointerException@app.dart:42"],
  "errorCount": 3,
  "warningCount": 12
}
```

### Index Storage: `.saropa/index/`

- Lives at workspace root in `.saropa/index/`
- Unobtrusive — single dotfolder, easy to gitignore
- Separate from `reports/` so it doesn't pollute log output
- Auto-created on first index build; auto-cleaned if feature is disabled

#### Why `.saropa/` and not `reports/.index/`?

- `reports/` is user-facing output; tooling artifacts don't belong there
- Users may delete `reports/` to clean logs without losing index config
- `.saropa/` can host future extension state (caches, preferences) without cluttering `reports/`
- Easy one-line gitignore: `.saropa/`

### Manifest File (`manifest.json`)

```jsonc
{
  "version": 1,
  "createdAt": "2026-02-09T10:30:00.000Z",
  "updatedAt": "2026-02-09T14:22:15.000Z",
  "sources": [
    {
      "id": "docs",
      "path": "docs",
      "enabled": true,
      "fileTypes": [".md", ".txt"],
      "lastIndexed": "2026-02-09T14:22:15.000Z",
      "fileCount": 12,
      "tokenCount": 847
    },
    {
      "id": "bugs",
      "path": "bugs",
      "enabled": true,
      "fileTypes": [".md", ".txt"],
      "lastIndexed": "2026-02-09T14:20:00.000Z",
      "fileCount": 8,
      "tokenCount": 523
    },
    {
      "id": "root-files",
      "path": ".",
      "enabled": true,
      "fileTypes": [".md", ".txt"],
      "depth": 0,
      "lastIndexed": "2026-02-09T14:22:15.000Z",
      "fileCount": 3,
      "tokenCount": 156
    },
    {
      "id": "reports",
      "path": "reports",
      "enabled": true,
      "strategy": "sidecar",
      "lastIndexed": "2026-02-09T14:22:15.000Z",
      "fileCount": 24,
      "tokenCount": 312,
      "trashedCount": 2,
      "skippedActive": 1
    }
  ]
}
```

### Per-Source Index File (`<source>.idx.json`)

```jsonc
{
  "version": 1,
  "sourceId": "docs",
  "buildTime": 1739097735000,
  "files": [
    {
      "relativePath": "docs/FIREBASE_CRASHLYTICS.md",
      "uri": "file:///d:/src/saropa-log-capture/docs/FIREBASE_CRASHLYTICS.md",
      "sizeBytes": 4821,
      "mtime": 1739097600000,
      "lineCount": 142,
      "tokens": [
        "firebase", "crashlytics", "projectid", "appid",
        "gcloud", "accesstoken", "flutterfirecore"
      ],
      "headings": [
        { "level": 1, "text": "Firebase Crashlytics Integration", "line": 1 },
        { "level": 2, "text": "Prerequisites", "line": 10 },
        { "level": 2, "text": "Configuration", "line": 25 }
      ]
    }
  ]
}
```

#### Index Entry Fields

| Field | Purpose |
|-------|---------|
| `relativePath` | Display and dedup key |
| `uri` | VS Code URI for file operations |
| `sizeBytes` + `mtime` | Delta detection — skip unchanged files |
| `lineCount` | Stats and budget estimation |
| `tokens` | Lowercased significant words for fast token matching |
| `headings` | Markdown heading structure for navigation and context |

### Token Extraction Strategy

Tokens are extracted from file content to enable fast keyword matching without reading file contents at query time.

**Extraction rules:**
1. Split on whitespace and punctuation
2. Lowercase all tokens
3. Discard tokens < 3 characters
4. Discard common stop words (the, and, is, for, with, this, that, etc.)
5. Deduplicate per file
6. Cap at 500 tokens per file (prioritize headings, code blocks, and bold text)

**Markdown-aware extraction:**
- Headings get 2x weight (stored separately in `headings` array)
- Code blocks (```` ``` ````) — extract identifiers (camelCase split, dot-notation split)
- Bold/italic text — extract as-is
- Links — extract link text, ignore URLs
- Front matter — extract YAML keys and values

---

## Configuration

### New Settings

```jsonc
{
  // Master toggle — enables/disables the entire project indexer
  "saropaLogCapture.projectIndex.enabled": {
    "type": "boolean",
    "default": true,
    "description": "Enable project-wide indexing of documentation and knowledge files for faster analysis searches."
  },

  // Which directories to index (replaces/extends docsScanDirs).
  // See docs/ECOSYSTEM_KNOWLEDGE_FILES.md for a full catalog of
  // ecosystem-specific folders and file types users may want to add.
  "saropaLogCapture.projectIndex.sources": {
    "type": "array",
    "default": [
      // Universal — nearly every project has one or both
      { "path": "docs", "fileTypes": [".md", ".txt"] },
      { "path": "doc", "fileTypes": [".md", ".txt", ".rst", ".rdoc"] },

      // Issue tracking / internal knowledge
      { "path": "bugs", "fileTypes": [".md", ".txt"] },

      // GitHub — issue/PR templates, CONTRIBUTING, SECURITY, CODEOWNERS
      { "path": ".github", "fileTypes": [".md", ".yml", ".yaml"] },

      // Architecture decision records — common in larger codebases
      { "path": "adr", "fileTypes": [".md"] },

      // Design specs, proposals, RFCs
      { "path": "rfcs", "fileTypes": [".md"] },
      { "path": "design", "fileTypes": [".md", ".txt"] },

      // Guides, wikis, handbooks
      { "path": "wiki", "fileTypes": [".md"] },
      { "path": "guides", "fileTypes": [".md"] }
    ],
    "description": "Directories to index for project knowledge. Each entry specifies a path (relative to workspace root) and file types to include. Non-existent directories are silently skipped.",
    "items": {
      "type": "object",
      "properties": {
        "path": {
          "type": "string",
          "description": "Directory path relative to workspace root."
        },
        "fileTypes": {
          "type": "array",
          "items": { "type": "string" },
          "description": "File extensions to include (e.g. '.md', '.txt')."
        },
        "enabled": {
          "type": "boolean",
          "default": true,
          "description": "Enable or disable this specific source."
        }
      },
      "required": ["path"]
    }
  },

  // Also index loose files at workspace root
  "saropaLogCapture.projectIndex.includeRootFiles": {
    "type": "boolean",
    "default": true,
    "description": "Index matching files at the workspace root (README.md, CHANGELOG.md, etc.)."
  },

  // Index completed log sessions from reports/ using .meta.json sidecars
  "saropaLogCapture.projectIndex.includeReports": {
    "type": "boolean",
    "default": true,
    "description": "Index completed (non-active, non-trashed) log sessions from the reports directory. Uses .meta.json sidecar data — does not read log file content."
  },

  // Max files per source to prevent runaway scanning
  "saropaLogCapture.projectIndex.maxFilesPerSource": {
    "type": "number",
    "default": 100,
    "minimum": 10,
    "maximum": 1000,
    "description": "Maximum number of files to index per source directory."
  },

  // How often to re-check for changes (seconds). 0 = on-demand only
  "saropaLogCapture.projectIndex.refreshInterval": {
    "type": "number",
    "default": 0,
    "minimum": 0,
    "maximum": 3600,
    "description": "Seconds between automatic index refreshes. 0 = only refresh on demand (when analysis runs)."
  }
}
```

### Migration from `docsScanDirs`

The existing `docsScanDirs` setting continues to work as a fallback:

1. If `projectIndex.sources` is explicitly set → use it
2. Else if `docsScanDirs` is set → convert each dir string to `{ path: dir, fileTypes: [".md", ".txt"] }`
3. Else → use defaults

This preserves backward compatibility. The `docsScanDirs` setting can be deprecated in a future release.

---

## Delta / Incremental Updates

### Change Detection

Each index entry stores `mtime` and `sizeBytes`. On rebuild:

```
for each file in source directory:
    existing = index.findByPath(file.relativePath)
    if existing AND existing.mtime === file.mtime AND existing.size === file.size:
        skip (keep existing entry)
    else:
        re-index file:
            docs/bugs → read file content, extract tokens
            reports   → read .meta.json sidecar, extract correlationTags + fingerprints

remove entries for files that no longer exist on disk
```

### Update Strategies

The indexer uses two update paths depending on who produced the data:

#### Inline updates (extension-produced data)

When the extension itself creates or modifies a file, it already knows exactly what changed. Rather than marking dirty and waiting, it updates the index entry immediately:

| Event | Action |
|-------|--------|
| Session finalized → `.meta.json` written | Upsert `reports.idx.json` entry with correlationTags, fingerprints, counts |
| Crash detail fetched → cache file written | Upsert Crashlytics cache entry (if indexed in future) |
| Session trashed | Remove entry from `reports.idx.json` |
| Session restored from trash | Upsert entry back into `reports.idx.json` |

This is a single `upsertEntry(sourceId, entry)` / `removeEntry(sourceId, relativePath)` call — no full rebuild needed.

#### Lazy rebuilds (external changes)

For changes made outside the extension (user edits a markdown file, git operations, etc.), the dirty-flag + lazy rebuild approach applies:

| Trigger | Behavior |
|---------|----------|
| Analysis panel opens | `getOrRebuild(maxAgeMs)` — delta rebuild if stale |
| File watcher fires | Mark affected source as dirty, rebuild on next query |
| User runs command | Full rebuild of all sources |
| `refreshInterval` timer | Background delta check (if > 0) |
| Extension activation | Load manifest from disk (no rebuild) |

The lazy rebuild also acts as a **consistency safety net** — it catches anything the inline updates might have missed (e.g., crash during a write, extension killed mid-operation).

### File Watcher Integration

Register a `FileSystemWatcher` per enabled source:

```typescript
const watcher = vscode.workspace.createFileSystemWatcher(
    new vscode.RelativePattern(workspaceFolder, `${source.path}/**/*.{md,txt}`),
);
watcher.onDidChange(uri => markSourceDirty(source.id));
watcher.onDidCreate(uri => markSourceDirty(source.id));
watcher.onDidDelete(uri => markSourceDirty(source.id));
```

Dirty sources are rebuilt lazily on next query, not immediately — avoids thrashing during bulk file operations (git checkout, branch switch, etc.).

---

## Integration Points

### 1. `docs-scanner.ts` — Token Search Acceleration

**Before:** Reads every file in `docsScanDirs` from disk, scans content line-by-line for tokens.

**After:**
1. Load index for relevant sources
2. Filter files whose `tokens` array intersects with query tokens (fast set intersection)
3. Only read files that matched at token level (skip the rest entirely)
4. Fall back to full scan if index is missing or disabled

**Expected speedup:** For a project with 50 doc files, if only 5 contain relevant tokens, we skip reading 45 files from disk.

### 2. Analysis Panel — Richer Context

The index `headings` array enables the analysis panel to show *where* in a document a match was found:

```
Found in docs/TROUBLESHOOTING.md:
  ## Firebase Connection Errors (line 42)
    → matched token: "FirebaseException"
```

### 3. Viewer Search — Future "Search Project Docs" Command

With the index in place, a future command could search across all indexed project files:

- Webview sends `{ type: 'searchProjectDocs', query: 'FirebaseException' }`
- Extension queries index for matching files + line numbers
- Results shown in a quick-pick or inline panel

This is **out of scope** for the initial implementation but the index design supports it.

### 4. `search-index.ts` — Coexistence & Future Deprecation

The existing `search-index.ts` indexes `reports/` file metadata (lineCount, sizeBytes, mtime) into `.search-index.json`. The new `reports.idx.json` overlaps with this data.

**Short term:** Both coexist. `search-index.ts` continues to serve the Project Logs tree view and viewer file listing. `reports.idx.json` serves analysis token lookups. They have different consumers and different data shapes.

**Long term:** Once the project indexer is stable, `search-index.ts` can be deprecated by adding the missing fields (`lineCount`, `sizeBytes`) to `reports.idx.json` entries (already planned) and routing the tree view through the project indexer's `query()` API.

### 5. Cross-Session Analysis — Broader Token Matching

`correlation-scanner.ts` currently extracts tokens from log files only. With the project index, it could also check if extracted error tokens appear in documentation, linking "known issues" to recurring log errors.

---

## Implementation Stages

### Stage 1: `.saropa/` Foundation & Crashlytics Migration

**Files:** `src/modules/firebase-crashlytics.ts`, `src/modules/gitignore-checker.ts`, `src/extension.ts`

- Create `.saropa/cache/crashlytics/` directory structure
- Migrate existing `reports/.crashlytics/*.json` → `.saropa/cache/crashlytics/`
- Delete old `reports/.crashlytics/` after successful migration
- Update `firebase-crashlytics.ts` cache path from `getLogDirectoryUri()` to `.saropa/cache/crashlytics/`
- Offer to add `.saropa/` to `.gitignore` (same pattern as `reports/`)

**Estimated scope:** ~30 lines changed across 3 files

### Stage 2: Core Index Infrastructure

**Files:** `src/modules/project-indexer.ts`

- `ProjectIndexer` class with `build()`, `rebuild()`, `getOrRebuild()`, `query()`
- `upsertEntry(sourceId, entry)` and `removeEntry(sourceId, relativePath)` for inline updates
- Manifest read/write to `.saropa/index/manifest.json`
- Per-source index read/write to `.saropa/index/<id>.idx.json`
- Delta detection via mtime + sizeBytes
- Token extraction from file content (docs/bugs) and sidecar metadata (reports)
- Markdown heading extraction (H1-H3)
- Configuration reading from new settings
- Fallback to `docsScanDirs` if new settings not configured

**Estimated scope:** 1 new file (~250 lines), config.ts additions (~30 lines), package.json settings (~60 lines)

### Stage 3: Inline Index Updates

**Files:** `src/modules/session-lifecycle.ts`, `src/modules/session-metadata.ts`, `src/modules/project-indexer.ts`

- After `finalizeSession()` writes `.meta.json` → call `indexer.upsertEntry('reports', entry)`
- After `setTrashed(true)` → call `indexer.removeEntry('reports', path)`
- After `setTrashed(false)` (restore) → call `indexer.upsertEntry('reports', entry)`
- These are single-entry updates, not full rebuilds

**Estimated scope:** ~25 lines across 3 files

### Stage 4: Docs Scanner Integration

**Files:** `src/modules/docs-scanner.ts`

- Replace direct file scanning with index-first lookup
- Token pre-filter: only read files whose index tokens match query
- Graceful fallback to full scan if index unavailable
- Pass heading context through to `DocMatch` results

**Estimated scope:** ~40 lines changed in docs-scanner.ts

### Stage 5: File Watcher & Lifecycle

**Files:** `src/modules/project-indexer.ts`, `src/extension.ts`

- Register `FileSystemWatcher` per source (docs/bugs only — reports uses inline updates)
- Dirty-flag tracking per source
- Lazy rebuild on next query (safety net for external changes)
- Disposal on extension deactivate
- Optional timer-based refresh (if `refreshInterval` > 0)
- Command: `saropaLogCapture.rebuildProjectIndex` (manual trigger)

**Estimated scope:** ~50 lines in project-indexer.ts, ~15 lines in extension.ts

### Stage 6: Analysis Panel Enhancements

**Files:** `src/modules/bug-report-collector.ts`, analysis panel templates

- Show heading context for doc matches ("Found under ## Troubleshooting")
- Sort matches by heading relevance
- Include indexed file count in analysis summary

**Estimated scope:** ~30 lines across 2-3 files

---

## Performance & UX

Indexing must never block the editor. Every operation falls into one of three performance tiers:

### Tier 1: Invisible (< 50ms, no UI feedback)

| Operation | Why it's fast |
|-----------|---------------|
| Inline upsert/remove | Single JSON read → patch → write. No file scanning. |
| Index query (token lookup) | In-memory set intersection against loaded index. |
| Load manifest from disk | Single small JSON file on extension activation. |
| Mark source dirty | Set a boolean flag. No I/O. |

These run synchronously (or near-synchronously) on the extension host. No spinner, no progress bar, no user awareness needed.

### Tier 2: Background with status (50ms–5s)

| Operation | Expected duration | UX |
|-----------|-------------------|-----|
| Lazy delta rebuild (small) | 200–500ms for 20 changed files | Status bar text: "Indexing docs..." with spinner icon |
| Sidecar scan (reports) | 100–300ms for 50 `.meta.json` reads | Status bar text: "Indexing sessions..." |
| Crashlytics cache migration | 50–500ms depending on file count | One-time, runs during activation |

These use VS Code's `window.withProgress` API with `ProgressLocation.Window` (status bar):

```typescript
await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Window, title: 'Indexing docs...' },
    async (progress) => {
        for (const [i, file] of files.entries()) {
            progress.report({ message: `${i + 1}/${files.length}` });
            await indexFile(file);
        }
    },
);
```

Key behaviours:
- **Non-blocking** — editor remains fully interactive during indexing
- **Auto-dismiss** — status bar text clears when done (no notification to close)
- **Incremental progress** — `X/N` counter updates as files are processed
- **Cancellable** — if triggered by analysis, the calling code can pass a `CancellationToken` to abort mid-rebuild

### Tier 3: Foreground with progress (> 5s)

| Operation | When | UX |
|-----------|------|-----|
| Full rebuild (manual command) | "Rebuild Project Index" from command palette | `ProgressLocation.Notification` with cancel button |
| First-ever index build | Large project, no existing index — triggered automatically on first query | Same as above |

These use a notification-level progress bar because the operation is long enough to warrant explicit feedback:

```typescript
await vscode.window.withProgress(
    {
        location: vscode.ProgressLocation.Notification,
        title: 'Rebuilding project index',
        cancellable: true,
    },
    async (progress, token) => {
        for (const source of sources) {
            if (token.isCancellationRequested) { break; }
            progress.report({ message: source.id, increment: 100 / sources.length });
            await rebuildSource(source, token);
        }
    },
);
```

Key behaviours:
- **Cancel button** — stops mid-rebuild, keeps whatever was already indexed
- **Per-source progress** — "docs... bugs... reports..." as each source completes
- **Percentage bar** — fills proportionally to source count
- **Partial index is valid** — if cancelled halfway, the completed sources are usable immediately

### Parallelism

| Level | Strategy |
|-------|----------|
| **Across sources** | Sequential — one source at a time to avoid file handle contention |
| **Within a source** | `Promise.all` batches of 10 files — concurrent reads, bounded concurrency |
| **Token extraction** | Synchronous per file (string splitting is CPU, not I/O) |
| **Index writes** | Single write per source after all files processed (not per-file) |

Bounded concurrency example:

```typescript
async function processInBatches<T>(items: T[], batchSize: number, fn: (item: T) => Promise<void>): Promise<void> {
    for (let i = 0; i < items.length; i += batchSize) {
        await Promise.all(items.slice(i, i + batchSize).map(fn));
    }
}
```

Why not fully parallel across sources: each source produces an independent `.idx.json` file write. Running them all concurrently risks disk thrashing and provides minimal speed gain (most time is in file reads, which are already batched within each source).

### Timing Budgets

Target durations for a typical project (50 doc files, 100 report sessions):

| Operation | Budget | If exceeded |
|-----------|--------|-------------|
| Inline upsert | < 20ms | Investigate — should be a single file write |
| Delta rebuild (docs, 5 changed) | < 200ms | Acceptable up to 500ms with status bar |
| Delta rebuild (reports, 10 new sessions) | < 100ms | Sidecar reads are tiny |
| Full rebuild (all sources) | < 3s | Show notification progress bar |
| Token query (10 tokens × 200 indexed files) | < 10ms | In-memory, no I/O |

### Analysis Panel Integration

When the analysis panel triggers a `getOrRebuild()`, the indexer must not delay the panel's own progressive rendering:

1. Analysis panel calls `getOrRebuild(maxAgeMs: 60000)`
2. If index is fresh → return the in-memory index immediately (Tier 1)
3. If index is stale → return the **stale index** immediately, then fire-and-forget a delta rebuild (non-awaited promise with `.catch()` error handling)
4. When the background rebuild completes, it updates the in-memory index
5. The *next* analysis call gets the fresh index

This "serve stale, refresh in background" pattern ensures analysis never waits for indexing. The rebuild promise is not awaited by the caller — it runs independently and updates shared state when done.

### What NOT to do

- **Never block activation** — index loading is async. Extension activates immediately.
- **Never rebuild on every file save** — dirty flag + lazy rebuild only.
- **Never read log file content** — reports use sidecar metadata only.
- **Never show a modal dialog** — all progress is non-blocking (status bar or notification).
- **Never index during active recording** — active sessions are skipped, period.

---

## Safeguards

| Concern | Mitigation |
|---------|------------|
| Large workspaces | `maxFilesPerSource` cap (default 100), max scan depth 10 |
| Binary files | Only index configured text extensions (`.md`, `.txt`) |
| Frequent rebuilds | Inline updates for extension-produced data; dirty-flag + lazy rebuild for external changes |
| Index corruption | Version field enables safe migration; delete + rebuild on version mismatch |
| Disk usage | Tokens-only index is small (~1-5 KB per file); no full-text storage |
| Privacy | Index lives in `.saropa/` which should be gitignored; no content stored, only tokens |
| Backward compat | `docsScanDirs` fallback; index is optional acceleration, not required |

---

## File Budget

| File | Current Lines | Added Lines | Notes |
|------|--------------|-------------|-------|
| `project-indexer.ts` | New | ~250 | Core module (may split if > 300) |
| `config.ts` | 279 | ~30 | New settings reader + migration |
| `package.json` | — | ~60 | New setting definitions |
| `firebase-crashlytics.ts` | — | ~15 | Cache path migration to `.saropa/` |
| `docs-scanner.ts` | 79 | ~20 | Index-first lookup |
| `session-lifecycle.ts` | — | ~10 | Inline index update after finalization |
| `session-metadata.ts` | 183 | ~10 | Inline index update on trash/restore |
| `extension.ts` | — | ~20 | Lifecycle wiring + migration trigger |
| `gitignore-checker.ts` | — | ~10 | `.saropa/` handling |

Total new code: ~425 lines across 9 files. `project-indexer.ts` will likely need to be split into `project-indexer.ts` + `token-extractor.ts` (or `report-indexer.ts`) to stay under the 300-line limit.

---

## Stale Entry Cleanup

When a source file is deleted, renamed, or moved, its index entry becomes stale. The indexer handles this at three levels:

### 1. Delta Rebuild — Purge Pass

Every delta rebuild includes a purge step after the scan-and-update loop:

```
// After processing all files on disk:
for each entry in index.files:
    if entry.relativePath NOT in diskFileSet:
        remove entry from index
        decrement manifest.fileCount and manifest.tokenCount
```

This catches all deletions, renames, and moves — regardless of whether a file watcher fired.

### 2. File Watcher — `onDidDelete`

The watcher's `onDidDelete` handler marks the source dirty (same as create/change). The actual removal happens on the next lazy rebuild, not immediately. This avoids:

- Racing with bulk operations (e.g. `git checkout` deleting and recreating files)
- Partial index writes during rename sequences (delete old + create new)

### 3. Source Directory Removed

If an entire source directory is deleted (e.g. user removes `bugs/`):

- The delta rebuild finds zero files on disk → all entries are purged
- The manifest entry remains with `fileCount: 0` (the source config still exists in settings)
- The `.idx.json` file is rewritten as empty (`files: []`)
- No error is raised — the source is simply idle until the directory reappears

### 4. Reports — Trashed & Active Sessions

The reports source has two additional exclusion rules beyond the standard purge pass:

- **Trashed sessions** (`meta.trashed === true`) — removed from the index on next rebuild, same as a deleted file. If the user "restores from trash" (sets `trashed` back to `false`), the session re-enters the index on the next rebuild.
- **Active sessions** — skipped entirely during indexing. Once a session completes (removed from `sessionManager.ownerSessionIds`), it becomes eligible on the next rebuild.

The manifest tracks both counts (`trashedCount`, `skippedActive`) for transparency.

### No Tombstone State

The index has no "soft delete" marker. If a file is gone from disk, trashed, or still active, its entry is simply absent from the index. This keeps the index a faithful mirror of queryable state — no ghost entries, no garbage collection needed.

---

## Design Decisions

Settled decisions for implementation (no longer open):

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Token granularity | Per-file only | Simpler, smaller index. Add per-line positions in a follow-up if needed. |
| Heading depth | H1-H3 only | Deeper headings rarely useful for navigation context. |
| Non-markdown parsing | Plain whitespace-split for `.txt` | Only `.md` gets heading/code-block awareness. |
| Command palette | Yes — "Rebuild Project Index" | Low cost, good for transparency and debugging. |
| Status bar indicator | Manual rebuilds only | Lazy rebuilds are fast enough to be invisible. |
| Reports indexing | Sidecar-only (`.meta.json`) | Never read log file content. Sidecars already have `correlationTags` and `fingerprints`. Skip active and trashed sessions. |
| Update strategy | Inline for extension-produced data, lazy for external changes | Session finalize / trash / restore update the index immediately. File watcher handles external edits to docs/bugs. Lazy rebuild is the safety net. |
| Crashlytics cache | Move to `.saropa/cache/crashlytics/` | Single tooling root. `reports/` stays clean. One-time migration of existing cache. |
| Progress UX | Three tiers: invisible (< 50ms), status bar (50ms–5s), notification (> 5s) | Inline updates are silent. Lazy rebuilds show status bar. Manual rebuilds show cancellable notification. |
| Stale-serve pattern | Return stale index immediately, refresh in background | Analysis panel never waits for indexing. Next analysis gets the fresh index. |
| Parallelism | Sequential across sources, batched (10) within sources | Avoids file handle contention while keeping reads concurrent. |
