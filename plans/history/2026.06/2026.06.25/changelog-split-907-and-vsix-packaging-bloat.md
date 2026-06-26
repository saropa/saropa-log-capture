# Release 9.0.7 split + .vsix packaging bloat fix

Version 9.0.6 was published to the Marketplace on 2026-06-20, then new features and CHANGELOG edits landed on `main` the same later day under the still-unbumped 9.0.6 version, producing two different artifacts sharing one version number. Separately, `.vscodeignore` failed to exclude repo/CI/test directories, so a packaged `.vsix` carried 2,851 files (~18 MB) of artifacts with no runtime consumer.

## Finish Report (2026-06-25)

### Defect 1 — version collision on 9.0.6

`release: v9.0.6` (commit `a7fd0d5a`, 2026-06-20 13:15) published the extension with a CHANGELOG `## [9.0.6]` section containing the unified log banner (Changed) and four panel/session fixes (Fixed). On 2026-06-25 (19:00–21:52) further work was committed to `main` without bumping `package.json`:

- Investigations feature (`961b3794`)
- bug-report operation-boundary detection (`c172db16`)
- F5 fast `dev-build` launch change and `.vscode-test` cache pruning (build tooling)

Two CHANGELOG commits (`867140ce`, `f4f22d8e`) folded those new entries into the already-published `## [9.0.6]` section. The Marketplace cannot re-accept an existing version, so the new code could not ship as 9.0.6.

**Resolution.** The post-release additions were moved into a new `## [9.0.7]` section placed above 9.0.6:

- Added: Investigations; bug-report operation-boundary detection.
- Maintenance / Build tooling: F5 `dev-build`; `.vscode-test` prune.

The `## [9.0.6]` section was restored to its as-published content (unified banner + four fixes) and given a user-facing overview line, which it had lacked at release (it shipped with a bare `[log]` link). `package.json` was bumped to `9.0.7`. `verify:release-version` confirms the heading matches the manifest version.

### Defect 2 — .vsix packaging bloat

`.vscodeignore` (last edited 2026-03-12) excluded `src/`, `out/`, `node_modules/`, `docs/`, `scripts/`, but not directories that were created or grew afterward: `coverage/` (1,923 files of test-coverage HTML), `reports/` (504), `plans/` (240), `.nyc_output/` (51), `test/` (47), plus `examples/`, `.github/`, `.devcontainer/`, `.dev/`, `.saropa/`, `bugs/`, and `l10n/provenance/`. A package therefore contained 2,851 files / ~18 MB uncompressed, none of it loaded at runtime.

**Resolution.** Added exclusion globs for every artifact directory above, plus `.nycrc.json`, `.mocharc*`, `.nvmrc`, `.node-version`, and `*.vsix`. The extension loads only `dist/extension.js` (`main`), `l10n/bundle.l10n.*.json` (`l10n`), `images/`, `media/walkthrough/`, and `audio/`; those plus the `package.nls*.json` manifest-NLS files are what now ship.

**Verification.** `npx @vscode/vsce ls` reports **47 files** (down from 2,851) with no `coverage/`, `reports/`, `plans/`, `.nyc_output/`, `test/`, `.github/`, or `l10n/provenance/` entries.

### Scope and follow-up

Config and documentation only — no Dart or TypeScript source changed, so no unit test or analyzer path applies. The verification gates are `verify:release-version` (passed) and `vsce ls` (47 files, clean). Publishing 9.0.7 still requires a fresh `npm run compile` + repackage so the `.vsix` carries the new code under the new version; the stale `saropa-log-capture-9.0.6.vsix` on disk is the bloated pre-fix artifact.
