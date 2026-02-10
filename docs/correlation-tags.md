# Correlation Tags

Correlation tags are auto-extracted labels that help you find related log sessions. They identify **source files** and **error classes** mentioned in your logs.

> Correlation tags are one of three tag types. Sessions can also have **manual tags** (user-applied) and **auto-tags** (rule-based). This document covers correlation tags only.

## What they look like

Tags follow a `type:value` pattern:

- `file:handler.dart` — the filename `handler.dart` was referenced in a stack trace
- `error:SocketException` — the exception class `SocketException` was thrown

A session can have up to 20 tags. The top 20 are selected by frequency (most-mentioned first), then displayed in alphabetical order.

## How they're generated

When a debug session ends, the extension automatically scans up to 5,000 lines of the log file for recognizable tokens. It looks for:

1. **Source file references** — filenames referenced in stack traces, import paths, and `at file:line` patterns
2. **Error class names** — exception types like `FormatException`, `HttpException`, `NullPointerException`

Tags are stored in a `.meta.json` sidecar file next to each log file and persist across VS Code restarts.

## Filtering sessions by tag

1. Open the **Project Logs** panel
2. Click the **Tags** button (filter icon) in the toolbar
3. A chip bar appears showing correlation tags across your sessions, with a count of how many sessions contain each tag (up to 20 chips; additional tags show a "+N more" indicator)
4. Click a chip to deselect it — a session stays visible if it matches **any** of the remaining selected tags
5. Use **All** / **None** buttons to quickly select or deselect all chips

This is useful when you have many sessions and want to find the ones that reference a specific file or error type.

## Rescanning tags

Tags are generated automatically when a session ends. For older sessions saved before this feature existed, or to refresh tags after a scanner update:

1. Right-click a session in the Project Logs panel
2. Select **Rescan Tags**

The extension will re-scan the file and update the stored tags.
