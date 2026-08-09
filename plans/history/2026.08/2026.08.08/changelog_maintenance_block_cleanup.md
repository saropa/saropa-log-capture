# Changelog: enforce Maintenance-block convention for non-user-facing entries

Several past `CHANGELOG.md` releases had internal/non-user-facing items (l10n pipeline tooling, design-token migrations, internal refactors, build-gate additions) mixed into the user-facing `### Added` / `### Changed` / `### Fixed` sections, or listed under a bare `### Maintenance` heading instead of the collapsed `<details><summary>Maintenance</summary>` block used elsewhere in the file. This made the visible release notes noisier than necessary and was inconsistent with the file's established convention.

## Root cause

No enforcement mechanism (manual or automated) verifies that internal-only bullets are filed under a collapsed Maintenance block. Entries drift into user-facing sections whenever a release is written without a deliberate second pass to separate audience-facing changes from internal ones.

## Fix

Reviewed every released version in `CHANGELOG.md` (9.3.10 down through 9.2.0) and relocated non-user-facing bullets into `<details><summary>Maintenance</summary>` blocks:

- **9.3.10**: wrapped the existing bare `### Maintenance` heading in a collapsed `<details>` block.
- **9.3.9**: moved the l10n 25-string gap-fill bullet from `### Fixed` into the existing Maintenance block's l10n-pipeline subsection.
- **9.3.8**: created a new Maintenance block; moved the Trouble Mode constants consolidation, the `verify:trouble-levels` compile gate, and the first-error-scan file split out of `### Changed`.
- **9.3.7**: moved the l10n key-verification build-tooling bullet and the "29 manual translations" fill bullet from `### Fixed` into the existing Maintenance block.
- **9.3.3**: created a new two-subsection Maintenance block (l10n pipeline; design tokens); moved the l10n audit tooling bullet and five design-token migration bullets out of `### Changed`, and the design-token-migration test-fix bullet out of `### Fixed`.
- **9.3.0**: created a new Maintenance block; moved the "Internal: ANR keyword regex" bullet out of `### Changed`.

No user-facing prose (version intro lines, `### Added`/`### Changed`/`### Fixed` entries describing observable behavior) was altered in wording — only section placement changed. Versions 9.3.6, 9.3.5, 9.3.4, 9.3.2, 9.3.1, and the 9.2.x releases were already correctly organized and needed no changes.

## Verification

Confirmed every `<details>` tag in the file has a matching `</details>`, and no `### Maintenance` (bare heading) markers remain. No code was touched — this is a docs-only change to `CHANGELOG.md`.
