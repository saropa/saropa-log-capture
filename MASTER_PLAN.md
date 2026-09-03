# MASTER PLAN — Saropa Log Capture

Comprehensive work schedule derived from the 2026-09-02 usability review.
Bug reports in `bugs/bug_NNN_*.md`. Plans in `plans/`.

**Version under review:** 9.3.12 · 120 commands · 272 settings · 4 MB dist

---

## P0 — Critical: fix before next release

These bugs cause data loss, security exposure, or broken core flows. 9 bugs,
estimated 3–5 days total.

### Security (fix first)

| Bug | Issue | Effort |
|-----|-------|--------|
| 002 | Workspace settings exfiltrate user data to shared `.vscode/settings.json` | 2h |
| 003 | Bug report AI prompt leaks log content without consent | 2h |
| 019 | AI features auto-enabled without user consent | 1h |

### Broken first-run experience

| Bug | Issue | Effort |
|-----|-------|--------|
| 001 | Walkthrough markdown missing from VSIX (broken since v3.10.0) | 2h |
| 004 | Walkthrough auto-opens and blocks with a modal on every activation | 2h |
| 005 | `explainError` command registered in package.json but never implemented | 1h |
| 006 | 7 commands unreachable — require treeview selection, no palette path | 2h |

### Data integrity

| Bug | Issue | Effort |
|-----|-------|--------|
| 007 | Viewer line-index mismatch + 5,000-line scanner cap truncates analysis | 4h |
| 008 | Crashlytics OAuth scope wrong — silent 403, panel shows empty | 2h |
| 009 | Bug report variants ship empty (variant sections have no content) | 3h |

---

## P1 — High: broken features, data loss risks

17 bugs, estimated 5–8 days total. Fix after P0, before new features.

### Capture pipeline

| Bug | Issue | Effort |
|-----|-------|--------|
| 010 | Logcat lines bypass live viewer (only appear on file reopen) | 3h |
| 011 | Pause drops lines inconsistently (race between pause flag and buffer) | 3h |
| 012 | File retention `maxLogFiles` never deletes old files | 2h |
| 046 | Screenshot sidecars survive log deletion — unbounded disk growth | 2h |
| 022 | `allLines` array rescanned every batch — O(n²) on large logs | 2h |

**Sequence 046 with or before 012.** Fixing retention first makes 012 start
deleting logs, which turns 046 from a static leak into a growing one.

### Command UX

| Bug | Issue | Effort |
|-----|-------|--------|
| 013 | 8+ palette commands silently no-op (no active session / no viewer) | 2h |
| 014 | Comparison commands unreachable — require 2+ sessions, no guidance | 2h |
| 015 | Webview messages dropped when view not resolved | 2h |
| 017 | `resetAllSettings` fails without a workspace folder | 1h |
| 021 | `deleteOriginals` defaults to true — destructive on first use | 1h |

### Viewer / analysis integrity

| Bug | Issue | Effort |
|-----|-------|--------|
| 016 | `deleteSession` orphans metadata (index entry, annotations, bookmarks) | 2h |
| 018 | Vitals panel `setInterval` not cleared on dispose | 1h |
| 020 | Directory scan errors swallowed — user sees empty panel, no explanation | 1h |
| 023 | Analysis panel hardcodes `classifyLevel` — ignores user's level config | 2h |
| 024 | Learning pattern can hide ALL output if regex matches common prefix | 2h |

---

## P2 — Medium: correctness, polish, UX gaps

20 bugs, estimated 6–10 days total. Interleave with wow features.

### Viewer correctness

| Bug | Issue | Effort |
|-----|-------|--------|
| 025 | Viewer trim drifts pins/annotations/badges/selection indices | 4h |
| 026 | Goto-line number mismatch (viewer vs raw file) | 2h |
| 027 | Annotation DOM height unmeasured — overlaps adjacent rows | 2h |
| 028 | Stack headers ignore active filters (visible when children hidden) | 2h |
| 032 | Deduplication documented but bypassed in current code | 2h |

### Export / reports

| Bug | Issue | Effort |
|-----|-------|--------|
| 033 | Export timestamps mislabeled as UTC (actually local) | 1h |
| 041 | Bug report pipeline issues (Flutter red-box, blocking notification) | 3h |

### Signals / analysis accuracy

| Bug | Issue | Effort |
|-----|-------|--------|
| 030 | Signal false positives (resolved, silence-burst, ANR cache) | 3h |
| 031 | Signal report issues (wrong counts, missing context) | 2h |

### Session / workspace

| Bug | Issue | Effort |
|-----|-------|--------|
| 034 | Multi-root workspace session contamination | 3h |
| 036 | Report panel clicks evict session log data from memory | 2h |
| 040 | Stop-queue drain races logcat teardown | 2h |

### UX polish

| Bug | Issue | Effort |
|-----|-------|--------|
| 029 | Keyboard accessibility issues (focus traps, missing ARIA) | 3h |
| 035 | HTML template rebuilt for hidden/background viewer | 1h |
| 037 | Lifecycle commands (start/stop/pause) give no visible feedback | 2h |
| 038 | Status bar click opens raw `.log` file instead of viewer | 1h |
| 039 | `toggleCapture` writes to workspace scope (shared, not user) | 1h |
| 042 | Dead setting `deemphasizeFrameworkLevels` (no code reads it) | 30m |
| 043 | Undeclared commands referenced in package.json `when` clauses | 1h |
| 044 | Stale GitHub token on 401 — no re-auth prompt | 1h |
| 045 | Capture diagnostic cites removed viewer "Prev/Next" stepper | 30m |

---

## P3 — Tech Debt & Cleanup

Low-priority items from the review. Not individual bugs — batch as cleanup
sprints. No user-facing urgency.

### Code quality

- ~15 functions exceed the 30-line limit (eslint `max-lines-per-function`)
- ~8 files exceed 300 LOC (eslint `max-lines`)
- Missing braces on single-line `if`/`else` in ~20 locations
- 33 stray `.js` emits in `src/` (gitignored but unexpected)
- Dead enum value in one settings type

### Surface-area sprawl (naming pass — scope fixed by Decision 1)

**In scope (4h):**

- Add `category: "Saropa Log Capture"` to all 120 commands
- Strip the now-redundant prefix from the ~60% of titles carrying it, and from
  the "Saropa:" Build/CI token commands

**Deferred by decision — do not do these without a migration:**

- ~~Banned terms in titles: "Session" (6 commands), "Case" (1 command)~~
- ~~Consolidate Investigation (7) vs Collection (10) families~~

**Still unscoped:** 272 settings, 117 under `integrations.*` alone — audit for
dead/redundant. Bug 042 already covers one confirmed dead setting.

### Docs debt

**Done** (commit `eadc6084`): README 9 factual errors + AI brand name;
ARCHITECTURE dead links + renamed lifecycle files; CONTRIBUTING publish script,
coverage tool, 300-line rule; BUG_REPORT_GUIDE `bugs/history/` + ROADMAP table.

**Remaining** — each is a discrete task, not a batch:

| # | Task | Effort |
|---|------|--------|
| D1 | `plans/guides/configuration.md` covers 44 of 272 settings (16%); wrong defaults (`maxLogFiles` doc 10 / actual 0, `captureAll`), phantom `autoOpen`, `splitRules.*` documented flat but is one object — **generate from `package.json` + verify gate**, matching the 3 existing reference catalogs | 1d |
| D2 | README missing 9.3.x features — screenshot capture, `spamPatterns`, flow-map replay/`customBreadcrumbs`/`customIssues`, status bar SLC menu, `troubleMode.openOnLoad`/`levels`, collapsed day groups; plus ~14 command families with no README coverage | 1d |
| D3 | ARCHITECTURE.md has no module list at all — 30 modules, 17 `ui/` dirs undocumented | 4h |
| D4 | `plans/guides/localization.md` stale counts — NLS 487→546, runtime 1608→2244, coverage 20–33% | 1h |
| D5 | `plans/guides/watch-list.md` — all 7 source paths stale | 1h |
| D6 | `walkthrough/keyboard-shortcuts.md` — `A` key documented as "app-only stack frames", code says "Cycle device logs"; ~18 listed vs ~42 `viewerKeybindings` actions vs README's unverified "51 power shortcuts" | 2h |
| D7 | `style-guide.md` + `terminology.md` not linked from CONTRIBUTING; README:433 mislabels style-guide as "code style" (it is UI style) | 30m |
| D8 | `AGENTS.md` is gitignored, is a `s/Claude/Codex/` copy pointing at a nonexistent `.Codex/rules/`, and lacks the MT-pipeline prohibition — decide: fix, track, or delete | 1h |
| D9 | No test covers the walkthrough (`grep walkthrough src/test` = 0) — add one alongside bug_001's `verify:walkthrough-media` gate | 2h |
| D10 | CHANGELOG.md 543 lines against a ~500 target — trim oldest entries into the 4912-line archive | 30m |
| D11 | `.claude/rules/global.md` says features need an "approved plan in `bugs/`"; reality is plans live in `plans/` and `bugs/` holds defects — correct the rule | 15m |

### Cross-repo follow-up

- Plan 108 residual: the Saropa Lints `writeDiagnosticsMirror` request was never
  filed. Per house rules this must be a bug report in
  `D:\src\saropa_lints\bugs\` — **never** an edit to that repo.

### Bundle / activation (Decision 5 — measure before changing)

1. Measure cold-start activation time with the 4 MB `dist/extension.js`. (2h)
2. **If under ~200 ms:** record the number, close the item, change nothing.
3. **Only if slow:** narrow `onDebugAdapterProtocolTracker` — it fires on ANY
   debug session in any language — to `onDebug` + `workspaceContains`, and
   lazy-load panels that are not immediately visible. Requires testing that
   capture still starts for every supported debug configuration.

### Plan 055 remaining cleanup

Plan trimmed 2026-09-03 to its two open items; Phases 1–2 archived.

- Legacy `:not(.cols)` CSS removal — **15 occurrences**, not the 24 the review
  reported (9 in two style files, 6 in two test files). Confirm every render
  path opts in before removing the guards.
- CSV/markdown `.cols` adoption in `export-formats.ts` (0 consumers today).
  Optional — exports are correct, just independently derived.

### Plan 058 translation locales

Plan rewritten 2026-09-03 against the current engine.

- Phase 0 shipped; Phases 1–2 not started
- Engine is Qwen via Ollama (`l10n_qwen_engine.py`, VRAM-selected model ladder,
  `_LOCALE_INFO` registry). `l10n_nllb_engine.py` and the `_LOCALE_MAP` are
  **gone** — the plan's old FLORES steps pointed at dead symbols
- Bundle is 2244 keys, so Phase 1 is ~29,000 strings
- **Prerequisite (decided 2026-09-03):** extend the translate script to emit
  `package.nls.<locale>.json` through the same Qwen engine, so one operator run
  covers both the viewer bundle and the VS Code chrome. Build and verify it
  against an existing locale before running any new ones. Hand-translation was
  rejected — it is how chrome coverage decayed to 22–37% on the existing 10
- The MT pipeline stays operator-run only; never at publish or from a build

---

## Wow Candidates (interleave with P2)

High-impact, user-delighting features from the backlog. Not bugs — these are
enhancements that could move the product forward.

| Plan | Feature | Effort | Wow |
|------|---------|--------|-----|
| 112 | Tag tooltip dictionary — hover a logcat tag, see what it does | 2d | High |
| 113 | Trouble ↔ flow cross-pollination — link errors to flow map nodes | 3d | High |
| 115b | Signal sparklines — mini charts in the signals panel | 2d | Medium |
| 118 | Breadcrumb rule preview — see what a rule matches before saving | 1d | Medium |
| 031 | Three-column linked-scroll compare | 5d | High |

---

## Dependency Order

```
P0 Security (002, 003, 019)
  ↓
P0 First-run (001, 004, 005, 006)
  ↓
P0 Data integrity (007, 008, 009)
  ↓
P1 Capture pipeline (010, 011, 012, 022)  ←  blocks viewer correctness
  ↓
P1 Command UX (013–015, 017, 021)
  ↓
P1 Viewer/analysis (016, 018, 020, 023, 024)
  ↓
P2 Viewer correctness (025–028, 032)  ←  depends on capture fixes
  ↓
P2 Signals (030, 031)  ←  depends on viewer correctness
  ↓
P2 Polish + Wow candidates (interleaved)
  ↓
P3 Tech debt (batch sprints, no dependency)
```

---

## Owner Decisions — RESOLVED 2026-09-03

All five decisions are made. No planning blockers remain.

### 1. Command surface → add `category`, keep titles

Add `category: "Saropa Log Capture"` to all 120 commands and strip the now-
redundant prefix from the ~60% of titles that carry it. The palette becomes
groupable and searchable while the displayed string stays near-identical, so
existing muscle memory survives.

**Explicitly NOT in scope:** renaming banned terms ("Session" ×6, "Case" ×1) and
consolidating the duplicate Investigation (7) vs Collection (10) families. Both
were considered and rejected for this cycle as breaking changes. Revisit only
with a deliberate migration.

**Effort:** 4h. **Slot:** P3 naming pass.

### 2. Configuration guide → generate + verify gate

Generate the full 272-setting table from `package.json` and add a
`verify:config-guide` gate to the compile chain, matching the three existing
reference catalogs (webview incoming/outbound, commands) that all pass today.
Manual curation was rejected: it drifts the moment a setting is added and there
is no gate to catch it — which is exactly how the guide reached 16% coverage.

Accepted downside: loses hand-written prose nuance per setting.

**This is task D1.** **Effort:** 1d.

### 3. DB_18b 1d → SKIP (confirmed)

Sample SQL preview stays skipped, as
`plans/deferred/DB_18b-1d-sample-sql-preview.md` itself recommends. Leave the
plan in `plans/deferred/`; do not schedule.

### 4. SCREENSHOTS_PLAN → rewrite

Rewrite against current v9.3.x features and terminology (currently 2/21 done,
pre-v7 wording). Archiving was rejected — screenshots carry real weight on the
marketplace listing.

**Effort:** rewrite the plan 2h; capturing the screenshots is separate.

### 5. Activation event → measure first, then decide

Time cold-start activation before changing anything. Only if the 4 MB load
measurably hurts do we narrow `onDebugAdapterProtocolTracker` to `onDebug` +
`workspaceContains` and lazy-load non-visible panels.

Changing the event blind was rejected: it risks silently breaking capture for
debug configurations that no longer match, and no user has reported slow
startup (the one closed issue, #30, was high CPU — not activation).

**Gate:** if activation is under ~200 ms cold, close this item with the
measurement recorded and do not touch the event. **Effort:** 2h to measure.

---

*Generated 2026-09-03 from the usability review of v9.3.12.*
*Review reports: `docs/handover/review-20260902/`.*
*Bug reports: `bugs/bug_001_*.md` through `bugs/bug_046_*.md`.*
