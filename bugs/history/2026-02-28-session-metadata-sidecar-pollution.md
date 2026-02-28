# Session metadata sidecar pollution (fixed)

**Date:** 2026-02-28

## Summary

The extension created a `.meta.json` file next to every tracked file (logs and, by default, `.md` files) in the log directory or any folder used as "Project Logs" root. That polluted the tree, caused accidental commits, and was confusing when viewing non-log folders (e.g. `bugs/` with markdown).

## Fix

- **Central store:** All session metadata is now stored in a single dot-prefixed file per workspace: `<logDir>/.session-metadata.json` (e.g. `reports/.session-metadata.json`). No per-file sidecars.
- **Migration:** On first opening Project Logs (or when viewing a folder that had sidecars), all `.meta.json` files in that directory are migrated into the central store and the sidecar files are deleted. Override folders (e.g. `bugs/`) merge into the same central file (configured log dir) so keys stay workspace-relative.
- **Rename/organize:** Folder organizer and rename now update the central store after moving/renaming the file so metadata is not lost.
