# Plan 114 (remaining) — Debug Screenshot Capture follow-ups

## Status: Open

Carried over from plan 114 (implemented 2026-07-28; full spec and Finish Report archived at
`plans/history/2026.07/2026.07.28/114_plan-debug-screenshot-capture.md`). The feature is
shipped and unit-tested; these are the verification and hardening items that remain.

## 1. F5 verification of live capture (blocking for release confidence)

Unit tests cover triggers/coalescing/parsing, but `_flutter.screenshot` has never been
called against a real Flutter debug session from this extension. Run the original plan's
investigation checklist in the Extension Development Host:

- [ ] Confirm the `dart.debuggerUris` custom event fires and `vmServiceUri` converts to a connectable ws URI (`toVmServiceWsUri`).
- [ ] Confirm `_flutter.screenshot` returns `result.screenshot` (base64 PNG) with empty params on a `flutter run --debug` session; note whether it captures the Flutter surface only or full device frame.
- [ ] Measure capture latency; if >~200ms consider whether the single-in-flight drop policy loses too many triggers.
- [ ] Verify the full chain: error line → PNG in `<base>.screenshots/` → viewer badge → popover → footer counter → gallery → signal report strip → timeline event.
- [ ] Non-Flutter debug session: capture silently unavailable, no errors or UI noise.

## 2. Retention: delete screenshot sidecars with their log

File retention soft-trashes logs via metadata and hard-delete paths (trash commands,
permanent delete) do not remove `<base>.screenshots/` or `<base>.screenshots.json`.
Wire sidecar-directory removal into whatever path physically deletes a log file, and
add a verification case: deleting a log removes its screenshots.

## 3. Multi-session correlation (deferred until real use case)

`getLatestVmServiceWsUri()` returns the most recently announced URI with no correlation
to the triggering log. With two Flutter sessions live at once a capture can screenshot
the wrong app (documented in `vm-service-uri.ts`). Correlating needs a debug-session-id →
LogSession mapping threaded through LineData.

## 4. Optional: image downscaling (needs go/no-go)

Full-resolution PNGs are saved; the original plan's ≤1280px resize needs an image
dependency (blast-radius decision). All inline data-URI reads are capped at 10 MB, so
this is a disk/size nicety, not a correctness issue. Requires explicit owner approval
before adding any dependency.
