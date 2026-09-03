# Issue Report Guide Rename

`bugs/BUG_REPORT_GUIDE.md` only covered bugs, unlike the sibling `saropa_lints` process doc (`bugs/ISSUE_REPORT_GUIDE.md`), which also covers feature requests under the same template/lifecycle machinery. The guide was rewritten and renamed to bring both repos onto the same naming convention and scope.

## Finish Report (2026-09-03)

### Change

- Created `bugs/ISSUE_REPORT_GUIDE.md`, replacing `bugs/BUG_REPORT_GUIDE.md`.
- Retained all bug-reporting content (template, pitfalls, investigation checklist, severity guide, lifecycle) from the original file, adapted to this project's stack (VS Code extension / webview, not `saropa_lints`' AST-rule domain).
- Added a **Feature Request Template** and **Feature Request Categories** section (New Command, Viewer Feature, Setting, Tooling/Infrastructure), modeled on the `saropa_lints` guide's proposal template.
- Added an **Attribution** section — a lightweight version of the `saropa_lints` grep-based attribution check, scaled down to "disable other extensions and reproduce" since this project has no sibling-rule-registry ambiguity to grep against.
- Renamed bug-file naming convention entries to include a feature-request row (`NNN_plan-description.md`) alongside the existing `bug_NNN_*` pattern.
- Repointed the two active references to the old filename: [CHANGELOG.md:111](../../../../CHANGELOG.md#L111) and [MASTER_PLAN.md:166](../../../../MASTER_PLAN.md#L166).
- Left stale references inside frozen `plans/history/**` files untouched (they describe past states and are not live documentation).
- `git rm`'d the old `bugs/BUG_REPORT_GUIDE.md`.

### Root cause

Not a bug fix — a documentation consistency gap. The `bugs/` guide predated the feature-request workflow this project already uses in practice (`bugs/NNN_plan-*.md` files exist and are referenced in `ROADMAP.md`), but the guide itself never documented that pattern.

### Verification

`/code-review low` run on the diff: no findings (pure doc rename/restructure, no runtime code).

## Finish Report (2026-09-03, hardening pass)

Follow-up pass addressing gaps identified in the initial handoff's self-review, before the reflection findings could be treated as verified rather than assumed:

- **Bug template drift confirmed and fixed.** Grepped all 46 filed bug reports (`bugs/bug_001_*.md` – `bugs/bug_046_*.md`); every one uses `## Status: <value>` and `## Severity: <value>` as actual H2 headings immediately after the title, followed by `## Problem` (not `## Summary`) and `## Proposed Fix` (not `## Suggested Fix`) before `## Changes Made`. The first draft of the bug template used bold `**Status: Open**` text and invented `Created:`/`Area:` metadata fields that no filed bug actually has, plus a `## Summary` heading and `## Expected vs Actual`/`## Data Flow Context` sections not seen in practice. Rewrote the template to match the observed structure exactly, and added a one-line note above the template pointing at this as ground truth.
- **Feature request template honesty note added.** Checked `plans/031_plan-session-comparison-three-way.md` and confirmed `slc-docs-and-writing`'s claim that plan files are "ad-hoc" — that one uses `**Feature:**` / `**Status (date): ...**` / `## What exists` rather than any template shape. Added a line clarifying the Feature Request Template is a target for new filings, not a description of existing `plans/*.md` files, so a reader doesn't assume an old plan matches it.
- **Common Pitfalls table spot-checked.** Grepped `calcItemHeight` and `item.type === 'marker'` across `src/` — both patterns are still live in 65 files, so the carried-over pitfall entries remain accurate; no changes needed.
- **Fixed 3 more live (non-history) references** the first pass missed by only grepping tracked files touched in this task's own diff: `.claude/skills/slc-change-control/SKILL.md` (4 refs), `.claude/skills/slc-docs-and-writing/SKILL.md` (2 refs), `.claude/skills/slc-research-methodology/SKILL.md` (2 refs) — all load-bearing skill docs Claude reads for bug-filing guidance in future sessions. `.claude/` is gitignored (`.gitignore:19`), so these fixes are local-only to this checkout and will not appear in the commit diff — noted here so a future session doesn't re-discover the same drift from a fresh clone.
- **Confirmed out of scope, left alone:** references inside `docs/handover/*.md` (frozen handover snapshots) and `.claude/worktrees/*` (separate agent worktree copies, not the main tree) — both describe past states, not live documentation.
- Old `bugs/BUG_REPORT_GUIDE.md` reappeared once mid-task after `git rm` (an editor auto-save flushing a stale buffer, per the handoff's "not yet verified" note) — removed again; final commit confirmed clean via `git status`.

### Verification

`/code-review low` re-run on the incremental diff (`bugs/ISSUE_REPORT_GUIDE.md` template restructuring only — the tool also surfaced 2 findings in `scripts/modules/verify/verify-script-position-proxies.mjs`, but that file was already dirty from unrelated work in the repo before this task started and is not part of this diff; left untouched per "never flag dirty/untracked files as a cleanup issue" policy).

## Commits

- `a8d6c1d6` docs: rename bugs/BUG_REPORT_GUIDE.md to ISSUE_REPORT_GUIDE.md, add feature request template
- (pending — hardening pass commit)
