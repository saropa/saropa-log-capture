# Plan: Crash Dumps — copyToSession

**Status:** Implemented (2025-03-13). Added `integrations.crashDumps.copyToSession` (default `false`). When enabled, discovered dumps are copied into the session folder (500 MB cap, duplicate basenames get numeric suffix). Sidecar includes `copiedTo` per file and meta includes `copiedCount`. Uses `vscode.workspace.fs.copy()`; copy failures are logged and skipped.

---

**Adapter:** `crashDumps`
**Provider:** `src/modules/integrations/providers/crash-dumps.ts`

## What exists

At session end, scans directories for crash dump files matching the session time window. Writes a `basename.crash-dumps.json` sidecar listing found files (path, size, mtime). Files remain in their original locations.

## What's missing

`copyToSession` option: when enabled, copy discovered dump files into the session output folder so they're self-contained alongside the log and sidecar files.

## Sub-features

### 1. Config additions

Add to `IntegrationCrashDumpsConfig`:
- `copyToSession`: `boolean` (default `false`)

Add to `package.json` settings:
- `saropaLogCapture.integrations.crashDumps.copyToSession` — boolean, default `false`
- Description: "Copy discovered crash dump files into the session folder for portability."

### 2. Implementation

In `onSessionEnd`, after collecting found files:

1. If `copyToSession` is true and found files exist:
   - Resolve the session output folder from `context` (same folder where sidecars are written)
   - For each found file, copy it to the session folder using `vscode.workspace.fs.copy()`
   - Use the original filename; if duplicates exist across directories, append a numeric suffix
   - Cap total copy size (e.g. 500 MB) to prevent runaway disk usage — skip remaining files if exceeded
2. Update the sidecar JSON to include a `copiedTo` field per file entry
3. Update meta payload to include `copiedCount`

### 3. Error handling

- If a file copy fails (permissions, disk full), log to output channel and continue with remaining files
- Never throw from the copy loop — partial results are fine
- If the session folder path isn't available, skip copying entirely (log warning)

### 4. Files to modify

| File | Change |
|------|--------|
| `src/modules/config/config-types.ts` | Add `copyToSession` to `IntegrationCrashDumpsConfig` |
| `src/modules/config/integration-config.ts` | Read `copyToSession` setting |
| `package.json` | Add `copyToSession` boolean setting |
| `src/modules/integrations/providers/crash-dumps.ts` | Add copy logic after file discovery |

### 5. Considerations

- Crash dumps can be large (hundreds of MB) — the size cap is essential
- Use `vscode.workspace.fs` for the copy, not Node `fs`, per project rules
- The session folder path must come from context — check how other providers access it (e.g. sidecar writing path)
