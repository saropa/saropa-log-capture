# Plan 114 (remaining) — Debug Screenshot Capture follow-ups

## Status: Open — one blocking item (F5 verification)

Feature shipped 2026-07-28 and hardened through 2026-08-05. Full spec:
`plans/history/2026.07/2026.07.28/114_plan-debug-screenshot-capture.md`.
The four finish reports (hardening, before/after diff, the
`_flutter.screenshot`-removal root cause, the profile-mode trigger gap and
timezone-immune replay gate) are archived at
`plans/history/2026.08/2026.08.05/114_plan-debug-screenshot-capture_finish-reports.md`.

Only the items below remain.

## 1. F5 verification of live capture (blocking for release confidence)

**Corrected 2026-09-03.** Earlier revisions of this checklist told the verifier
to confirm `_flutter.screenshot` returns `result.screenshot`. That API was
**removed from modern Flutter** — its removal is the root cause documented in
the second finish report, and the capture path no longer calls it. Verify the
transport chain that replaced it instead.

- [ ] Confirm the VM Service URI resolves — either the `dart.debuggerUris`
      custom event, or the console-banner fallback (pinned to loopback hosts).
      Verify whichever path fires.
- [ ] Confirm the transport probes the VM **once per URI**, then switches
      permanently to `adb exec-out screencap -p` on method-not-found. On a
      modern Flutter SDK the adb path is the expected steady state, not a
      fallback.
- [ ] Confirm PNG-magic validation passes and the capture lands in
      `<base>.screenshots/` with its sidecar entry.
- [ ] Verify the capture self-test writes its verdict line (toggle state, armed
      triggers, adb version, attached devices) on Dart/Flutter session start.
- [ ] Verify the before/after diff block renders in a signal report when
      `onNavigation` is enabled and an error follows a screen entry (canvas heat
      overlay, magenta = changed pixels).
- [ ] Measure capture latency; if >~200 ms, reconsider whether the
      single-in-flight drop policy loses too many triggers.
- [ ] Verify the full chain: error line → PNG → viewer badge → popover → footer
      counter → gallery → signal report strip → timeline event.
- [ ] **Profile-mode path:** confirm a logcat crash line triggers capture and
      that the three replay-detection layers (first-PAUSE, 30s backstop,
      catch-up rate) suppress the startup buffer dump.
- [ ] Non-Flutter debug session: capture silently unavailable, no UI noise.

## 2. Retention: delete screenshot sidecars — FILED AS BUG 046

Moved to `plans/history/2026.09/2026.09.03/bug_046_screenshot-sidecars-survive-log-deletion.md`. It is a
defect (unbounded disk growth), not planned work. Sequence it with or before
bug 012 — fixing retention first turns a static leak into a growing one.

## 3–4. Deferred

Both moved to `plans/deferred/screenshot-capture-deferred-items.md`:
multi-session correlation (needs a real use case) and image downscaling (needs
an image dependency, so a blast-radius decision).
