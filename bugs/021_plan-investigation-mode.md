# Plan: Investigation Mode

**Status:** Phase 2 complete, Phase 3 pending

**Feature:** Pin multiple sessions and sources into a persistent "investigation" that can be searched together and exported as a bundle.

**Problems Solved:**
- Session ≠ Investigation: bugs span sessions, need terminal + system state bundled together
- Search is siloed: can't search terminal + perf + HTTP together

---

## What exists

- Session list in Project Logs panel (single-session view)
- Find-in-files searches only log files, not sidecars
- `.slc` bundle exports single session with sidecars (added in quick wins)
- Session metadata with integration data
- Bookmarks feature for individual lines

## What's missing

1. **Investigation model**: Persistent named collection of pinned sources
2. **Active investigation state**: Track which investigation is currently open
3. **Cross-source search**: Search query runs across all pinned sources
4. **Investigation panel**: UI to manage pinned sources and view results
5. **Investigation export**: Export all pinned sources as a single bundle
6. **Investigation import**: Recreate investigation from exported bundle
7. **Bug report integration**: Generate report from investigation context

---

## Sub-features

### 1. Investigation Model

**Data structure:**

```typescript
interface Investigation {
    id: string;              // UUID
    name: string;            // User-provided name, e.g. "Auth Timeout Bug #1234"
    createdAt: number;       // Epoch ms
    updatedAt: number;       // Epoch ms
    sources: InvestigationSource[];
    notes?: string;          // User notes/description
    lastSearchQuery?: string; // Restore last search when reopening
}

interface InvestigationSource {
    type: 'session' | 'file';
    relativePath: string;    // Relative to workspace root (portable)
    label: string;           // Display name
    pinnedAt: number;        // When added
}
```

**Source type semantics:**

- `session`: A log session. Pinning a session **automatically includes** its sidecars (`.perf.json`, `.terminal.log`, etc.) without requiring separate pins. The `relativePath` points to the main `.log` file; sidecars are resolved at search/export time using existing `findSidecarUris()`.
- `file`: A standalone file (arbitrary log, external file). No auto-included sidecars.

This simplifies UX: pin one session, get all its integration data.

**Storage:**

Create `src/modules/investigation/investigation-store.ts`:

- Store in `.saropa/investigations.json` (portable, can commit to repo)
- All paths stored relative to workspace root for cross-machine portability
- CRUD operations: create, list, get, update, delete
- Maximum 50 investigations per workspace (configurable)
- Track active investigation ID in workspace state (not persisted to file)

```typescript
class InvestigationStore {
    async createInvestigation(name: string): Promise<Investigation>;
    async listInvestigations(): Promise<Investigation[]>;
    async getInvestigation(id: string): Promise<Investigation | undefined>;
    async addSource(investigationId: string, source: InvestigationSource): Promise<void>;
    async removeSource(investigationId: string, relativePath: string): Promise<void>;
    async deleteInvestigation(id: string): Promise<void>;
    async updateNotes(id: string, notes: string): Promise<void>;
    
    // Active investigation (stored in workspace state, not file)
    async getActiveInvestigationId(): Promise<string | undefined>;
    async setActiveInvestigationId(id: string | undefined): Promise<void>;
    async getActiveInvestigation(): Promise<Investigation | undefined>;
}
```

### 2. Cross-Source Search

**Implementation:**

Create `src/modules/investigation/investigation-search.ts`:

```typescript
interface SearchOptions {
    query: string;
    caseSensitive?: boolean;
    useRegex?: boolean;           // JavaScript regex flavor (supports flags: i, m, s)
    maxResultsPerSource?: number; // Default 100
    contextLines?: number;        // Lines before/after match, default 2
}

// Search history stored in workspace state (not file)
interface SearchHistory {
    queries: string[];            // Last 10 queries, most recent first
}

interface SearchResult {
    source: InvestigationSource;
    sourceFile: string;      // Actual file searched (may be sidecar)
    matches: SearchMatch[];
}

interface SearchMatch {
    line: number;            // 1-indexed
    column: number;
    text: string;            // Matching line text
    context?: string[];      // Surrounding lines
}

async function searchInvestigation(
    investigation: Investigation,
    options: SearchOptions,
    token?: vscode.CancellationToken,
    progress?: (current: number, total: number) => void
): Promise<SearchResult[]> {
    // 1. Expand sources: for 'session' type, resolve sidecars via findSidecarUris()
    // 2. For each file, stream-read and search (avoid loading entire file)
    // 3. Check token.isCancellationRequested between files
    // 4. Report progress(currentFileIndex, totalFiles)
    // 5. For log files: line-by-line regex/string search
    // 6. For JSON sidecars: search string values (skip numeric keys)
    // 7. Cap results per source, aggregate
    // 8. Return sorted by source order (preserves investigation structure)
}
```

**Search in JSON sidecars:**

| Sidecar | Searchable Fields |
|---------|-------------------|
| `.perf.json` | Skip (numeric data only) |
| `.requests.json` | URL, method, status text, response body snippets |
| `.terminal.log` | Full line search (like log files) |
| `.events.json` | Event type, message fields |
| `.queries.json` | Query text, error messages |
| `.browser.json` | Console messages, network URLs |

**Performance considerations:**

- Stream-read files in chunks (don't load entire file into memory)
- Cancel search if user types new query (debounce 300ms in UI)
- Show "Searching N files..." progress indicator
- For files >10MB, search first 10MB only with warning badge

**Search history:**

- Store last 10 queries in workspace state (not file)
- Show dropdown button next to search input
- Click history item to populate and execute search
- Clear history option in dropdown footer

### 3. Investigation Panel

**Implementation:**

Create `src/ui/investigation/investigation-panel.ts`:

- **Main panel**: Webview panel for rich search/results UI
- **Sidebar tree**: Add "Investigations" section to existing Project Logs tree view for quick access/switching

**Layout:**

```
┌─────────────────────────────────────────────────────────────────┐
│ Investigation: "Auth Timeout Bug #1234"                     [×] │
├─────────────────────────────────────────────────────────────────┤
│ 📌 Pinned Sources:                                    [+ Add]   │
│ ├─ 📄 20260312_143022_AuthDebug.log              [Unpin]       │
│ ├─ 📄 20260312_141500_BackendTest.log            [Unpin]       │
│ ├─ 📊 20260312_143022.perf.json                  [Unpin]       │
│ ├─ 🌐 20260312_143022.requests.json              [Unpin]       │
│ └─ ⚠️ deleted-session.log (missing)              [Remove]      │
├─────────────────────────────────────────────────────────────────┤
│ 🔍 Search: [timeout________________] [▾ History] [⚙] [Search]  │
│                                                                 │
│ Results (4 matches across 3 sources):                           │
│ ├─ AuthDebug.log                                                │
│ │  └─ :141  INFO: Retrying connection...          (context)    │
│ │  └─ :142  ERROR: Connection [timeout] exceeded  ← match      │
│ │  └─ :143  DEBUG: Stack trace follows            (context)    │
│ ├─ BackendTest.log                                              │
│ │  └─ :89  [Timeout]Exception in handler          ← match      │
│ └─ requests.json                                                │
│    └─ :12  POST /api/auth 500 (3002ms)            ← match      │
├─────────────────────────────────────────────────────────────────┤
│ 📝 Notes:                                                       │
│ [User's investigation notes here...]                            │
├─────────────────────────────────────────────────────────────────┤
│ [Export as .slc] [Generate Bug Report] [Copy Summary]           │
└─────────────────────────────────────────────────────────────────┘
```

**Search result rendering:**
- Match lines show the matching text highlighted (e.g., `[timeout]` in brackets above)
- Context lines (before/after) are dimmed and collapsible per result group
- Click any line to navigate to file:line in editor

**Interactions:**

- Click source → open in viewer
- Click search result → open file at line
- Drag-and-drop files to add sources
- Context menu on session list → "Add to Investigation"

### 4. Investigation Export

**Implementation:**

Extend `src/modules/export/slc-bundle.ts`:

```typescript
async function exportInvestigationToSlc(
    investigation: Investigation
): Promise<vscode.Uri | undefined> {
    // 1. Resolve all sources to absolute paths
    // 2. For 'session' sources, auto-include sidecars via findSidecarUris()
    // 3. Create manifest with type='investigation'
    // 4. Add investigation.json with metadata and notes
    // 5. Add all source files (logs, sidecars) into sources/ folder
    // 6. Generate ZIP with structure:
    //    manifest.json
    //    investigation.json  (name, notes, lastSearchQuery)
    //    sources/
    //      session1.log
    //      session1.perf.json
    //      session2.log
    //      external-file.log
}
```

**Manifest extension:**

```typescript
interface SlcManifest {
    version: number;  // 3 for investigation bundles
    type: 'session' | 'investigation';
    // For type='session' (existing, v1/v2):
    mainLog?: string;
    parts?: string[];
    sidecars?: string[];
    displayName?: string;
    // For type='investigation' (new, v3):
    investigation?: {
        name: string;
        notes?: string;
        lastSearchQuery?: string;
        sources: { type: 'session' | 'file'; filename: string; label: string }[];
    };
}
```

**Validation update:**

Update `isSlcManifestValid()` to handle both types:

```typescript
export function isSlcManifestValid(manifest: SlcManifest): boolean {
    if (manifest.version === 3 && manifest.type === 'investigation') {
        return !!manifest.investigation?.name && Array.isArray(manifest.investigation.sources);
    }
    // Existing v1/v2 session validation
    const validVersion = manifest.version === 1 || manifest.version === 2;
    return validVersion && typeof manifest.mainLog === 'string' && manifest.mainLog.length > 0;
}
```

### 4b. Investigation Import

**Implementation:**

Add to `src/modules/export/slc-bundle.ts`:

```typescript
async function importInvestigationFromSlc(
    slcUri: vscode.Uri
): Promise<{ investigation: Investigation } | undefined> {
    // 1. Read ZIP, parse manifest
    // 2. Verify type='investigation' and version=3
    // 3. Extract all files from sources/ to workspace log directory
    // 4. Read investigation.json for metadata
    // 5. Create Investigation with sources pointing to extracted files
    // 6. Save to InvestigationStore
    // 7. Set as active investigation
    // 8. Return created investigation
}
```

**Import dispatcher:**

Update main import function to route by type:

```typescript
export async function importSlcBundle(slcUri: vscode.Uri): Promise<ImportResult | undefined> {
    const manifest = await readManifest(slcUri);
    if (manifest.type === 'investigation') {
        return importInvestigationFromSlc(slcUri);
    }
    return importSessionFromSlc(slcUri);  // Existing logic
}
```

### 5. Bug Report Integration

**Implementation:**

Enhance `src/ui/panels/bug-report-panel.ts` and `src/modules/bug-report/bug-report-collector.ts`:

When an investigation is active, add "Investigation Context" section to the report:

```markdown
## Investigation Context

**Investigation:** Auth Timeout Bug #1234
**Created:** 2026-03-12 14:30:22

### Pinned Sources (4)
| Source | Type | Pinned |
|--------|------|--------|
| 20260312_143022_AuthDebug.log | session | 2026-03-12 14:35 |
| 20260312_141500_BackendTest.log | session | 2026-03-12 14:36 |
| external-api.log | file | 2026-03-12 14:40 |

### Recent Search
Query: `timeout`
Matches: 4 across 3 sources

### Investigation Notes
[User's notes verbatim, if any]
```

**Data collection:**

```typescript
interface InvestigationContext {
    name: string;
    createdAt: number;
    sources: { label: string; type: string; pinnedAt: number }[];
    lastSearchQuery?: string;
    lastSearchMatchCount?: number;
    notes?: string;
}

async function collectInvestigationContext(): Promise<InvestigationContext | undefined> {
    const store = new InvestigationStore();
    const active = await store.getActiveInvestigation();
    if (!active) return undefined;
    // Collect and return context
}
```

### 6. Commands and Entry Points

| Command | Description |
|---------|-------------|
| `saropaLogCapture.createInvestigation` | Create new investigation (prompts for name) |
| `saropaLogCapture.openInvestigation` | Open investigation panel (picker if multiple) |
| `saropaLogCapture.closeInvestigation` | Close/deactivate the current investigation |
| `saropaLogCapture.switchInvestigation` | Quick picker to switch active investigation |
| `saropaLogCapture.addToInvestigation` | Add current file/session to active investigation |
| `saropaLogCapture.removeFromInvestigation` | Remove source from active investigation |
| `saropaLogCapture.exportInvestigation` | Export active investigation as .slc |
| `saropaLogCapture.deleteInvestigation` | Delete investigation (with confirmation) |

**Context menu additions:**

- Session list item → "Add to Investigation" submenu → list investigations + "New Investigation..."
- Log viewer → "Pin to Investigation" (adds to active, or prompts to create)
- Sidecar files → "Add to Investigation"
- Investigation source → "Remove from Investigation"

**Sidebar tree additions:**

Add "Investigations" group to Project Logs tree:
```
📁 Project Logs
├─ 📁 Sessions
│  └─ ...
└─ 📁 Investigations
   ├─ 🔍 Auth Timeout Bug #1234 (active)
   ├─ 🔍 Memory Leak March 2026
   └─ + Create Investigation...
```

### 7. Files to create/modify

| File | Change |
|------|--------|
| `src/modules/investigation/investigation-types.ts` | ✅ Data model interfaces + search types |
| `src/modules/investigation/investigation-store.ts` | ✅ Persistence (CRUD + active state + search history) |
| `src/modules/investigation/investigation-search.ts` | ✅ Cross-source search with sidecar resolution, cancellation, progress |
| `src/ui/investigation/investigation-panel.ts` | ✅ Webview panel controller |
| `src/ui/investigation/investigation-panel-html.ts` | ✅ HTML for panel (with CSP, search options) |
| `src/ui/investigation/investigation-panel-styles.ts` | ✅ CSS for panel (context lines, progress, warnings) |
| `src/ui/investigation/investigation-panel-script.ts` | ✅ Webview script (search, history, options) |
| `src/ui/investigation/investigation-panel-handlers.ts` | ✅ Message handlers for panel |
| `src/ui/investigation/investigation-tree-provider.ts` | Pending: sidebar tree data provider |
| `src/modules/export/slc-bundle.ts` | Extend: investigation export/import, manifest v3 |
| `src/modules/bug-report/bug-report-collector.ts` | Extend: collect investigation context |
| `src/ui/panels/bug-report-panel.ts` | Extend: render investigation context section |
| `src/commands-session.ts` | Add investigation commands |
| `src/ui/session-panel.ts` | Add investigations group to tree |
| `package.json` | Add commands, menus, keybindings, settings |
| `l10n.ts` + bundles | Add localization strings |

**Test files:**

| File | Coverage |
|------|----------|
| `src/modules/investigation/investigation-store.test.ts` | CRUD, active state, limit enforcement, recovery |
| `src/modules/investigation/investigation-search.test.ts` | Search across logs/sidecars, cancellation, large files |
| `src/modules/export/slc-bundle-investigation.test.ts` | Export/import v3 bundles, manifest validation |

---

## Phases

### Phase 1: Core model and basic UI ✅ COMPLETE
- ✅ Investigation data model and store (with relative paths)
- ✅ Active investigation state management
- ✅ Create/delete/switch investigations
- ✅ Add/remove sources via commands
- ✅ Basic investigation webview panel showing pinned sources
- ✅ Basic cross-source search (included early)
- ⏭️ Investigations group in sidebar tree (deferred to Phase 4)

### Phase 2: Cross-source search ✅ COMPLETE
- ✅ Search implementation for logs and JSON sidecars
- ✅ Sidecar auto-resolution for session sources
- ✅ Cancellation support and progress reporting
- ✅ Search UI with options (case sensitive, regex, context lines)
- ✅ Search history (last 10 queries)
- ✅ Click result to navigate to file:line
- ✅ Context lines in results (before/after)
- ✅ Large file handling (>10MB warning badge)
- ✅ Missing source detection and warning badges

### Phase 3: Export and integration
- Manifest v3 with `type: 'investigation'`
- Investigation export as .slc bundle
- Investigation import (creates investigation from bundle)
- Update `isSlcManifestValid()` for v3
- Bug report integration with investigation context section

### Phase 4: UX polish
- Drag-and-drop to add sources
- Context menu integration everywhere
- Recent investigations list (last 5, stored in workspace state)
- "New Investigation from Selection" (bulk-add selected sessions)

---

## Considerations

- **Scope**: Investigation is workspace-scoped (not global)
- **Storage**: Use `.saropa/investigations.json` with relative paths for portability
- **Active state**: Store active investigation ID in workspace state (not file) — allows different users to have different active investigations
- **Orphaned sources**: If a pinned file is deleted, show "⚠️ Missing" badge and allow removal
- **Large investigations**: Cap at 20 sources per investigation to bound search time
- **Versioning**: Manifest v3 uses `type: 'investigation'`; v1/v2 import unchanged; v3 import creates investigation
- **Backward compatibility**: Old extension versions will fail gracefully on v3 bundles (invalid manifest)
- **Discovery**: Add "Create Investigation" button in session panel header + context menu
- **Recent list**: Store last 5 opened investigation IDs in workspace state; show in quick picker

---

## Limit Behavior

When limits are reached, show clear user feedback:

| Limit | Reached Behavior |
|-------|------------------|
| 50 investigations | Show error: "Maximum investigations reached. Delete an existing investigation to create a new one." |
| 20 sources per investigation | Show error: "Investigation has 20 sources (maximum). Remove a source to add another." |
| 10MB file during search | Show warning badge on source: "⚠️ Large file — searched first 10MB only" |

---

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Source file deleted/moved | Show "⚠️ Missing" badge; skip in search; allow manual removal |
| Source file locked/unreadable | Log warning; skip in search; show "⚠️ Unreadable" badge |
| `investigations.json` corrupt | Backup to `investigations.json.bak`; reset to empty; show notification with recovery option |
| `investigations.json` missing | Create empty file on first investigation create |
| Import fails mid-extraction | Clean up partial files; show error; do not create investigation |
| Search cancelled mid-flight | Stop immediately; show partial results with "Search cancelled" message |
| User modifies sources during search | Cancel ongoing search automatically; restart with new source list |

**Storage recovery:**

```typescript
async function loadInvestigations(): Promise<Investigation[]> {
    try {
        const content = await readFile(INVESTIGATIONS_PATH);
        return JSON.parse(content);
    } catch (e) {
        if (await fileExists(INVESTIGATIONS_PATH)) {
            await copyFile(INVESTIGATIONS_PATH, INVESTIGATIONS_BACKUP_PATH);
            logger.warn('Corrupt investigations.json backed up');
        }
        return [];
    }
}
```

---

## Keyboard Accessibility

| Shortcut | Action | Context |
|----------|--------|---------|
| `Ctrl+Shift+I` | Open/focus investigation panel | Global |
| `Ctrl+F` | Focus search input | Investigation panel |
| `Enter` | Execute search | Search input focused |
| `Escape` | Clear search / close panel | Investigation panel |
| `↑` / `↓` | Navigate search results | Results focused |
| `Enter` | Open file at selected result | Result focused |
| `Delete` | Remove selected source | Source focused |

Add `aria-label` attributes to all interactive elements for screen reader support.

---

## Success Criteria

1. User creates an investigation and pins 3 sessions
2. Search finds "timeout" across all pinned sessions
3. Clicking a search result opens the correct file at the correct line
4. Export produces a single .slc with all sources
5. Import recreates the investigation with all sources intact
