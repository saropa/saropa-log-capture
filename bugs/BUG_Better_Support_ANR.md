REF log:d:\src\contacts\reports\20260714\20260714_094848_contacts.log

# Better Support for ANR / DevTools-Inspector Noise in Captured Logs

## 1. Scope of this file (read first)

This plan covers only what **Saropa Log Capture** (the VS Code extension) can do. The
extension is a passive consumer of the debug stream VS Code hands it via DAP `output`
events. It has **no device access**: it cannot call `ActivityManager.getHistoricalProcessExitReasons()`
/ `ApplicationExitInfo`, cannot read `/data/anr/traces.txt`, and does not run `adb`. Therefore
genuine ANR **trace extraction and debug-state suppression are app-side concerns**, not
extension concerns.

- **App-side work** (Flutter/Android telemetry SDK: `isDebuggerConnected()`, `FLAG_DEBUGGABLE`,
  `kDebugMode`/`kProfileMode` gating, `ApplicationExitInfo`, `StrictMode`) lives in the Saropa
  Contacts repo: **`D:\src\contacts\bugs\BUG_anr_telemetry_debug_suppression.md`**. Do not
  duplicate it here.
- **Extension-side work** (this file): recognize and correctly classify ANR- and
  inspector-related text that *already appears* in the captured stream, so the viewer's
  severity filters, timeline, and error-surfacing behave sensibly.

## 2. What already exists in this repo

Both mechanisms below are implemented; this plan reconciles them rather than proposing new
infrastructure.

- **Per-line ANR recognition** — `anrPattern` / `isAnrLine()` in
  [level-classifier.ts](../src/modules/analysis/level-classifier.ts) match `anr` /
  `application not responding` / `input dispatching timed out`. Mirrored in the webview
  classifier [viewer-level-classify.ts](../src/ui/viewer-search-filter/viewer-level-classify.ts).
- **Session-level ANR risk scoring** — `scanAnrRisk()` in
  [anr-risk-scorer.ts](../src/modules/analysis/anr-risk-scorer.ts) predicts ANR risk from
  choreographer warnings, GC pauses, jank, dropped frames, and the ANR keyword.

**Reconciliation done:** the ANR keyword regex was duplicated verbatim in both files. The
scorer now imports the single `anrPattern` from `level-classifier.ts` so the two cannot drift.

## 3. DevTools Inspector "ghost errors" (the actionable extension fix)

### 3.1 The artifact
When the Flutter DevTools Layout Explorer interrogates the widget tree asynchronously, a widget
can be unmounted between frames. The framework then throws `Null check operator used on a null
value` from `WidgetInspectorService`, originating from the
`ext.flutter.inspector.getLayoutExplorerNode` service extension. This is developer-tooling noise,
never an application fault — but it prints through the same channels as real errors.

In the captured stream this reddens under the Errors filter (the classifier's strict/loose
`Null check operator` alternative promotes it to `error`) and can trip a logging breakpoint,
polluting the viewer with a non-error.

### 3.2 What the extension can and cannot do
The classifier is **per-line** — it has no cross-line stack context. So it can de-emphasize the
*stack frame that carries the inspector signature* (`getLayoutExplorerNode` /
`ext.flutter.inspector.`), but it cannot, on its own, suppress the bare `Null check operator used
on a null value` *header* line that precedes the frame, because that header carries no inspector
signature. The heuristic's "application absence" criterion (stack must not contain the host
package) is likewise a whole-stack test the per-line path cannot perform.

Full block-level suppression (dropping the header + all frames of an inspector-originated stack)
would belong in the stack-grouping layer ([viewer-thread-grouping.ts](../src/ui/viewer/viewer-thread-grouping.ts)),
which already correlates a stack under its header. That is a larger change and is deferred; see
§5.

### 3.3 Implemented behavior
`level-classifier.ts` and its webview mirror gain an `inspectorArtifactPattern`
(`getLayoutExplorerNode` or `ext.flutter.inspector.`). A line matching it classifies as `debug`,
which:
- keeps it off the Errors filter and out of the actionable-timeline set (`isActionableLevel`
  excludes `debug`),
- runs **before** the `stderr → error` force, because Flutter prints framework exceptions to
  stderr, so an inspector artifact on stderr would otherwise be forced to `error`.

The tokens are unambiguous DevTools internals: no application legitimately names a method
`getLayoutExplorerNode`, and `ext.flutter.inspector.` is the inspector service-extension RPC
namespace. So the false-positive risk against genuine app errors is negligible.

## 4. Acceptance

- A line containing `ext.flutter.inspector.getLayoutExplorerNode` (or a bare
  `getLayoutExplorerNode` frame) classifies as `debug`, not `error`, in both the extension and
  webview classifiers (parity test).
- An inspector artifact arriving on DAP category `stderr` still classifies as `debug`.
- The ANR keyword regex has one definition, shared by the classifier and the risk scorer.

## 5. Deferred (not in this change)

- **Block-level inspector suppression** in `viewer-thread-grouping.ts`: tag a whole stack group
  as an inspector artifact when any frame matches the signature AND the stack lacks the host
  package name, then de-emphasize the group's header line too. Requires the host package name to
  be known to the viewer, which it currently is not.
- **ApplicationExitInfo ingestion**: only viable if the app writes ANR traces into its own log
  output (which the extension then captures as ordinary text). Pure device-side APIs remain
  out of reach for a VS Code extension.
