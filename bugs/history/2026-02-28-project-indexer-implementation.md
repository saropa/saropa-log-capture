# Project Indexer — Implementation Summary

**Date:** 2026-02-28  
**Status:** Implemented per `docs/PLAN_PROJECT_INDEXER.md`

## Summary

Lightweight, delta-aware project indexer for docs/bugs/root and completed log sessions. Index stored in `.saropa/index/`; Crashlytics cache moved to `.saropa/cache/crashlytics/`. Reports index is built from the central `reports/.session-metadata.json` (no per-file sidecars). Docs scanner uses index-first lookup when enabled; analysis panel doc matches show section heading when available. Inline updates on session finalize and trash/restore; file watchers mark sources dirty for lazy rebuild.

## Fixes During Review

- **Reports index source:** Build from central `.session-metadata.json` (keys = workspace-relative log paths), not from `.meta.json` sidecars (sidecars were migrated and removed in 2.0.16).
- **Race condition:** Only one concurrent background build; `buildPromise` is cleared in `finally` so the next stale check can start a new build.
