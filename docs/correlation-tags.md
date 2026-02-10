# Correlation Tags

Correlation tags are auto-extracted labels that help you find related log sessions. They identify **source files** and **error classes** that appear in your logs.

## What they look like

Tags follow a `type:value` pattern:

- `file:handler.dart` — the source file `handler.dart` appears in stack traces or references
- `error:SocketException` — the error class `SocketException` was thrown

A session can have up to 20 tags, ranked by how often each entity appears.

## How they're generated

When a log session is saved, the extension scans up to 5,000 lines for recognizable tokens using `correlation-scanner.ts`. It looks for:

1. **Source file references** — filenames in stack traces, import paths, `at file:line` patterns
2. **Error class names** — exception types like `FormatException`, `HttpException`, `NullPointerException`

Tags are stored in a `.meta.json` sidecar file next to each log file and persist across VS Code restarts.

## Filtering sessions by tag

1. Open the **Project Logs** panel (click the folder icon in the icon bar)
2. Click the **Tags** toggle button in the toolbar
3. A chip bar appears showing all correlation tags across your sessions, with a count of how many sessions contain each tag
4. Click a chip to deselect it — sessions without any selected tags are hidden
5. Use **All** / **None** buttons to quickly toggle all chips

This is useful when you have many sessions and want to find the ones that reference a specific file or error type.

## Rescanning tags

If a session was saved before correlation scanning was added, or if you want to refresh the tags:

1. Right-click a session in the Project Logs panel
2. Select **Rescan Tags**

The extension will re-scan the file and update the stored tags.
