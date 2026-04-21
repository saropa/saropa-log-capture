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

### Time windows

Auto-grouping uses **three windows** around the DAP debug session's
lifetime:

```
       before           during           after
  [ -N sec .. start ]  [ start .. end ]  [ end .. +N sec ]
           \_______________|_______________/
                    one session group
```

- **Before window** — `beforeSeconds` (default 10). Files with mtime
  inside this range and no existing `groupId` are claimed at DAP start.
  Catches sidecars that integration providers write a few seconds
  ahead of the DAP session firing.
- **During window** — no setting. Every log file written between DAP
  start and DAP end is eligible. The immediate end-sweep picks these
  up.
- **After window** — `afterSeconds` (default 10). Keeps the group open
  for this long after the DAP session ends. Catches late-flushed
  sidecars like `adb-logcat.ts:onSessionEnd`'s `.logcat.log`. Implemented
  as a `setTimeout` that runs one final sweep then releases the group.

### Anchored mode (DAP debug session present)

When a debug adapter session starts:

1. Mint a new `groupId` (UUID).
2. **Before-sweep:** scan the log directory, stamp every file whose
   mtime ≥ `startMs - beforeSeconds * 1000` AND has no existing `groupId`.
3. Store the active anchor `{ groupId, startMs }` so late-registered
   commands (ungroup, manual group) can see which group is live.
4. On DAP end, run an **immediate end-sweep** to claim any during-session
   file the before-sweep missed (typically none, but defends against
   slow sidecar flushes).
5. Schedule a **delayed end-sweep** for `endMs + afterSeconds * 1000`.
   The delayed sweep uses an upper-bound on mtime (`endMs + afterSeconds *
   1000`) so files written deep into a later session cannot be
   mis-claimed by this group.
6. After the delayed sweep runs, clear the active anchor. The group is
   now **closed** — no further automatic claims.

### Standalone mode (no debug session)

Not wired in this iteration. Currently every integration provider only
fires inside a DAP session, so a "Drift Advisor + Logcat with no DAP"
scenario cannot occur via the built-in providers. When an external
extension starts its own `saropa-log-capture` session through the public
API, the standalone trigger can be added without changing the data
model.

### "Not already part of another session" — first-claim-wins

A file with an existing `groupId` is **never re-claimed automatically**.
This is the conflict-resolution rule:

- When DAP session A ends and session B starts within A's after-window,
  both trackers' sweeps can target the same mtime range. VS Code
  serialises DAP events, so A's immediate end-sweep runs before B's
  before-sweep. A claims everything it can see; B's before-sweep then
  finds those files stamped with A's `groupId` and skips them. B's
  window still covers files A's sweep couldn't see (e.g. created after
  A's immediate sweep ran), so B catches the truly new ones.
- A's **delayed** end-sweep runs later (at `A.endMs + A.afterSeconds`).
  Its upper-bound on mtime prevents it from stealing files written deep
  into B's session. Only files written in A's true after-window that
  B's before-sweep didn't already claim are stamped for A.
- **Net result:** files near the boundary belong to whichever session
  sweep ran first. Unambiguous; easy to reason about; easy to reproduce
  in tests.

Users who disagree with an auto-assignment use **manual group** or
**ungroup** (see below) to move files explicitly.

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

Just three user-facing keys. Everything else is derived:

| Key | Type | Default | Meaning |
|-----|------|---------|---------|
| `saropaLogCapture.sessionGroups.enabled` | boolean | `true` | Master switch. When `false`, every log file stands alone exactly as it did before this feature existed. |
| `saropaLogCapture.sessionGroups.beforeSeconds` | number | `10` | Claim ungrouped files whose last-write time is within this many seconds BEFORE the debug session starts. Range 0..600. |
| `saropaLogCapture.sessionGroups.afterSeconds` | number | `10` | After the debug session ends, keep the group open for this many seconds and claim any late-written file that appears in that window. Range 0..600. |

Settings read fresh on each use. Users can retune mid-session without a
reload.

### Settings dropped vs. earlier draft

- `lookbackSeconds` → **renamed** to `beforeSeconds`. Default lowered from
  20s to 10s (tighter default, less chance of false-joins).
- `idleSeconds` → **removed**. Was for standalone-mode timeout; replaced
  by the explicit `afterSeconds` window.
- `standaloneEnabled` → **removed**. Standalone-mode isn't wired (see
  "Standalone mode" above); flipping a flag does nothing useful. Will be
  reintroduced if/when standalone paths exist.

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

## Manual group (user override)

The auto-grouping rule is a heuristic. When it gets something wrong —
misses a sidecar, joins two unrelated captures, or users just want a
different grouping — they run **Group Selected Sessions** on a multi-
selection:

1. User selects ≥1 log rows in the Logs list (ctrl-click toggle,
   shift-click range).
2. Right-click → **Group Selected Sessions** (also available from the
   command palette as `saropaLogCapture.groupSelectedSessions`).
3. The command:
   a. **Clears any existing `groupId`** from every selected file
      (overrides the first-claim-wins rule — user intent trumps the
      heuristic).
   b. Mints a new `groupId`.
   c. Stamps every selected file with the new id in one batch write.
4. **Orphan cleanup**: if clearing a file's old `groupId` left the old
   group with fewer than 2 members, the old group effectively
   disappears — `buildGroupIndex()` already skips singletons.
5. **Collection fan-out** (same as ungroup, see below): any collection
   that referenced the old group as `type: 'group'` is auto-converted
   to individual `type: 'file'` sources.

Single-file "manual group" is allowed but creates a singleton (skipped
by `buildGroupIndex`), so effectively it just clears the file's `groupId`.

## Ungroup behavior

Invoked from a group header or any file that currently belongs to a
group:

1. Look up the target's `groupId`. If absent, no-op.
2. Read all members of that `groupId` from the metadata map.
3. Clear `groupId` from every member's `SessionMeta` in one batch write.
4. Rebuild the in-memory group index.
5. Fire tree refresh — members collapse back to individual entries.
6. **Collection fan-out**: if any collection contains this group as a
   `type: 'group'` source, auto-convert that entry into N `type: 'file'`
   sources (one per former member, preserving their labels). Notify the
   user via an information message listing affected collections.

Undo: not in scope for this iteration. Users can re-group manually via
**Group Selected Sessions**.

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
