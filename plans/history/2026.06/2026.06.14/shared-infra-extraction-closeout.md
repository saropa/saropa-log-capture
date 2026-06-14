# Shared-infra extraction — cross-repo close-out (Won't Do)

Three task files under `bugs/` tracked a cross-repo plan to extract code duplicated across the three
Saropa VS Code extensions into shared packages — `saropa-release-tools` (the `publish.py` orchestrator
and release gates), `saropa-vscode-i18n` (the `l10n()` runtime plus translation tooling), and
`saropa-vscode-ui` (the webview/dashboard kit). The extraction had already been rejected as
over-engineering in `saropa_drift_advisor/plans/67-saropa-suite-integration.md` §7 and mirrored in
`saropa_lints`, but this repository's three consumer task files were still marked `Open`, leaving the
three repositories inconsistent about a settled decision.

## Finish Report (2026-06-14)

### What changed

The three consumer task files were closed to match the disposition already recorded in the sibling
repositories:

- `bugs/shared_infra_release_tools_extraction.md`
- `bugs/shared_infra_vscode_i18n_extraction.md`
- `bugs/shared_infra_vscode_ui_extraction.md`

Each had its `Status:` line flipped from `Open` to `Won't Do` and gained a `## Resolution: WON'T DO
(2026-06-14)` block stating the rationale: three new publishable packages for three in-house consumers
cost more in versioning, publishing, and release coordination than the duplication they remove, with
no user-facing benefit; the duplication is accepted as a known trade-off, and a single path-dep module
or a sync script is preferred over a new published unit if a shared bug recurs. Each Resolution block
points at the canonical rationale (`saropa_drift_advisor` plan 67 §7), its mirror in `saropa_lints`,
and this repository's plan 105. The original task plans are retained beneath the Resolution block as
the record of what was considered.

The three files were then archived with `git mv` from `bugs/` to
`plans/history/2026.06/2026.06.14/`, matching the dotted-date convention of existing siblings and the
archival already performed in `saropa_drift_advisor`.

`plans/105_plan-saropa-suite-integration.md` — this repository's half of the suite-integration plan —
had its "Shared infrastructure" section retitled to `WON'T DO (rejected 2026-06-14)` with the same
rationale recorded inline. The package descriptions below the new banner are retained as the record of
what was considered. Plan 105 as a whole remains active; only its shared-infra section is closed.

### Why

The decision to not extract shared packages was made cross-repo. Leaving this repository's task files
`Open` created a false impression that the work was still planned here, contradicting the closed state
in the other two repositories. Closing and archiving them ties off the inconsistency so all three
repositories agree.

### Verification

- `git status` clean after commit; the status flip, Resolution blocks, `git mv` archival, and plan 105
  edit all landed in commit `6c73d978`.
- Cross-repo references in each Resolution block verified against the confirmed file locations in
  `saropa_drift_advisor` and `saropa_lints`.
- No code, tests, runtime strings, or localization catalogs were touched — docs/planning only.

### Scope and outstanding work

Docs/planning disposition only. No outstanding work for this task; the cross-repo rejection is now
consistently recorded in `saropa_drift_advisor`, `saropa_lints`, and `saropa-log-capture`.

Finish report saved: plans/history/2026.06/2026.06.14/shared-infra-extraction-closeout.md
