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

## Commits

- (pending — see next commit in this session)
