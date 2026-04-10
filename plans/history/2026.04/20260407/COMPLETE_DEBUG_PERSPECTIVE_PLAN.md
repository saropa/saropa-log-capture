# Plan: Complete Debug Perspective with Manageable Filters

**Status: COMPLETE (archived 2026-04-07).** All four phases implemented and verified.

---

## Goal

Bring in the **complete perspective** of what is happening in the project during a debug session (DAP Debug Console, terminal, external log files, and optionally other sources), while giving users clear ways to **manage overwhelm** via **noise filters** and **source filters**—e.g. “just show me the debug output.”

---

## 1. What “complete perspective” means

Today the extension captures only **DAP Debug Console** output. During a typical debug run, other things are also happening:

| Source | Current state | Content |
|--------|----------------|---------|
| **Debug Console (DAP)** | Captured to main `.log` | stdout/stderr/console from debug adapter(s); Flutter/Dart parent+child merged into one file |
| **Integrated Terminal** | Sidecar only (`basename.terminal.log`) at session end | Shell output, npm scripts, build output, commands run during debug |
| **External log files** | Implemented (tail + sidecars + viewer `external:<label>`) | `logs/app.log`, nginx, IIS, etc. |
| **Other output channels** | Not in scope for v1 | Extension host, tasks; optional later |

**Complete perspective** = the user can see, in one place (or one coherent workflow), everything that was produced during the session: debug adapter output, terminal, and any tailed external logs.

**Live vs session-end for terminal (and external sidecars):** DAP streams into the main log during the session. Terminal capture is buffered and written to `basename.terminal.log` (and external tails to their sidecars) when the session ends—so merged “terminal + debug” in the viewer reflects the full terminal transcript only after capture completes, not as a live interleaved stream mid-session.

**Chosen model: Unified view.** One viewer shows one scroll/list; the user picks which sources are visible via a **source filter** (e.g. “Just debug”, “Debug + terminal”, “All”). When multiple sources are selected, lines are merged in one timeline with source badges per line. (Multi-tab per source was considered; we use a single list with source filter instead.) A stable **stream source** id per line is required so the UI can filter by it.

---

## 2. Managing overwhelm: filters

Users need to reduce noise without losing the ability to see the full picture when they want it.

### 2.1 Source filter (new)

- **“Just show me the debug output”** — Show only lines from the DAP Debug Console (current default behavior when only DAP is captured).
- **“Just terminal”** — When terminal (and/or external logs) are present, show only that source.
- **“Debug + terminal”** — Show DAP and terminal; hide external logs.
- **“All sources”** — Show everything (complete perspective).

Implementation: every line has a **source id** (e.g. `debug` | `terminal` | `external:app.log`). Viewer filter adds a **Source** section with **checkboxes**—one per source (“Debug”, “Terminal”, “app.log”, …) plus “All” (select all)—so the user picks which sources are visible. Quick Filter presets can include **source** (e.g. preset “Just debug” = source = debug only).

### 2.2 Existing noise filters (unchanged, apply within selected sources)

- **Quick Filters (presets)** — e.g. “Errors Only”, “Warnings & Errors”, “No Framework Noise” (app-only). Extend presets to optionally store **source** so “Just debug output” can be a one-click preset.
- **Output Channels (DAP categories)** — stdout, stderr, console, etc.; only relevant when “debug” source is shown.
- **Exclusions** — Regex/pattern hide. **v1:** Apply exclusions to **all currently visible sources** (same patterns across debug, terminal, and external lines). Per-source exclusion rules are a later enhancement if needed.
- **App only** — Hide framework/system DAP output; only for debug source.
- **Level filter** — Error, warning, info, etc.; applies only to lines with a **parsed level**. **Unclassified lines** (typical for raw terminal or unstructured external logs) **do not match** a strict level bucket: for presets such as **“Errors only”**, treat them as **not errors** and **hide** them (so multi-source “errors only” shows error-classified debug lines, not the whole terminal). If the product later adds heuristics or a “include unclassified” toggle, that becomes an explicit extension.
- **Search** — Full-text/regex; applies across visible sources.

So: **Source** is the top-level “which streams do I see?”; then within those streams, existing category/level/exclusion/search filters reduce noise.

### 2.3 Built-in presets to add

- **“Just debug output”** — Source = debug only; optional: exclusions off, app-only off (or match current “Full” behavior). One-click way to get back to “only what the debug adapter printed.”
- **“Complete (all sources)”** — Source = all; useful when user has enabled terminal + external logs and wants to see everything.
- Keep existing: “Errors Only”, “Warnings & Errors”, “No Framework Noise”.

---

## 3. Data model and storage

### 3.1 Source id

Introduce a stable **source id** for every line:

- **`debug`** — DAP output (current main log). No change to how lines are written; they are implicitly `debug`.
- **`terminal`** — Integrated Terminal (currently sidecar; see below).
- **`external:<label>`** — Tailed file, e.g. `external:app.log`, `external:nginx`. Label = sanitized name from config.
- **`browser`** — Browser DevTools (CDP) sidecar (`basename.browser.json`). Added during implementation but not in the original plan.

**Label uniqueness:** Config validation (or auto-suffixing, e.g. `app.log`, `app.log_2`) must ensure two external tails never map to the same `external:<label>` so source ids, presets, and badges stay stable.

### 3.2 Storage options

**Option A — Single merged log with source prefix**

- Main log file contains all sources; each line is prefixed or tagged with source (e.g. `[debug]`, `[terminal]`, `[app.log]`) so the viewer can filter by source.
- Pros: One file, one timeline, simple “open one file” mental model.  
- Cons: Log format change; need to parse source on load; terminal/external currently written at session end (would need to stream into main log).

**Option B — Separate files, unified viewer** ✓ *chosen*

- Main log = DAP only (unchanged). Terminal → `basename.terminal.log`. External → `basename_<label>.log` or sidecar.
- Viewer opens “session” = main log + list of sidecars; one content area (unified view) with **source filter** (checkboxes). When multiple sources are selected, merge in memory using the **merge ordering** rules below and show one scroll with source badges per line.
- Pros: No change to main log format; reuses existing sidecar pattern.
- Cons: “All sources” view requires loading multiple files and merging.

**Option C — Hybrid** (Phase 4: implemented, opt-in)

- Keep main log DAP-only and sidecars as in Option B. When `integrations.unifiedLog.writeAtSessionEnd` is true, write **`basename.unified.jsonl`** at session end: one JSON object per line `{ "source": "debug"|"terminal"|"external:label", "text": "..." }`; viewer opens that file and applies the same **Sources** filter.
- Pros: One file for “everything” when needed; export/sharing.  
- Cons: Duplication; one more file to maintain.

**Decision:** **Option B** is the primary model; **Option C** is an optional artifact (`maxLinesPerSource` caps each stream when writing).

### 3.3 Line format for sidecars (when used in merged view)

When viewer merges multiple sources, each line needs a source id. For sidecars we can:

- **Terminal:** Lines in `basename.terminal.log` have no prefix; viewer assigns source id `terminal` when loading.
- **External:** Lines may have optional prefix (e.g. `[app.log] `); viewer assigns source id from filename or config.  
So no change to sidecar file format required; source is derived from which file the line came from.

### 3.4 Merge ordering (Option B: multi-file session in viewer)

When merging lines from main log + sidecars into a single list:

1. **Primary:** If a line has a **parsed timestamp** (from the log line or sidecar metadata), use it for ordering.
2. **Tie-breaker / missing comparable time:** Preserve **within-file order** (line index). When timestamps are equal or cannot be compared across files, order sources deterministically: **`debug`**, then **`terminal`**, then **`external:<label>`** sorted lexicographically by label.
3. **Received-at:** If the loader assigns a per-line **received-at** (or capture) time at ingest, use it like a parsed timestamp in (1).

Optional **Phase 4** improvement: richer interleaving for `.unified.jsonl` when timestamps are normalized in the artifact (see summary follow-ups).

---

## 4. Viewer changes

### 4.1 Source filter UI

- **Location:** Filters panel (right slide-out) or toolbar: new **Source** section.
- **Control:** Checkboxes. Show the **Source** section when the loaded session exposes **more than one source type** (e.g. debug + terminal, debug + external, or a single **`.unified.jsonl`** that contains multiple `source` values). If the session is **debug-only** (main log alone, or one file whose lines are all `debug`) → omit or collapse the Source UI (everything is debug). If main + terminal and/or external sidecars exist—or unified JSONL with multiple sources—show checkboxes: “Debug”, “Terminal”, “app.log”, … (one per external), plus “All” (select all). User can select any combination of sources; unified view shows one merged list for the selected sources.
- **Persistence:** Remember last source selection per workspace or per log (e.g. in viewer state); presets can include source.

### 4.2 Quick Filter presets extended

- Add optional **`sources?: string[]`** to `FilterPreset` (e.g. `['debug']` for “Just debug output”).  
- When a preset is applied, set active source filter to preset’s sources (if present).  
- Built-in preset **“Just debug output”**: `sources: ['debug']`, no other constraints (or match “Full” behavior).

### 4.3 “Noise” wording

- Keep existing **Noise Reduction** section: exclusions, app-only. Optionally rename or add hint: “Reduce noise within the selected source(s).”
- No new “noise” concept beyond: (1) source filter = which streams, (2) existing filters = what to hide within those streams.

---

## 5. Capture pipeline (minimal for “complete perspective”)

- **DAP:** No change; already writes to main log (implicit source `debug`).
- **Terminal:** Already captured to buffer; written to sidecar at session end. For Option B, no change; viewer just treats sidecar as second source.
- **External logs:** Per application-file-logs plan: tail during session; write sidecars at end. Each sidecar is one source.
- **Unified file (Phase 4):** Post-step at session end: read main log + terminal sidecar + external sidecars, emit merged stream with source tags to **`basename.unified.jsonl`** (JSONL: one object per line with `source` and `text`, as in Option C). Viewer opens this file and applies the same Sources filter as for multi-file sessions.

For Option B, no merge at capture time; merging is viewer-only when multiple sources are selected. The unified file (Phase 4) provides an optional single-file artifact.

---

## 6. Phasing

| Phase | Scope | Deliverables |
|-------|--------|--------------|
| **1. Source in viewer** | Add source as a filter dimension when the session has **multiple source types** (main + terminal sidecar; + external; or `.unified.jsonl` with multiple sources). Unified view: one list, source filter (checkboxes). “Just debug” = only main log content. | Source filter UI (checkboxes); load sidecars when opening a log; merge view when multiple sources selected; merge ordering per §3.4; presets can include `sources`. |
| **2. “Just debug” preset** | Built-in preset “Just debug output” and ensure it’s discoverable (e.g. in Quick Filters dropdown). | `builtInPresets` + “Just debug output”; optional “Complete (all sources)” preset. |
| **3. External logs** | Implement application-file-logs (tailing, sidecars). Each external file becomes a source in the viewer. | External log tailing; sidecars; Source filter shows Debug | Terminal | app.log | … |
| **4. Unified file** | Optional `basename.unified.jsonl` at session end; viewer opens it with Sources filter. | `integrations.unifiedLog.*`; `unified-session-log-writer.ts`; viewer JSONL load path. |

---

## 7. Summary

- **Complete perspective** = DAP + terminal + external logs in one place: **unified view** (one list, merged by source selection, with source badges).
- **Manage overwhelm** = **Source filter** (checkboxes: Debug, Terminal, externals, “All”) plus existing **noise filters** (presets, exclusions, app-only, categories, levels, search). **Exclusions (v1):** apply to all visible sources. **Level filter:** unclassified lines are hidden under strict level presets (e.g. “Errors only”). **“Just debug output”** preset and presets with optional **sources**.
- **Timing:** DAP is live in the main log; terminal/external sidecars are complete after **session end** (§1)—not a live interleaved terminal stream mid-session.
- **Storage:** **Option B** — separate files (main log DAP-only; terminal and external as sidecars); viewer merges in memory. **Option C (opt-in):** `basename.unified.jsonl` written at session end when `integrations.unifiedLog.writeAtSessionEnd` is true.
- **Data model:** **Source id** per line (debug | terminal | external:label). Viewer derives source from which file the line came from (or from JSONL `source`); **labels unique**; filtering by source via checkboxes. **Merge:** §3.4 when multiple files are combined.
- **No breaking change** to main log format; all new behavior is additive (sidecars, viewer source filter, presets, optional unified file).

### Considered and dropped follow-ups

- **Interleave unified lines by parsed timestamps** — The `.unified.jsonl` writer (`unified-session-log-writer.ts`) emits lines in source blocks (all debug, then terminal, then externals) rather than chronologically interleaved. This is harmless because the viewer already merges and sorts in memory from sidecars (§3.4). Sorting the file itself would add complexity for no functional gain.
- **Timeline support for `.unified.jsonl`** — The timeline panel loads events from individual sidecars. Loading from `.unified.jsonl` would only matter if someone had the unified artifact without the original sidecars. Not a real use case today.
