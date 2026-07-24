# Bug 001 report accuracy fix

The bug report `bugs/bug_001_blastbufferqueue-write-spam.md` contained inaccurate descriptions of the existing write-path suppression mechanisms. The report named a non-existent "Repeated log #N" dedupe mechanism, overstated the absence of write-path guards, and described Option 2 in terms of a mechanism that is currently bypassed without noting the bypass.

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
