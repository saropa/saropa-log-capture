# Cross-Session Analysis — Relating Logs Across Debug Runs

## Vision

A log line is never just one moment. The same file crashes in Tuesday's session and Thursday's. The same API timeout appears across three debug runs. A developer fixing a bug wants to see: *has this exact problem happened before, and what was different?*

Cross-session analysis turns isolated log files into a connected investigation surface — and because the extension runs inside VS Code with full workspace access, it can bridge the gap between **log output** and **project source code** in both directions.

## What Already Exists

| Capability | Location | Reuse potential |
|-----------|----------|----------------|
| Parallel file search | `log-search.ts` `searchLogFilesConcurrent()` | Direct — scans all sessions fast |
| Source reference extraction | `source-linker.ts` `extractSourceReference()` | Direct — pulls `file.dart:42` from any line |
| Context menu with line data | `viewer-context-menu.ts` | Direct — add new actions, line text available |
| "Search Sessions" action | `viewer-handler-wiring.ts` | Extend — already opens cross-file QuickPick |
| Session metadata + tags | `session-metadata.ts` | Direct — sidecar `.meta.json` per session |
| Bookmarks (cross-session) | `bookmark-store.ts` | Extend — already stores line refs across files |
| 2-session diff | `diff-engine.ts` + `session-comparison.ts` | Extend — normalize + compare logic reusable |
| Stack classification | `stack-parser.ts` | Direct — framework vs app code filtering |
| Session history tree | `session-history-provider.ts` | Direct — lists all sessions with metadata |
| Workspace file access | `vscode.workspace.findFiles()` | Direct — search project source files by glob |
| Document reading | `vscode.workspace.openTextDocument()` | Direct — read any workspace file content |
| Source extensions list | `source-linker.ts` `sourceExtensions` | Direct — 30+ language extensions known |

## Feature Ideas

### 1. "Analyze Line" Context Menu Action

Right-click any log line. The extension extracts keywords and scans all other session files in parallel.

**What gets extracted from the clicked line:**

| Token type | Example | How |
|-----------|---------|-----|
| Source files | `user_service.dart:142` | `extractSourceReference()` already does this |
| Class/function names | `UserRepository.fetch` | Split on `.` after stripping stack frame prefix |
| Error identifiers | `SocketException`, `404`, `DEADLINE_EXCEEDED` | Pattern match known error shapes |
| Quoted strings | `"user_abc_123"` | Regex for quoted substrings |
| HTTP endpoints | `/api/v2/users` | Regex for URL path patterns |

**What gets shown:**

A results panel (QuickPick or webview) grouped by session, showing:
- Which other sessions mention the same source file
- Which sessions had the same error type
- A "relevance" count (how many of the extracted tokens matched)
- One-click to open that session at the matching line

**Why it's valuable:** One click from "I see a crash in `payment_handler.dart`" to "this file also crashed in 3 previous sessions, here are those lines."

**Workspace dimension:** The search runs in two directions simultaneously:

| Direction | What it searches | What it finds |
|-----------|-----------------|---------------|
| **Logs ← → Logs** | Other session files in `reports/` | Same error/file in previous debug runs |
| **Logs → Source** | Project files via `workspace.findFiles()` | The actual code at the crash site, callers, related files |

When a log line references `payment_handler.dart:142`, "Analyze Line" can:
- Open the actual source file and show the code around line 142
- Search the project for other files that import or call `payment_handler`
- Find TODOs/FIXMEs near the crash site
- Show git history for the crash site — full commit log, not just blame:
  - `git log --oneline -- path/to/file.dart` — all commits that touched this file
  - `git log -L 140,145:path/to/file.dart` — commits that changed the specific crash region
  - `git log --since="2024-01-10" -- path/to/file.dart` — changes since the first session that mentioned this file
- Answer: "was this file changed recently?" and "who changed the crashing line, and when?"

### 2. Project-Aware Log Intelligence

The extension sits inside the user's workspace — it knows the project structure. This enables features that a standalone log viewer never could.

**Reverse lookup: "Which logs mention this file?"**
Right-click a source file in the VS Code explorer → "Show Log History" → see every session that mentioned this file, sorted by recency. Uses `searchLogFilesConcurrent()` with the filename as query.

**Import/call graph tracing:**
A crash in `payment_handler.dart` often means the bug is in a caller. The extension can:
1. Find the crashing file in the workspace
2. Search project source for `import.*payment_handler` or function call patterns
3. Cross-reference those callers against log sessions — "did the caller also appear in logs?"

**Dead code / untested code detection:**
Compare the source file heatmap against `workspace.findFiles('**/*.dart')`. Files that exist in the project but *never* appear in any log session might be untested code paths.

**Contextual error lookup:**
When a log shows `NullPointerException at user_service.dart:87`, the extension can read line 87 of the actual source file and display it inline in the analysis results — so the user sees the error *and* the code without switching files.

### 3. Source File Heatmap (Logs + Project)

Aggregate all source references across all sessions into a frequency table.

```
payment_handler.dart    ████████████  47 mentions (12 sessions)
user_service.dart       ████████      31 mentions (8 sessions)
api_client.dart         ████          15 mentions (6 sessions)
main.dart               ██             7 mentions (5 sessions)
```

**How:** Iterate all session files, run `extractSourceReference()` on every line, count per source file. Cache the index — only re-scan files whose mtime changed.

**Workspace dimension:** Cross-reference against project files via `workspace.findFiles()`:
- Files that appear in logs but don't exist in the project → stale references or framework internals
- Files that exist in the project but never appear in logs → untested code paths
- Files with high log frequency + recent git changes → prime suspects

**Why it's valuable:** Instantly shows which source files generate the most log noise across your entire debug history. The file at the top of this list is probably where the bug lives.

### 4. Error Fingerprinting

Group errors across sessions by a normalized fingerprint, not just exact text match.

**Fingerprint algorithm:**
1. Strip ANSI codes (`ansi.ts` already does this)
2. Strip timestamps (diff-engine normalization already does this)
3. Replace numbers/IDs with placeholders: `user_12345` -> `user_*`
4. Replace hex/UUIDs: `0x7fff5fbff8a0` -> `0x*`
5. Hash the result

**Example:** These three lines from three sessions share the same fingerprint:
```
[14:30:01] SocketException: Connection refused (port 8080)
[09:15:44] SocketException: Connection refused (port 3000)
[16:02:17] SocketException: Connection refused (port 5432)
```

Fingerprint: `socketexception: connection refused (port *)`

**UI:** A "recurring errors" panel showing fingerprinted error groups, how many sessions they appear in, and when they first/last occurred.

**Why it's valuable:** Answers "is this a new error or one I've seen before?" without exact-match searching.

### 5. Session Timeline

A lightweight visual showing sessions on a time axis with markers for shared events.

```
Mon 14:00  ──[session 1]──  (SocketException x3, payment_handler.dart)
Mon 16:30  ──[session 2]──  (SocketException x1, payment_handler.dart)
Tue 09:00  ──[session 3]──  (clean run, no errors)
Tue 11:15  ──[session 4]──  (new error: NullPointerException, user_service.dart)
```

**Data source:** Session metadata already has `date` and `mtime`. Error counts come from category analysis during file scan.

**Why it's valuable:** Shows the story of a debugging session — when errors appeared, when they stopped, whether a fix actually worked.

### 6. Auto-Correlation Tags

When a session is recorded (or when a file is first opened), automatically scan for notable patterns and store them as `autoTags` in the sidecar metadata.

**Tag extraction rules:**
- Source files mentioned: `file:payment_handler.dart`
- Error types seen: `error:SocketException`
- Debug adapter used: `adapter:dart` (already in header)
- Session outcome: `outcome:crash` vs `outcome:clean`
- Duration bucket: `duration:short` / `duration:long`

**How tags enable analysis:**
- Filter session history tree by tag
- "Show all sessions mentioning `payment_handler.dart`" = filter by `file:payment_handler.dart` tag
- Tags are indexed (no re-scan needed) since they live in `.meta.json`

**Why it's valuable:** Turns the session history from a flat file list into a searchable, filterable investigation log.

### 7. Investigation Groups

Let users collect sessions into named groups for a specific investigation.

**Example:**
```
"Bug #42: Payment timeout"
├── session_2024-01-15_1430.log  (first occurrence)
├── session_2024-01-15_1630.log  (after fix attempt 1)
├── session_2024-01-16_0900.log  (after fix attempt 2 — clean!)
└── notes: "Root cause was connection pool exhaustion"
```

**Storage:** New sidecar file per investigation, or workspace state entry:
```json
{
  "id": "inv_001",
  "name": "Bug #42: Payment timeout",
  "sessions": ["uri1", "uri2", "uri3"],
  "notes": "Root cause was connection pool exhaustion",
  "created": "2024-01-15T14:30:00Z"
}
```

**UI entries:**
- Context menu: "Add to Investigation..." on any session in history tree
- Toolbar: "New Investigation" button
- Tree view: investigation groups as collapsible parents above the flat session list
- Analysis: shared errors/files across group members auto-highlighted

**Why it's valuable:** Gives structure to the debugging process. Instead of remembering "which session was the one where I tried the connection pool fix?", it's labeled and grouped.

### 8. Cross-Session Diff (N-way)

Extend the existing 2-session comparison to work across N sessions.

**Not a side-by-side panel** (doesn't scale) — instead a "what changed?" summary:

```
Across 4 selected sessions:
  Lines appearing in ALL sessions:     12  (common baseline)
  Lines appearing in SOME sessions:    47  (intermittent)
  Lines unique to one session:         83  (noise / one-offs)

  New in session 4 (not in 1-3):        5  ← likely from your latest code change
  Gone in session 4 (was in 1-3):       2  ← errors you fixed
```

**How:** The diff-engine already normalizes and compares. Extend to build a frequency map: for each normalized line, count how many sessions contain it.

**Why it's valuable:** After a code change, run the debugger, then compare the new session against the previous N. See exactly what output is new (potential regressions) and what disappeared (fixes confirmed).

## Implementation Stages

### Stage A: Analyze Line (builds on existing search)

1. Add "Analyze Across Sessions" to context menu
2. Extract tokens from the clicked line (source refs, error types, quoted strings)
3. Run two parallel searches:
   - `searchLogFilesConcurrent()` across session files in `reports/`
   - `workspace.findFiles()` to locate the referenced source file in the project
4. If a source file is found in the workspace, fetch git history:
   - `git log --oneline -- <file>` — commit history for the file
   - `git log -L <start>,<end>:<file>` — commits that changed the crash region
5. Show results in a QuickPick grouped by category (other sessions, source context, git history)
6. Click to open session at matching line, or source file at crash site

**Effort:** Low-medium. Most infrastructure exists. Main new work is token extraction, git CLI calls, and result formatting.

**Files touched:** `viewer-context-menu.ts`, `viewer-handler-wiring.ts`, new `cross-session-analyzer.ts` module.

### Stage B: Auto-Correlation Tags

1. On session file open/load, scan for source files and error types
2. Store as `autoTags` in sidecar metadata
3. Add tag filter to session history tree
4. Cache: only re-scan when mtime changes

**Effort:** Low. `extractSourceReference()` and metadata store exist. Main work is the scan-on-load trigger and tree filtering.

**Files touched:** `session-history-provider.ts`, `session-metadata.ts`, new `auto-tagger.ts`.

### Stage C: Source File Heatmap + Error Fingerprinting

1. Build a background index: source file mentions and error fingerprints across all sessions
2. Cache the index, invalidate on mtime change
3. Show heatmap in a webview panel or tree view
4. Show recurring errors panel
5. One-click from heatmap entry to filtered session list

**Effort:** Medium. Needs an indexing pass and a new UI panel.

**Files touched:** New `session-index.ts`, new `heatmap-panel.ts` or tree view.

### Stage D: Investigation Groups

1. Add workspace-state-backed investigation store
2. "Add to Investigation" context action on session tree items
3. Investigation groups as tree parents in session history
4. Shared analysis summary per group (common errors, source files)

**Effort:** Medium. Storage is simple (workspace state). UI work is the tree view restructuring.

### Stage E: Cross-Session Diff (N-way) + Timeline

1. Extend diff engine for N-session frequency maps
2. "What changed?" summary panel
3. Session timeline view with error markers
4. Overlay correlation lines between timeline events

**Effort:** High. Meaningful new UI and data processing.

## Design Principles

1. **Speed over completeness** — "Analyze Line" should return in < 500ms. Use concurrent search, cap results, show partial results immediately.
2. **Index lazily** — Don't scan all files on activation. Scan when the user asks, cache for next time.
3. **Reuse existing infrastructure** — `searchLogFilesConcurrent`, `extractSourceReference`, `compareLogSessions`, `SessionMetadataStore`.
4. **Progressive disclosure** — Start with "Analyze Line" (one click, instant results). Heatmaps and timelines come later.
5. **Non-destructive** — Analysis is read-only. Never modify log files. Metadata goes in sidecars.
6. **Two-directional by default** — Every analysis feature should search both log sessions *and* project source. Logs explain what happened; source explains why.
7. **Git is cheap** — `git log`, `git blame`, `git diff` are fast CLI calls. Use them freely for context. The user's project is already a git repo in most cases.

## Open Questions

- Should "Analyze Line" results appear in a QuickPick (lightweight, fast) or a dedicated webview panel (richer, persistent)?
- Should auto-tags be computed eagerly (on capture end) or lazily (on first view)?
- Should investigation groups persist in workspace state or in a `.json` file in the reports directory (shareable via git)?
- Is there value in a "related sessions" section in the session info panel, auto-populated from shared source files?
- Should workspace source scanning respect `.gitignore` / exclude patterns (e.g., skip `node_modules`, `build/`)?
- Should git history results be cached per file, or always fetched fresh (git is fast enough that caching may not be needed)?
- For non-git projects (rare but possible), should the extension gracefully skip git features or offer a filesystem-only fallback?
