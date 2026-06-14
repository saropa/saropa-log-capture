# Declare undeclared integration settings (externalLogs, http)

The Application / file logs (`externalLogs`) and HTTP / Network (`http`) integration
adapters each read four configuration values through `integration-config.ts`, but
those eight keys were never declared in `package.json` `contributes.configuration`.
A setting that is read without a manifest declaration still resolves to its
code-side default at runtime, yet it is invisible and uneditable in the VS Code
Settings UI — so the `externalLogs` Settings table described in the integration
spec was never actually reachable by users, and the `http` adapter's correlation
options had no UI at all. Declaring the eight settings makes them discoverable and
editable; no runtime behavior changes.

## Finish Report (2026-06-14)

### Scope

(B) VS Code extension manifest + (C) docs. No TypeScript runtime logic changed —
the config reader (`integration-config.ts`) already consumed these keys; the change
only adds their `contributes.configuration` declarations, the NLS title keys those
declarations reference, a regenerated NLS-coverage data file, a regression test, and
CHANGELOG entries.

### What changed

- **`package.json`** — declared eight settings whose `default`, `minimum`, and
  `maximum` mirror the existing reader clamps exactly:
  - `integrations.externalLogs.paths` (string[], default `[]`),
    `.writeSidecars` (bool, `true`), `.prefixLines` (bool, `true`),
    `.maxLinesPerFile` (number, `10000`, 100–1000000).
  - `integrations.http.requestLogPath` (string, `""`),
    `.requestIdPattern` (string, `""`),
    `.timeWindowSeconds` (number, `10`, 1–120),
    `.maxRequestsPerSession` (number, `500`, 10–5000).
  The `externalLogs` block sits before the `security` block; the `http` block sits
  between `database` and `browser`, mirroring the reader's ordering.
- **`package.nls.json` + 10 locale files** — added the eight setting-title `%keys%`
  to every `package.nls*.json` so `verify-nls` key parity holds (499 keys, 11 files).
  Locale files carry the English title text; they are genuinely untranslated and the
  machine-translation pipeline is operator-run, so coverage counts them as untranslated
  rather than falsely covered. The base English file was edited textually to avoid
  normalizing its existing `\u`-escaped glyphs.
- **`src/l10n/nls-coverage-data.ts`** — regenerated via `nls-coverage.mjs` so the
  `verify:nls-coverage` build check matches the updated catalogs.
- **`src/test/modules/config/integration-settings-manifest.test.ts`** — new test that
  reads `package.json` and pins each of the eight settings' declared default and numeric
  bounds against the values the reader expects, preventing the manifest and reader from
  silently drifting apart again.
- **`CHANGELOG.md`** — two `[Unreleased] › Added` entries describing the now-editable
  settings for each adapter.

### Why it was needed

The integration spec for Application and File Logs lists a user-facing Settings table.
The tailer, sidecar provider, commands, viewer source discovery, and unified-JSONL
writer all shipped in v5.5.2, but the settings half of the spec was unmet because the
keys were absent from the manifest. The `http` adapter had the same read-without-declare
gap. Both classes of gap are the kind a manifest-vs-reader parity test now guards.

### Deferred / out of scope

The spec's deferred items (`createIfMissing`, `followRotation`, glob paths, the
"Tailing N files" status bar item) remain out of v1 and were not added. The spec's
`enabled` row is realized by the integrations adapter toggle (`integrations.adapters`),
not a separate per-adapter boolean, matching how every other adapter is gated.

### Verification

- `node scripts/modules/verify/verify-nls.js` → passed, 499 keys aligned across 11 files.
- `node scripts/modules/generate/nls-coverage.mjs --check` → `OK: nls-coverage-data.ts matches`.
- `package.json` parsed as valid JSON.
- `npm run check-types` → clean (`tsc --noEmit`, zero errors).
- `npm run test:file -- out/test/modules/config/integration-settings-manifest.test.js`
  → 6 passing. No pre-existing test references these keys, so none required updates.

### Files

- `package.json`
- `package.nls.json`, `package.nls.de.json`, `package.nls.es.json`, `package.nls.fr.json`,
  `package.nls.it.json`, `package.nls.ja.json`, `package.nls.ko.json`,
  `package.nls.pt-br.json`, `package.nls.ru.json`, `package.nls.zh-cn.json`,
  `package.nls.zh-tw.json`
- `src/l10n/nls-coverage-data.ts`
- `src/test/modules/config/integration-settings-manifest.test.ts`
- `CHANGELOG.md`

The `externalLogs` declarations and their NLS keys landed in commit `d413f190`; the
`http` declarations, the regression test, and this report land in the follow-up commit.
