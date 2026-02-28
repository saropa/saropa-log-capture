# Run detection and run separator severity bar overlap

**Date:** 2026-02-28  
**Status:** Fixed

## Summary

1. **Run 2 incorrectly detected during normal startup.** The viewer showed "Run 2" in the middle of a single Flutter startup (e.g. after "✓ Built … app-debug.apk"). Run boundaries treated "Built", "Connecting to VM Service", and "Connected to the VM Service" as run starts; they are mid-startup only.
2. **Run separator overlapped the severity bar.** The magenta run separator bar extended to the left and covered the vertical severity/timeline bar.

## Fix

- **run-boundaries.ts:** Only "Launching … in debug/profile/release mode", "Hot restart", and "Hot reload" start a new run. Removed "Built", "Connecting to VM Service", and "Connected to the VM Service" from run-start patterns.
- **viewer-styles-run-separator.ts:** Run separator uses left padding 14.25em (same as log line content) so the bar does not overlap the severity bar; accent border moved to inner so it stays right of the cleared area.
