# Wire the dead security.includeInBugReport toggle

The `saropaLogCapture.integrations.security.includeInBugReport` setting was declared in
`package.json` and read into the resolved config (`integration-config.ts`), but no code
consumed it: `bug-report-collector.ts` only honored the `codeQuality` variant of that
flag. Enabling the security setting therefore had no observable effect — a user who turned
on "Include security sidecar in bug reports" got nothing in their report. The defect was
found while reviewing the superseded `security-audit-logs` design draft against the
shipped implementation.

## Finish Report (2026-06-14)

### Scope

(B) VS Code extension (TypeScript). No Flutter/Dart code, no docs-only-only change.

### What changed

- **`src/modules/integrations/providers/security-audit.ts`** — exported the previously
  file-local `SecurityEvent` interface so the bug-report collector can type the parsed
  sidecar and reuse `buildEventSummary`. No runtime behavior change (compile-time export
  only).
- **`src/modules/bug-report/bug-report-collector.ts`** — added `collectSecuritySummary()`
  and a `securitySummary?: string` field on `BugReportData`. The collector gates on both
  `integrationsSecurity.includeInBugReport` and the `security` adapter being enabled, reads
  `<baseFileName>.security-events.json` next to the log, and returns a count-only summary
  via `buildEventSummary`. The call is added to the existing `Promise.all` gather so it runs
  concurrently with the other collectors.
- **`src/modules/bug-report/bug-report-sections.ts`** — added `formatSecuritySection()`,
  rendering a `## Security / Audit` section that carries only the category counts plus an
  explicit "counts only" notice.
- **`src/modules/bug-report/bug-report-formatter.ts`** — pushes the security section into
  the report when `securitySummary` is present, positioned beside the existing code-quality
  section.
- **`CHANGELOG.md`** — Unreleased → Fixed entry describing the now-functional setting and
  the counts-only privacy contract.
- **`src/test/modules/bug-report/bug-report-formatter.test.ts`** — two cases: the section
  renders with the summary text and the counts-only notice when `securitySummary` is set,
  and is omitted when it is absent.

### Privacy contract

The bug report carries category counts only — never raw events or identifiers. This holds
because `buildEventSummary` derives categories from the numeric Windows event ID alone and
never reads the (already-redacted) `message` field. A shared bug report therefore cannot
leak logon account names or IP addresses, which is the reason the underlying capture is
opt-in and redaction-on by default. The "counts only" notice in the rendered section states
this to anyone reading the report.

### Deep review notes

- Logic & safety: the collector wraps the sidecar read in try/catch and returns `undefined`
  on any read/parse failure, so a missing or malformed sidecar degrades to "no section"
  rather than throwing during report generation. `parseJSONOrDefault` guards malformed JSON.
- Architecture: mirrors the established `collectQualitySummary` → `BugReportData` field →
  `formatXxxSection` pattern exactly, including the double gate (setting on AND adapter
  enabled). No new shared infrastructure; reuses `buildEventSummary` as the single source of
  truth for event categorization rather than duplicating the category map.
- Performance: the read is one small JSON file already written by the security provider at
  session end; it joins the existing concurrent gather, adding no serial latency.

### Testing

- Existing-test audit: grepped the test tree for `buildEventSummary`, `SecurityEvent`,
  `redact`, `collectSecuritySummary`, `formatSecuritySection`, `securitySummary`,
  `includeInBugReport`. The only pre-existing references are in `security-audit.test.ts`
  (imports `redact` + `buildEventSummary`, both unchanged); the `SecurityEvent` export is
  additive and breaks no assertion.
- `npm run test:file -- out/test/modules/integrations/security-audit.test.js` → 12 passing.
- `npm run test:file -- out/test/modules/bug-report/bug-report-formatter.test.js` → 27
  passing (includes the 2 new security-section cases).
- `npm run check-types` → clean.
- `npx eslint` on the four touched source files → clean.

### Localization

The bug-report markdown is a generated English artifact; its section headers
(`## Code Quality`, `## Cross-Session History`, etc.) are intentionally hardcoded English and
not routed through the `t()`/`vt()` catalog. The new `## Security / Audit` section follows
that established convention, so no catalog keys were added.

### Outstanding

None. The setting is functional end to end and covered by tests.
