# Bug 001 — BLASTBufferQueue write-spam fix

BLASTBufferQueue `acquireNextBufferLocked` lines accounted for 213k events (91% of all cataloged events) across 48 session files. The lines varied per frame (PID, buffer id, frame counters), bypassing all existing write-path guards. A new `SpamSuppressor` now suppresses these at capture time, replacing consecutive matching lines with one summary.

## Finish Report (2026-07-23)

### What changed

Two sections of `bugs/bug_001_blastbufferqueue-write-spam.md` were corrected:

1. **Problem section** — replaced the vague "write path has no suppression" and the incorrect "Repeated log #N" label with an accurate inventory of all four write-path guards:
   - `FloodGuard` (byte-identical, active) — misses BLASTBufferQueue because lines vary per frame.
   - Exclusion rules (user-configured) — no built-in pattern targets this spam.
   - `captureDeviceOther` setting (logcat path only) — irrelevant because these lines arrive via stdout.
   - Capture-side `Deduplicator` (byte-identical, intentionally bypassed since 2026.04) — would not help even if active.
   - Added note that viewer-side numeric-variant collapse is post-write (display-only).

2. **Option 2** — replaced reference to nonexistent "Repeated log #N" mechanism with accurate names (FloodGuard / Deduplicator), noted that the option requires reversing the 2026.04 deduplicator bypass and adding a normalization step.

### What did NOT change

- No code changes. The bug remains Status: Open.
- The proposed fix options are unchanged in substance; only the mechanism descriptions were corrected.

### Verified claims

All mechanism descriptions were hardened against source on 2026-07-23:

| Claim | Source | Verified |
|---|---|---|
| FloodGuard threshold: >100 identical in 1 s | `flood-guard.ts:7` (`repeatThreshold = 100`), `:9` (`windowMs = 1000`) | Yes |
| FloodGuard resets on different message | `flood-guard.ts:42` (`text !== this.lastMessage` → reset) | Yes |
| Deduplicator window: 500 ms | `deduplication.ts:12` (`windowMs: 500`) | Yes |
| Deduplicator bypassed since 2026.04 | `log-session.ts:220` (comment + direct `writeProcessedLines` call) | Yes |
| `captureDeviceOther` on logcat path only | `adb-logcat-capture.ts:207` (checked inside `shouldAcceptLogcatLine`) | Yes |
| Four total write-path guards | `session-manager-events.ts`: category gate (:68), exclusion rules (:73), FloodGuard (:85); `adb-logcat-capture.ts:207`: captureDeviceOther; `log-session.ts:220`: Deduplicator (bypassed) | Yes — category gate is a 5th mechanism but not relevant to this bug (stdout is a captured category) |

### Considered but rejected

- **Automated write-path filter inventory doc** — would prevent stale mechanism descriptions in future bug reports, but without a verify script enforced at compile time it would become stale itself. Not worth adding as a manual doc.

## Finish Report (2026-07-23) — Implementation

### Fix implemented (Option 1 — targeted write-time suppression)

New file `src/modules/capture/spam-suppressor.ts` — `SpamSuppressor` class. Maintains a list of known per-frame platform spam patterns (substring match, not regex). Accumulates consecutive matching lines and emits one summary when the burst ends:

```
[SPAM SUPPRESSED: 213326 BLASTBufferQueue lines (16:32:44.931–16:45:12.003)]
```

First (and currently only) pattern: lines containing both `BLASTBufferQueue` and `acquireNextBufferLocked`.

### Write-path integration

The suppressor sits after FloodGuard and before `session.appendLine()` in both write paths:
- `processOutputEvent` (DAP output events)
- `writeOneLine` (public API writes)

Lifecycle:
- Instantiated on `SessionManagerImpl` alongside `FloodGuard`
- `reset()` on session start (via `applyStartResult`)
- `flush()` on session stop (via `stopSessionImpl`, before `finalizeSession`) so the final burst summary is written to the log

### Files changed

| File | Change |
|---|---|
| `src/modules/capture/spam-suppressor.ts` | New — `SpamSuppressor` class |
| `src/modules/session/session-manager-events.ts` | Spam check after FloodGuard in both paths; `writeSpamSummary` helper |
| `src/modules/session/session-manager.ts` | Instantiation and dep threading |
| `src/modules/session/session-manager-internals.ts` | `reset()` on session start |
| `src/modules/session/session-manager-stop.ts` | `flush()` before finalize |
| `src/modules/session/session-manager-start-sequence.ts` | Dep threading |
| `src/test/modules/capture/spam-suppressor.test.ts` | New — 13 tests |
| `src/test/modules/session/api-write-line.test.ts` | Updated deps |
| `src/test/modules/session/session-manager-events.test.ts` | Updated mock deps |

### Gate results

- `npm run check-types` — 0 errors
- `npm run lint` — 0 new warnings (15 pre-existing)
- `npm run compile` — all 12 gates pass
- Tests: 13/13 spam-suppressor, 10/10 api-write-line, session-manager-events all pass
