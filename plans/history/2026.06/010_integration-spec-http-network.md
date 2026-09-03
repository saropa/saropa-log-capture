# Spec: HTTP and Network Integration

**Adapter id:** `http`  
**Status:** Partial — provider + inline context section + dedicated "Related Requests" popover shipped; only the Deferred items remain.
**Full design:** TBD — not yet created

## Goal

Correlate log lines with HTTP requests by request ID or time; show "Related requests" in viewer.

## Config

- `saropaLogCapture.integrations.adapters` includes `http`
- `saropaLogCapture.integrations.http.requestIdPattern`: regex to extract request ID from a log line
- `saropaLogCapture.integrations.http.requestLogPath`: path to HTTP request log file (JSON lines)
- `saropaLogCapture.integrations.http.harPath`: path to HAR file (alternative to request log)
- `saropaLogCapture.integrations.http.timeWindowSeconds`: correlation window when no request ID matches (default: 5)
- `saropaLogCapture.integrations.http.maxRequestsPerSession`: cap requests indexed per session (default: 200)

## Implementation

- **Provider:** `onSessionEnd`: read/tail requestLogPath (JSON lines) or parse HAR; build requestId → requests; write sidecar + meta. Request ID from log line via regex.
- **Viewer:** "Related requests" panel when line selected; show URL, method, status, duration. Optional "Attach HAR" command.
- **Performance:** Cap requests; filter HAR by time. No work at session start.
- **Status bar:** "HTTP" when contributed at end.

## UX

- No spinner at start. Viewer: "Related requests" empty until selection or "No requests." Optional badge on lines with request ID.

## Deferred

- Auto-detect HAR from browser DevTools export
- Request/response body preview (with size cap and redaction)
- Latency histogram in Performance panel
- Group requests by endpoint pattern

## Finish Report (2026-06-10)

This work will be reviewed by another AI.

**Scope:** (B) VS Code extension (TypeScript — webview popover script + host handler + message wiring + l10n). No Dart/Flutter app code.

**What shipped — the dedicated "Related Requests" popover.** The HTTP provider (`.requests.json` sidecar) and the *inline* HTTP section inside the integration-context popover already shipped. The remaining deferred piece was the dedicated popover parallel to database's "Related Queries". It now exists end to end:
- **Context menu:** new **View Related Requests** item (`data-action="show-related-requests"`) → posts `showRelatedRequests` with line index, timestamp, and plain line text.
- **Host:** `handleRelatedRequestsRequest` correlates by request ID (when `integrations.http.requestIdPattern` matches the line) else by the `contextWindowSeconds` time window, and posts `relatedRequestsData` with the HTTP entries (no cap). It and the database sibling now share one `postRelatedContext` helper, so the two correlation paths can't drift apart.
- **Webview:** `getRelatedRequestsPopoverScript()` builds the popover (method, URL, status with error/redirect coloring, duration), per-row copy and Copy All, Escape/click-out close, and closes the other popovers on open (and they close it).

**Refactor (to honor the 300-line cap my additions would have broken):**
- Moved the related-popover handlers into a new `context-related-handlers.ts`; `context-handlers.ts` now exports the shared `getSessionCenterTime` + `extractRequestIdFromLine` helpers it consumes.
- Extracted the minimap/scrollbar toggle rows into `viewer-context-menu-scroll-toggles.ts` (re-exported from `viewer-context-menu-html.ts` for compatibility) so the menu HTML file stays under the cap.

**Files changed/created:**
- `src/ui/viewer-context-menu/viewer-context-popover-integration-sections.ts` — `getRelatedRequestsPopoverScript()`; related-queries popover also closes the requests popover.
- `src/ui/viewer-context-menu/viewer-context-popover-script.ts` — concatenate the new script; `showContextPopover` closes the requests popover.
- `src/ui/viewer-context-menu/viewer-quality-popover-script.ts` — `showQualityPopover` closes the requests popover.
- `src/ui/viewer-context-menu/viewer-context-menu-html.ts` — new menu item; toggle rows extracted.
- `src/ui/viewer-context-menu/viewer-context-menu-scroll-toggles.ts` — **new** (extracted toggle rows).
- `src/ui/viewer-context-menu/viewer-context-menu-line-actions.ts` — `show-related-requests` action.
- `src/ui/shared/handlers/context-related-handlers.ts` — **new** (related-X handlers + shared loader).
- `src/ui/shared/handlers/context-handlers.ts` — export shared helpers; drop the moved code.
- `src/ui/shared/viewer-panel-handlers.ts` — re-export both related-X handlers from the new module.
- `src/ui/provider/viewer-message-handler-panels.ts` — `showRelatedRequests` dispatch case.
- `src/l10n/strings-webview-b.ts`, `src/l10n/strings-viewer-g.ts` — new keys.
- `src/test/ui/viewer-related-requests-popover.test.ts` — **new** (14 cases mirroring related-queries).
- `plans/reference/webview-incoming-message-types.md`, `plans/reference/webview-outbound-message-types.md` — regenerated catalogs.
- `CHANGELOG.md` — `[Unreleased]` Added entry.

**Tests:** related-requests popover 14 passing; related-queries 14 passing (no regression from the added close-calls); context-handlers gate 6 passing. `npm run check-types` clean; `npm run lint` introduces **no** new warnings (the 6 pre-existing warning files are untouched); `npm run compile` passes all verify gates including the regenerated webview catalogs.

**Outstanding:** the four Deferred items above (HAR auto-detect, body preview, latency histogram, endpoint grouping) remain unbuilt by design. Plan left active for them.

**Finish report appended:** plans/010_integration-spec-http-network.md
