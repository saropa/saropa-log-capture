# Changelog — group non-user-facing entries under Maintenance `<details>` sections

**Trigger (user request, verbatim):** "all non-user facing changes must be moved to a detail section within their release" (with an example `<details><summary>Maintenance</summary>` block), followed by "this also applies to changelog_archive.md", "full sweep, all releases", and "note i also fixed the markdown bullets '-'".

This was a documentation-only reorganization of `CHANGELOG.md` and `CHANGELOG_ARCHIVE.md`. No source code, tests, or build config were touched. The goal: every non-user-facing entry (build tooling, tests, file modularization / 300-line splits, internal refactors, packaging, CI/coverage, developer docs) is relocated — verbatim, never deleted — into a per-release collapsible `<details><summary>Maintenance</summary>` block, so each release's `Added` / `Changed` / `Fixed` lists read as user-facing only while the engineering detail stays one expand away.

## Finish Report (2026-06-10)

### Scope
(C) docs only — two changelog markdown files. No (A) Flutter/Dart and no (B) TypeScript extension code.

### What changed

**CHANGELOG.md (active)** — created/extended Maintenance blocks in the editable releases that still carried non-user-facing entries in their feature lists:
- `[Unreleased]` — ROADMAP redirect (Documentation) + `publish.py` Step-9 no-translation (Build tooling). Also logged this reorganization itself as a Documentation entry.
- `8.0.2` — security `shell-quote` bump, `publish.py` ×2, `translate_l10n.py` cancellable + NLLB-GPU, "more of the viewer UI is translatable". Kept "ships translations in 10 languages" user-facing (real translations shipped).
- `8.0.1` — entire `Changed` section (NLLB pipeline, `translate_l10n.py` split, quieter tests, session-manager test fix, provenance) → Maintenance.
- `8.0.0` — test-coverage entry → Maintenance.
- `7.14.0` / `7.13.1` — the two "viewer is now localizable" entries (both explicitly state "no visible change in English") → Maintenance, consistent with the 8.0.2 "more translatable" decision.

**CHANGELOG_ARCHIVE.md** — full bullet-by-bullet sweep of every release (7.11.2 → 0.1.0). Most releases were already compliant; stragglers were moved in ~25 releases. Converted non-standard non-user-facing section headers (`### Tests`, `### Administration`, `### Documentation`, `### Refactored`, `### Added (tests)`) into Maintenance blocks, and relocated scattered publish-script, modularization, CI/coverage, `@types/vscode` packaging, ESLint-config, internal-module, dead-code-cleanup, and test-fix bullets into each release's Maintenance block (creating one where absent, extending the existing one otherwise).

**Bullet normalization (user)** — the user converted all `•` list markers to `-` across both files in the same working tree.

### Judgment calls (deliberately left user-facing)
- README / marketplace-badge / marketplace-keyword one-liners, the `### Publishing` Open-VSX availability note, and "why it broke" explanatory context — each has a user-visible effect, so left in place.
- `saropaLogCapture.changelogPaths` (7.14.0) — a user-facing setting; the "no behavior change" phrase applies only to the accompanying internal module move.

### Verification
- `<details>` / `</details>` / `<summary>Maintenance</summary>` tags balanced: CHANGELOG.md 10/10, CHANGELOG_ARCHIVE.md 63/63; nesting depth returns to 0 in both.
- Membership scan: zero self-labeled non-user-facing bullets remain outside a `<details>` block in either file (the two prose mentions of `` `<details>` `` on archive lines ~72/117 are backtick-quoted text, not block openers).
- `•` markers remaining: 0 in both files.
- No entry deleted — every relocation preserved the original bullet text verbatim.

### Outstanding
None. The reorganization is complete across both changelogs.
