# Fix: publish script hangs at vsce login overwrite prompt on Windows

The `check_vsce_auth()` function in `scripts/modules/publish/checks_prereqs.py` ran `npx @vscode/vsce login saropa` interactively after `verify-pat` failed. When the publisher was already known, vsce prompted "Do you want to overwrite its PAT? [y/N]" — but on Windows the `cmd.exe → npx.cmd → node → vsce` process chain broke stdin passthrough, so the prompt received EOF and immediately aborted with "ERROR Aborted", failing the entire publish pipeline.

## Finish Report (2026-09-03)

### Root cause

`subprocess.run()` with `shell=True` on Windows wraps the command in `cmd.exe`. For deeply nested process chains (`cmd.exe → npx.cmd → node → vsce`), interactive stdin does not reliably pass through to the innermost process. The `vsce login` overwrite confirmation prompt defaults to "N" and treats EOF as cancellation.

### Fix applied

**Primary fix (VSCE_PAT):** Added `get_vsce_pat()` to `utils.py`, mirroring the existing `get_ovsx_pat()` pattern. When `VSCE_PAT` is set in the environment or in the project `.env` file, the credential check passes immediately (no interactive prompt) and `publish_marketplace()` passes the token via `--pat` to `vsce publish`, bypassing the keychain entirely. Note: vsce ≥2.x natively reads `VSCE_PAT` from the environment, but explicit `--pat` makes the credential source visible in debug output and supports `.env` (which vsce doesn't read).

**Fallback fix (logout-first):** When no `VSCE_PAT` is available, the script calls `npx @vscode/vsce logout saropa` before `vsce login saropa` to clear any stale publisher entry. This avoids the "overwrite? [y/N]" prompt. If `logout` fails (subcommand missing in older vsce, or publisher not registered), login is still attempted — only unexpected failures produce a warning.

### Hardening

- Confirmed `vsce publish --pat <token> --packagePath <file>` is supported (verified via `vsce publish --help`).
- Tested `vsce logout` on an unregistered publisher: exits 1 with "Unknown publisher" — the error handler now recognises both "unknown command" and "unknown publisher" as expected failures and suppresses the warning for both.
- `get_vsce_pat()` docstring documents the relationship with vsce's native `VSCE_PAT` env var support.
- `publish_marketplace()` documents the intentional double-read of `.env` (once at check time, once at publish time) so the publish step uses the current value.
- PAT values with special characters are safe: `run()` passes arguments as a list (no shell interpretation).

### Files changed

| File | Change |
|---|---|
| `scripts/modules/publish/utils.py` | Added `get_vsce_pat()` — reads `VSCE_PAT` from env or `.env` |
| `scripts/modules/publish/checks_prereqs.py` | `check_vsce_auth()` tries `VSCE_PAT` first, then keychain, then logout+login with graceful logout-failure handling |
| `scripts/modules/publish/publish_release.py` | `publish_marketplace()` appends `--pat` when `VSCE_PAT` is available |
| `CHANGELOG.md` | Added maintenance note under 9.4.0 |

### Risk assessment

Low. The `VSCE_PAT` path is purely additive — absent the variable, behavior is identical to before except for the logout-first guard. The `vsce logout` command is idempotent; expected failures (unknown publisher, unknown command) are silenced; unexpected failures warn but don't block.
