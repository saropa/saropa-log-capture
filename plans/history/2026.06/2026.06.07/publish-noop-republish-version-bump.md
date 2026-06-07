# Publish script re-offered an already-published version (no-op republish)

User report: "the changelog said 'Unreleased' and because you didn't version bump nothing was published! even though the terminal report said otherwise! i manually changed to 7.17.4". A `/publish` run printed "v7.17.3 is live!" and the store-propagation check passed instantly, yet the 13 new commits sitting under a plain `## [Unreleased]` heading never shipped — the run had silently republished the already-live 7.17.3.

## Finish Report (2026-06-07)

**This work will be reviewed by another AI.**

### Scope

**(C) docs/scripts only** — Python developer publish pipeline (`scripts/modules/publish/version.py`) plus a CHANGELOG Maintenance note. No Flutter/Dart app code (A) and no VS Code extension TypeScript (B).

### Root cause

`_suggest_version()` ([version.py](../../../../scripts/modules/publish/version.py)) never bumped the patch. Its only two branches were:

```python
if max_cl and _parse_semver(pkg_version) < _parse_semver(max_cl):
    return max_cl          # changelog ahead of package
return pkg_version          # otherwise keep package version as-is
```

When `package.json` (7.17.3) **equaled** the latest released CHANGELOG heading (7.17.3) and a plain `## [Unreleased]` section held new work, neither branch bumped — it re-offered 7.17.3. Because `PUBLISH_YES` / Enter accepts the suggestion verbatim (`_resolve_version`), the already-published number flowed downstream and the whole pipeline collapsed into a no-op:

1. `_sync_package_version(7.17.3, 7.17.3)` — equal, no write.
2. `is_republish = is_version_tagged("7.17.3")` → **True** (tag `v7.17.3` existed from the prior release).
3. `_maybe_stamp_changelog(7.17.3, is_republish=True, …)` returns early → `## [Unreleased]` **never stamped**.
4. `run_publish_steps` saw the tag exists → skipped commit + tag; Marketplace already had 7.17.3 → skipped; Open VSX republish/skip; GitHub release `v7.17.3` already existed.
5. Store-propagation check passed on attempt 1/21 because 7.17.3 was already live.
6. Success banner printed "v7.17.3 is live!" — true but a no-op; the 13 new commits never shipped.

`_bump_patch()` existed in the module but had **no caller** — the bump path was simply never wired.

### Fix

Three changes in [version.py](../../../../scripts/modules/publish/version.py):

1. **New `_get_versioned_unreleased_version()`** — reads a pinned `## [x.y.z] - Unreleased` heading and returns its version, so an author-chosen next number is honored over any guess.
2. **`_suggest_version()` rewritten** as a four-branch authority ladder: (1) pinned-unreleased wins; (2) changelog released-heading ahead of package → use it as-is; (3) **plain `## [Unreleased]` on top of a `package.json` not ahead of the latest released heading → `_bump_patch(max_cl)`** (this is the fix — `pkg == max_cl` reduces from the `<=` guard because case 2 already returned on `<`); (4) otherwise keep the package version.
3. **`validate_version_changelog()`** now computes `pinned_unreleased` and `has_plain_unreleased = has_unreleased_section() and pinned is None`, and passes both into `_suggest_version`.

### Verification

No Python test harness exists in the repo (no `test_*.py` / `*_test.py`; `scripts/modules/test/` is JS runner plumbing only), and no test referenced any version-logic symbol. Validated the new function with a standalone scenario run — all six passed:

| Case | Inputs (pkg, max_cl, pinned, has_plain) | Result | Expect |
|------|------------------------------------------|--------|--------|
| Bug repro | 7.17.3, 7.17.3, None, True | 7.17.4 | 7.17.4 |
| Pinned | 7.17.3, 7.17.3, 7.18.0, False | 7.18.0 | 7.18.0 |
| Changelog ahead | 7.17.3, 7.17.4, None, False | 7.17.4 | 7.17.4 |
| Package ahead | 7.18.0, 7.17.3, None, False | 7.18.0 | 7.18.0 |
| First release | 1.0.0, None, None, True | 1.0.0 | 1.0.0 |
| No double-bump | 7.17.4, 7.17.3, None, True | 7.17.4 | 7.17.4 |

`python -m py_compile scripts/modules/publish/version.py` → OK.

### Recovery state at time of fix

`package.json` = 7.17.3; CHANGELOG max manually stamped to `## [7.17.4]` by the user. A re-run now takes the "changelog ahead of package" branch → suggests 7.17.4, bumps `package.json`, tags `v7.17.4`, publishes. No further manual edits needed.

### Residual gap (not closed by this fix)

The success banner still does not detect a genuine no-op republish: if a run lands on an already-tagged version with commits ahead of that tag (e.g. a user Enter-accepts a stale number), `run_publish_steps` skips everything and still prints "live!". Suggested follow-up: guard the banner with a "republishing already-tagged version; N commits will NOT ship" warning when `git rev-list v{version}..HEAD` is non-empty. Left unimplemented pending permission.

### Files changed

- `scripts/modules/publish/version.py` — new `_get_versioned_unreleased_version()`, rewritten `_suggest_version()`, wired `validate_version_changelog()`.
- `CHANGELOG.md` — Maintenance note under 7.17.4.
- `plans/history/2026.06/2026.06.07/publish-noop-republish-version-bump.md` — this report.
