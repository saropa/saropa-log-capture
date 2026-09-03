# Deferred — Debug screenshot capture

Carried out of `plans/114_plan-debug-screenshot-capture_remaining.md` on
2026-09-03. Neither item is scheduled; both need a trigger before they are worth
building.

## Multi-session correlation

`getLatestVmServiceWsUri()` returns the most recently announced URI with no
correlation to the log line that triggered the capture. With two Flutter
sessions live at once, a capture can screenshot the wrong app — the limitation
is documented in `vm-service-uri.ts` and pinned by a test as a deliberate
single-session constraint.

Correlating properly needs a debug-session-id → `LogSession` mapping threaded
through `LineData`.

**Deferred until:** someone actually debugs two Flutter apps at once and is
bitten by it. Threading session identity through the line pipeline is real
surface area to buy a case nobody has reported.

## Image downscaling

Captures are saved at full resolution — live verification recorded a
2,027,510-byte PNG and later ~1.14 MB ones. The original plan proposed a
≤1280px resize.

**Deferred until:** an owner approves an image dependency. Resizing needs one,
which is a blast-radius decision requiring explicit permission. All inline
data-URI reads are already capped at 10 MB, so this is a disk-footprint nicety,
not a correctness issue.

Note bug 046 (sidecars survive log deletion) addresses the disk-growth problem
from the other end — deleting the images with their log — and is the cheaper
fix. Do that first; it may remove the appetite for downscaling entirely.
