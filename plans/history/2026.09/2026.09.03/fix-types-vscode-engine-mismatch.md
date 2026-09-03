# Fix @types/vscode engine mismatch

`@types/vscode` was pinned at `^1.134.0` while `engines.vscode` declared `^1.105.0`. `vsce package` enforces that the types version does not exceed the engine floor, so packaging failed at the VSIX step — after the publish script had already bumped the version and stamped the changelog, leaving a half-finished release.

## Finish Report (2026-09-03)

**Root cause:** `@types/vscode` had been upgraded independently of `engines.vscode`, introducing a version gap that `vsce` treats as an error.

**Fix:** Pinned `@types/vscode` to `^1.105.0`, matching the existing `engines.vscode` floor. Ran `npm install` to update the lockfile. Verified `tsc --noEmit` passes — no compile-time regressions from the type definition downgrade.

**Risk:** If the extension begins using VS Code APIs introduced after 1.105, TypeScript will flag them at compile time (the types won't include those APIs). This is the desired behavior — it prevents shipping code that crashes on the oldest supported VS Code version.

**Hardening:** Added `verify:engine-types-match` compile gate (`scripts/modules/verify/verify-engine-types-match.mjs`) that asserts `@types/vscode`'s major.minor does not exceed `engines.vscode`'s floor. Wired into both the `compile` and `package` npm scripts, immediately after `verify:node-toolchain`. Prevents recurrence without relying on manual version discipline.

**Scope:** `package.json` (dep version + two script chains + new script entry), `package-lock.json`, new verify script, `CLAUDE.md` (documented new gate), `CHANGELOG.md`.
