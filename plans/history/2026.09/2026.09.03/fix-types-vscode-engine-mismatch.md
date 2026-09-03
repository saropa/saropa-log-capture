# Fix @types/vscode engine mismatch

`@types/vscode` was pinned at `^1.134.0` while `engines.vscode` declared `^1.105.0`. `vsce package` enforces that the types version does not exceed the engine floor, so packaging failed at the VSIX step — after the publish script had already bumped the version and stamped the changelog, leaving a half-finished release.

## Finish Report (2026-09-03)

**Root cause:** `@types/vscode` had been upgraded independently of `engines.vscode`, introducing a version gap that `vsce` treats as an error.

**Fix:** Pinned `@types/vscode` to `^1.105.0`, matching the existing `engines.vscode` floor. Ran `npm install` to update the lockfile. Verified `tsc --noEmit` passes — no compile-time regressions from the type definition downgrade.

**Risk:** If the extension begins using VS Code APIs introduced after 1.105, TypeScript will flag them at compile time (the types won't include those APIs). This is the desired behavior — it prevents shipping code that crashes on the oldest supported VS Code version.

**Hardening:** Added `verify:engine-types-match` compile gate (`scripts/modules/verify/verify-engine-types-match.mjs`) that asserts `@types/vscode`'s major.minor does not exceed `engines.vscode`'s floor. Wired into both the `compile` and `package` npm scripts, immediately after `verify:node-toolchain`. Prevents recurrence without relying on manual version discipline. The `parseFloor()` helper strips range operator prefixes (`^`, `~`, `>=`, exact) before extracting digits, so it handles caret, tilde, exact, and `>=` compound ranges — but not `||` union ranges (not used in VS Code engine declarations). Supports `--fix` flag to auto-correct `package.json` to match the engine floor. The `--fix` replacement validates exactly one `"@types/vscode"` entry exists before substituting, aborting with an error if the count is unexpected.

**Pre-commit hook:** Added `scripts/git-hooks/pre-commit` that runs the engine-types-match check only when `package.json` is staged — zero overhead on unrelated commits. Installed alongside the existing `commit-msg` hook via `npm run install:hooks`.

**Preflight:** Also wired `verify:engine-types-match` into the `preflight` script, so `npm run preflight` catches the mismatch before a full compile.

**Version:** Bumped from 9.4.0 to 9.4.1. The 9.4.0 changelog listed this fix but the actual `@types/vscode` value on `main` was still `^1.134.0`, indicating the fix was either reverted or never committed — 9.4.1 is the release that ships it.

**API ceiling advisory:** Added `verify:types-api-ceiling` (`scripts/modules/verify/verify-types-api-ceiling.mjs`) — reads the installed `@types/vscode` version from `node_modules` and warns if it exceeds the `engines.vscode` floor. Advisory only (exit 0), not wired into compile/package. On first run it surfaced that `^1.105.0` resolves to 1.136.0 (caret allows minor bumps), meaning the type surface is 31 minor versions ahead of the engine floor. No compile error because the range declaration is correct per `vsce`, but runtime-only APIs from 1.106–1.136 will compile without warning.

**Scope:** `package.json` (version bump, dep version, three script chains, two new script entries), `package-lock.json`, two new verify scripts, pre-commit hook, `CLAUDE.md` (documented new gates and updated preflight doc), `CHANGELOG.md`.
