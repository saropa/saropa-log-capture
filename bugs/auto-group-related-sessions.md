# Auto-group related log files into a single "Session"

## Problem

When a debug run produces output across multiple capture targets — e.g. the
Flutter DAP (`dart`), ADB Logcat, Drift Advisor — each target writes its own
file. The Logs tree shows them as three separate entries per minute, even
though they are all pieces of the **same** user-facing session:

```
Tue, 21st Apr 2026
  📄 Contacts Drift Advisor   12:37 AM
  📄 Contacts Logcat          12:37 AM
  📈 Contacts (dart)          12:37 AM
  📄 Contacts Drift Advisor   12:36 AM
  📄 Contacts Logcat          12:36 AM
  📈 Contacts (dart)          12:36 AM
```

The user has to open each file individually, and collections can only pin
them as separate sources. There is no visual or functional representation
that these files belong together.

## Goal

Introduce a **Session Group**: a logical bundle of log files captured in the
same time window, grouped automatically, shown as a single parent node in the
Logs tree, openable as one merged view, and pinnable to a collection as one
unit.

## Non-goals

- Replacing the split-file `SplitGroup` concept (multi-part `_001.log`
  rotation). That stays. Session groups sit **above** split groups — a group
  can contain sessions that are themselves split.
- Retro-grouping the entire existing log history on first run. Grouping
  applies to new captures going forward; a one-shot "group existing history"
  command can follow as a separate task.
- Cross-workspace grouping. Groups are scoped to a single log directory.

## Terminology

| Term | Meaning |
|------|---------|
| **Session Group** / **Group** | A set of log files sharing a `groupId`, captured in the same time window. |
| **Anchor** | The event that establishes a group. Either a DAP debug-session start, or (standalone mode) the second integration provider firing inside the lookback window. |
| **Group member** | A log file whose `SessionMeta.groupId` matches the group's id. |
| **Primary member** | The one member that represents the group in compact views and provides the default label. See "Primary member" section below. |
| **Secondary member** | Any non-primary member. Rendered indented and visually tethered to the primary. |
| **Lookback window** | Seconds before the anchor during which pre-existing files with no `groupId` are claimed into the group. |
| **Idle timeout** | Seconds of silence after which a standalone group is considered closed (no more claims allowed). |

## Data model

Extend [`SessionMeta`](../src/modules/session/session-metadata.ts) with one
optional field:

```ts
export interface SessionMeta {
    // ...existing fields...
    /** Session group id (UUID). All files sharing this id are one logical session. */
    groupId?: string;
}
```

No new files. No new top-level store. The existing
`<logDir>/.session-metadata.json` continues to hold all metadata; grouping
becomes a query-time operation over that map.

A lightweight in-memory index (`Map<groupId, Set<relativePath>>`) is built on
metadata load for fast tree rendering. Rebuilt incrementally as files are
added, grouped, or ungrouped.

### Group descriptor (derived, not persisted)

```ts
interface SessionGroupDescriptor {
    readonly groupId: string;
    readonly members: readonly string[];   // relative paths, oldest first
    readonly earliestMtime: number;
    readonly latestMtime: number;
    readonly label: string;                // derived: e.g. "Contacts · 12:37 AM"
    readonly anchorType: 'debug' | 'standalone';
}
```

Derived from `SessionMeta` entries. Never written to disk.

## Grouping rules

### Anchored mode (DAP debug session present)

When a debug adapter session starts:

1. Mint a new `groupId` (UUID).
2. Claim pre-existing files: scan `.session-metadata.json` for files whose
   mtime is within `sessionGroupLookbackSeconds` of the debug session's start
   time AND have no existing `groupId`. Stamp them with the new `groupId`.
3. Stamp every log file created between debug-session start and stop with
   the same `groupId`.
4. On debug-session stop, the group is considered **closed**. No further
   claims.

The debug session is the unambiguous anchor. Start/stop events come from VS
Code's DAP lifecycle, so there is no heuristic guessing.

### Standalone mode (no debug session)

Triggered only when **≥2 distinct integration providers** produce output
within `sessionGroupLookbackSeconds` of each other. Single-provider activity
never forms a standalone group (prevents "everything-today-is-one-group"
drift).

1. Watch new log-file creation events. Key them by integration provider id
   (`driftAdvisor`, `adbLogcat`, future: `buildCi`, `windowsEvents`, etc.).
2. When a second distinct provider fires within the lookback window of an
   ungrouped file, mint a `groupId` and claim both files.
3. Further files from any provider that arrive before the **idle timeout**
   (`sessionGroupIdleSeconds`, default 60s of silence) get the same
   `groupId`.
4. When idle timeout elapses, the group is closed.

### "Not already part of another session"

A file with an existing `groupId` is never re-claimed. This is the
explicit rule the user called out. New groups can only consume ungrouped
files.

## Primary member

Every group has exactly one primary. The primary provides the group's
default label, its single-line collapsed representation, and the file
that opens if the user chooses "Open primary only" instead of the merged
view.

**Rule (pure derivation, not persisted):**

1. If any member has `SessionMeta.debugAdapterType` set (i.e. it came from
   a DAP debug session), **that member is primary**. The debug-session
   file carries the app's own logs, stack traces, and the `[log]` stream
   the developer wrote themselves — it's the canonical record. Logcat and
   Drift Advisor are ambient observers.
2. If more than one member has `debugAdapterType` set (edge case: nested
   or back-to-back debug sessions joined into one group), pick the one
   with the **earliest mtime**.
3. If no member has `debugAdapterType` (standalone group — Drift Advisor
   + Logcat with no DAP), the **earliest-mtime member is primary**.

Rationale for deriving vs persisting an `isPrimary` flag: the rule is a
pure function of existing fields. A persisted flag would drift if a user
later added a DAP file to the group via manual grouping, or ungrouped
and re-grouped in a different order. Derivation always reflects truth.

Helper: `getPrimaryMember(members: SessionMeta[]): SessionMeta` —
pure function, exhaustively tested.

## Settings

Add to [`package.json`](../package.json) and
[`config-types.ts`](../src/modules/config/config-types.ts):

| Key | Type | Default | Meaning |
|-----|------|---------|---------|
| `saropaLogCapture.sessionGroups.enabled` | boolean | `true` | Master switch. |
| `saropaLogCapture.sessionGroups.lookbackSeconds` | number | `20` | Claim files created this many seconds before the anchor. |
| `saropaLogCapture.sessionGroups.idleSeconds` | number | `60` | Close a standalone group after this much silence. |
| `saropaLogCapture.sessionGroups.standaloneEnabled` | boolean | `true` | Allow standalone (non-DAP) grouping. |

Settings read fresh on each use per project typescript rules.

## Logs panel visual treatment

The Logs panel is a **webview** (`saropaLogCapture.logViewer`,
[`log-viewer-provider.ts`](../src/ui/provider/log-viewer-provider.ts)), not
a native VS Code tree. We have full CSS control — no unicode box-drawing
fallbacks needed.

### Data pass

Modify [`session-history-grouping.ts`](../src/ui/session/session-history-grouping.ts)
and [`session-history-provider.ts`](../src/ui/session/session-history-provider.ts):

1. Extend the `TreeItem` union:
   ```ts
   type TreeItem = SessionMetadata | SplitGroup | SessionGroup;
   ```
2. After `groupSplitFiles()`, run a second pass `groupSessionGroups()` that
   coalesces items sharing a `groupId`. Output: a flat list where each
   group's members appear consecutively, primary first, secondaries after,
   all carrying a shared `groupId` and a `isPrimary: boolean` flag on their
   render model.
3. Every rendered row gets `data-group-id="<uuid>"` and
   `data-group-role="primary"` or `"secondary"` attributes in the HTML.

### Rendering

**Primary row** — renders exactly like an ungrouped session today. Same
icon, same label, same hover. No visual regression for users who do not
hit the auto-group heuristic.

**Secondary rows** — three changes:

1. **Indent**: `padding-left: 16px` added beyond the primary's indent.
   Implemented via a `.group-secondary` class, not inline style, so the
   indent amount lives in one place.
2. **Tether rule**: a `1px` left border in a muted foreground colour
   (use `var(--vscode-tree-inactiveIndentGuideStroke)` for native-feeling
   consistency), starting flush with the primary's icon column and running
   down through all secondaries in the group. Implemented by setting a
   `border-left` on each secondary and absolute-positioning it; no SVG or
   canvas work.
3. **Reduced label emphasis**: secondaries render their source tag
   (`Drift Advisor`, `Logcat`) in `var(--vscode-descriptionForeground)`
   instead of the primary foreground, to reinforce that they are children
   of the primary above.

### Shared hover

Current behaviour: hover over a row → row gets
`background: var(--vscode-list-hoverBackground)`.

New behaviour: hover over **any** row belonging to a group → the hovered
row gets the standard hover background, **and** every other row sharing
the same `data-group-id` gets a **dimmer** background
(`var(--vscode-list-inactiveSelectionBackground)` with reduced opacity, or
a custom CSS variable we introduce for exactly this purpose:
`--saropa-group-coHover-background`).

Implementation approaches — pick the simpler one:

- **CSS-only (preferred):** a container element per group (`<div
  class="session-group" data-group-id="...">`) wraps the primary and its
  secondaries. `.session-group:hover .group-row` applies the dim bg;
  `.group-row:hover` overrides with the stronger hover bg for the exact
  row under the cursor. No JS event handlers required.
- **JS-driven fallback:** if the group must stay a flat sibling list (for
  keyboard nav or selection reasons), add `mouseenter`/`mouseleave`
  handlers that add/remove a `.group-co-hover` class on siblings sharing
  the same `data-group-id`.

Default to CSS-only. Switch to JS only if the flat-sibling requirement
surfaces during implementation.

### Group header (collapsed state)

When a group is **collapsed**, only the primary shows, with two additions
to its row:

- A **chevron** on the leading edge: `▸` when collapsed, `▾` when expanded.
  Filled (not outline) to match the existing date-header chevron style —
  visual consistency is explicit.
- A **count suffix** in the label: `"Contacts (dart) +2"` meaning primary
  plus two secondaries.

Click/tap the chevron to toggle expand state; click the row itself to
open the merged viewer. Expand state persists per-group in workspace
state (`workspaceState.update('groupExpand:<groupId>', boolean)`).

### Badge counts when collapsed vs expanded

Every row in the Logs list shows severity badges today (the coloured-dot
error/warning/perf counts). For groups:

- **Collapsed:** the primary's badge shows **summed totals across every
  member** — e.g. the dart session's 5056 errors + the Logcat's 25 errors
  render as one `5081` on the primary row. Rationale: the collapsed row
  stands for the whole group, so its badge must reflect the whole group.
  Showing only the primary's counts would under-report and hide the fact
  that secondaries carry severity the user cares about.
- **Expanded:** every row shows its own per-file counts, exactly as
  ungrouped rows do today. The primary reverts to its own counts; each
  secondary shows its own. No double-counting.

The toggle is driven by the same expand state used for the chevron, so
there is one source of truth for group visual state.

Ungrouped singleton entries render exactly as today. No regression for the
existing single-target case.

## Commands

Add to [`package.json`](../package.json) and register in
[`commands.ts`](../src/commands.ts):

| Command id | Title | Where shown |
|------------|-------|-------------|
| `saropaLogCapture.openSessionGroup` | Open Session Group | Group header context menu + default click |
| `saropaLogCapture.ungroupSession` | Ungroup Session | Group header context menu |
| `saropaLogCapture.addGroupToCollection` | Add Group to Collection | Group header context menu + viewer collections panel |
| `saropaLogCapture.groupSelectedSessions` | Group Selected Sessions | Multi-select on individual session entries (manual grouping) |

Manual grouping is the escape hatch when auto-grouping misses a case.

## Viewer: merged multi-file view

Currently `LogViewerProvider` holds one `currentFileUri`. Extend it to hold
`currentFileUris: readonly vscode.Uri[]` with the existing single-file path
being the length-1 case. Changes:

- `loadFromFiles(uris: readonly vscode.Uri[])` — new method alongside
  existing `loadFromFile(uri)`.
- Load order: sort by mtime ascending; stream all files in order;
  **prefix each line with a source tag** (`[dart]`, `[logcat]`, `[drift]`)
  so the existing source-tag filter works out of the box.
- Title bar: show group label, member count, and a filter chip per source
  so users can toggle individual targets on/off without losing the merged
  view.

File: [`log-viewer-provider.ts`](../src/ui/provider/log-viewer-provider.ts)
and its load helpers.

## Ungroup behavior

Invoked from the group header:

1. Clear `groupId` from every member's `SessionMeta`.
2. Rebuild the in-memory group index.
3. Fire tree refresh — members collapse back to individual entries.
4. **Collection fan-out**: if any collection contains this group as a
   `type: 'group'` source, auto-convert that entry into N `type: 'file'`
   sources (one per former member, preserving their labels). Notify the user
   via an information message listing affected collections so they can audit.

Undo: not in scope for this iteration. Users can re-group manually via
`groupSelectedSessions`.

## Collections integration

Extend [`CollectionSource`](../src/modules/collection/collection-types.ts):

```ts
export interface CollectionSource {
    readonly type: 'session' | 'file' | 'group';
    readonly relativePath?: string;   // required for 'session' | 'file'
    readonly groupId?: string;        // required for 'group'
    readonly label: string;
    readonly pinnedAt: number;
}
```

Resolution helper: `resolveCollectionSources(sources)` expands any `group`
entries into the underlying file list at query time, looking up current
members via the in-memory group index. Dynamic expansion — if files are
added or removed from a group after pinning (rare, but possible via manual
group / ungroup), the collection reflects the current state.

Touch points:

- [`collection-search.ts`](../src/modules/collection/collection-search.ts) —
  expand groups before iterating sources.
- [`collection-search-file.ts`](../src/modules/collection/collection-search-file.ts)
  — unchanged; operates on resolved file list.
- [`slc-collection.ts`](../src/modules/export/slc-collection.ts) — expand
  groups before bundling.
- `MAX_SOURCES_PER_COLLECTION` — a group counts as **one** source for the
  cap, even if it expands to many files. Prevents the cap from blocking
  legitimate multi-target sessions.

## Retention interaction

[`file-retention.ts`](../src/modules/retention/file-retention.ts) (or equivalent)
must become group-aware:

- When retention targets a file for deletion, look up its `groupId`.
- If `groupId` exists AND the group is **closed** (DAP stopped OR idle timeout
  elapsed), delete the whole group atomically.
- If the group is **open** (still being written to), skip retention on
  any of its members until it closes.
- Ungrouped files fall back to the current per-file retention rule.

This prevents the retention sweep from deleting, say, the Drift Advisor half
of a session while leaving the Logcat half in place.

## Files touched (estimate)

Core:
- [src/modules/session/session-metadata.ts](../src/modules/session/session-metadata.ts) — add `groupId` field
- [src/modules/session/session-groups.ts](../src/modules/session/session-groups.ts) — **new** — group index, claim rules, anchor tracking
- [src/modules/config/config-types.ts](../src/modules/config/config-types.ts) — new settings
- [src/modules/config/config.ts](../src/modules/config/config.ts) — new readers
- [package.json](../package.json) — settings declarations + commands + menus

Session lifecycle:
- [src/modules/session/session-manager.ts](../src/modules/session/session-manager.ts) — hook into DAP start/stop to anchor groups
- [src/modules/integrations/](../src/modules/integrations/) — notify group tracker on integration-provider file creation

Tree:
- [src/ui/session/session-history-grouping.ts](../src/ui/session/session-history-grouping.ts) — add `groupSessionGroups()` pass
- [src/ui/session/session-history-provider.ts](../src/ui/session/session-history-provider.ts) — render group nodes

Viewer:
- [src/ui/provider/log-viewer-provider.ts](../src/ui/provider/log-viewer-provider.ts) — multi-file load
- [src/ui/provider/viewer-handler-sessions.ts](../src/ui/provider/viewer-handler-sessions.ts) — message handler for group loads

Commands:
- [src/commands.ts](../src/commands.ts) — register group commands
- [src/commands-collection.ts](../src/commands-collection.ts) — `addGroupToCollection`

Collections:
- [src/modules/collection/collection-types.ts](../src/modules/collection/collection-types.ts) — extend `CollectionSource`
- [src/modules/collection/collection-search.ts](../src/modules/collection/collection-search.ts) — group resolver
- [src/modules/export/slc-collection.ts](../src/modules/export/slc-collection.ts) — group resolver in bundler

Retention:
- whichever module owns the retention sweep — add group-closed check

Tests:
- `src/test/modules/session/session-groups.test.ts` — claim rules, lookback, idle timeout, ≥2-provider requirement
- `src/test/modules/collection/collection-source-group.test.ts` — group pin, expansion, ungroup fan-out
- `src/test/ui/session-history-grouping.test.ts` — add session-group coalescing cases

Docs:
- [CHANGELOG.md](../CHANGELOG.md) — Unreleased entry
- [README.md](../README.md) — brief Session Groups section
- [ROADMAP.md](../ROADMAP.md) — check off

## Risk and complexity

| Area | Complexity | Risk |
|------|------------|------|
| DAP-anchored grouping | Low | Low — DAP events are reliable |
| Standalone grouping | Medium | Medium — heuristic; ≥2-provider gate and idle timeout bound the blast radius |
| Multi-file merged viewer | Medium | Medium — source-tag prefix and existing filters mitigate, but large groups may stress memory |
| Collection group resolution | Low | Low |
| Retention group-awareness | Low | **High if wrong** — could delete more than intended. Unit-test the closed-vs-open gate hard. |
| Ungroup → collection fan-out | Low | Low — additive, user gets an info message |

## Resolved design decisions

1. **Collapsed label format**: `"Contacts (dart) +2"`. Primary label
   followed by `+N` where N is the secondary count.
2. **Group indicator glyph**: a filled chevron on the leading edge of the
   primary row — `▸` collapsed, `▾` expanded. Filled style (not outline)
   for consistency with the existing date-header chevron. The chevron
   flips with state; the style does not change.
3. **Severity badges when collapsed**: summed totals across every member
   render on the collapsed primary row. When expanded, every row reverts
   to its own per-file counts.
4. **Manual-grouping multi-select**: ctrl-click (cmd-click on macOS) to
   toggle row selection in the webview Logs panel. Shift-click for range
   selection follows the same VS Code tree convention by default.

All design questions are resolved. Implementation can proceed against this
plan.
