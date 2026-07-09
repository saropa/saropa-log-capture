# Signal Report — auto-save on open, complete Copy Report, overview file links

The signal report webview's Copy Report / exported markdown omitted the Recommendations section that the on-screen panel displayed, the report was only written to disk through a manual "Save Report" button, and the Session Overview showed file paths as inert text. This change completes the export, replaces the manual save with an automatic save when the report opens, and turns the overview's log-file and report-file paths into openable links.

## Finish Report (2026-07-09)

### Defects addressed

1. **Recommendations missing from the export.** `buildFullMarkdownReport` rendered overview, evidence, details, related, other-signals, ecosystem, and cross-session history, but never the Recommendations section that the panel showed via `renderRecommendations`. Copied and saved reports therefore dropped the advice.
2. **Manual save only.** The report reached disk only if the user pressed "Save Report". The request was for the report to persist automatically when the screen opens.
3. **Overview paths were not links.** The log-file path rendered as plain text; there was no link to a saved report.
4. **Latent broken command (fixed in passing).** The Cross-Session History row click handler executed `saropaLogCapture.openLog`, a command that is not registered anywhere, so clicking a history row silently did nothing.

### Changes

- **`signal-report-render.ts`** — added `buildRecommendationsMarkdown(templateId, errorCategory)`, mirroring `renderRecommendations` (including the error-category tailoring) but emitting markdown. Removed the "Save Report" button from the report shell and its click handler; added a delegated click handler for `.overview-file-link` that posts `{ type: 'openFile', uriString, kind }` to the host.
- **`signal-report-markdown.ts`** — wired `buildRecommendationsMarkdown` into `buildFullMarkdownReport`, placed after Other Signals and before Companion Extensions to match the panel's section order.
- **`signal-report-panel.ts`** — sections now render progressively FIRST; `populateSections` returns the log lines and clean-session header it read so the auto-save reuses them instead of reading the log file a second time. `autoSaveReport(state, logLines, cleanHeader)` builds the full markdown from that shared data and writes it to the log directory, returning the saved `vscode.Uri` (or `undefined`, logged, on failure — the panel still renders). After the save, the overview is re-posted with the report link. `openFileFromReport` opens a log link via `saropaLogCapture.openSession` (into the viewer) and a report link via `vscode.open` (in an editor). The history-row handler now uses `saropaLogCapture.openSession` instead of the unregistered `openLog`.
- **`signal-report-overview.ts`** — `OverviewOptions` gained `logFileUri`, `reportFilePath`, `reportFileUri`. The log-file row renders as an `overview-file-link` when a URI is available (falling back to plain text otherwise); a report-file link row renders only when both the report path and URI are present. New `overviewLinkRow` helper escapes the URI into the `data-uri` attribute.
- **`signal-report-styles.ts`** — added `.overview-file-link` styling (uses the `--link` token, underline on hover).
- **`strings-signals.ts`** — added `signals.overview.reportFile`; removed the now-orphaned `signals.shell.saveReport`, `signals.toast.saved`, and `signals.toast.saveFailed` keys.

### First-paint and I/O note

An intermediate version awaited `autoSaveReport` (which reads the log file and builds the full markdown) before rendering any section, defeating the panel's progressive rendering and reading the log file twice per open. The final version renders sections first and reuses the already-read log lines for the save, so first paint is not blocked and the log file is read once on the auto-save path.

### Tests

- `signal-report-render.test.ts` — updated to assert the Save button is ABSENT; added three cases for `buildRecommendationsMarkdown` (known template emits a `## Recommendations` heading, category-tailored advice for `oom`, empty string for unknown template).
- `signal-report-overview.test.ts` — added cases asserting the log-file link renders with `data-kind="log"`, the report link renders with `data-kind="file"` only when both path and URI are present, and the report link is omitted when the URI is missing.
- Result: 45 pass, 0 fail (`node --test` with the vscode stub, on `signal-report-render` + `signal-report-overview`). `npm run check-types`, `npm run compile` (all verify gates, including `verify:l10n-keys`), and eslint on the touched files are clean.

### Known interaction (not changed here)

Reports are written into the configured log directory as `.md` files, a type included in the retention sweep (`file-retention.ts` trashes the oldest tracked files by mtime once `maxLogFiles` is exceeded). The manual save had the same property; auto-saving on every open increases the write frequency, so frequent report opens can push older captured `.log` sessions over the cap sooner. Relocating reports out of the retention-swept set is a design decision left to the owner.
