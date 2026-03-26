# VS Code Output panel vs Saropa Log Capture integrations

**Status:** Deferred / reference analysis  
**Context:** The VS Code (and Cursor) **Output** view lists many channels (Git, language servers, Prettier, extension-specific logs, etc.). This document records whether those streams can be captured into the Saropa log viewer at user discretion, grounded in **this repository** and the **public VS Code extension API** (`@types/vscode` as depended on by the project).

## Summary

- **Capturing every arbitrary Output dropdown channel automatically** (the same data the built-in Output view shows for Git, Python Language Server, third-party extensions, etc.) is **not** available through the documented extension API: you only receive `OutputChannel` instances for channels **this extension creates**; there is no supported way to enumerate all channels or subscribe to other extensions’ output buffers.
- **This codebase** already implements a discretionary integration model (`saropaLogCapture.integrations.adapters`) with many built-in providers; **none** of them integrate with foreign VS Code Output channels. The closest parallels are **Integrated Terminal** capture (different surface than Output) and **external file log** tailing (user-configured paths).
- **Possible future work** must be honest about the gap: e.g. new adapters for **known on-disk logs**, cooperation via **`registerIntegrationProvider`**, or manual export/import—not “mirror the whole Output dropdown.”

## What existing integrations do (this repo)

Built-in providers are registered in `src/activation-integrations.ts` (packages / lockfile, build/CI, git, environment, test results, code quality, coverage, crash dumps, Windows events, Docker, performance, terminal, Linux logs, external logs, security, database, HTTP, browser DevTools, Drift Advisor).

User **opt-in** is via `saropaLogCapture.integrations.adapters` (`integrationsAdapters` on the resolved config object). The viewer and Quick Pick UI list adapters in `src/modules/integrations/integrations-ui.ts` (`INTEGRATION_ADAPTERS`).

Session start (`src/modules/session/session-lifecycle-init.ts`) only starts:

- **Terminal capture** when `integrationsAdapters` includes `terminal`.
- **External log tailers** when `integrationsAdapters` includes `externalLogs` and `integrations.externalLogs.paths` is non-empty.

### Terminal adapter (not Output panel)

`src/modules/integrations/terminal-capture.ts` subscribes to **`onDidWriteTerminalData`** on `vscode.window` (treated as a **proposed** API). It captures **Integrated Terminal** stream data, not text appended to arbitrary Output channels. If the API is missing or disallowed, capture is skipped (try/catch and capability checks).

### External logs adapter (files, not Output buffers)

`src/modules/integrations/providers/external-logs.ts` and `src/modules/integrations/external-log-tailer.ts` tail or snapshot **files** configured under `integrations.externalLogs`. If a tool writes logs to disk and the user adds those paths, that data can land in session sidecars—but that is **not** the same as reading VS Code’s in-memory Output channel store.

### No Output-channel subscriber in tree

A repository-wide search shows `createOutputChannel` / `OutputChannel` usage for **Saropa’s own** logging and diagnostics only (`src/extension.ts`, `src/modules/misc/extension-logger.ts`, `src/modules/crashlytics/crashlytics-diagnostics.ts`, etc.). There is no provider id or module that subscribes to other extensions’ output.

## VS Code public API (types in this repo)

`node_modules/@types/vscode/index.d.ts` defines `OutputChannel` as an object you obtain via `window.createOutputChannel`, with `append`, `appendLine`, `replace`, `clear`, `show`, `hide`, `dispose`, and a read-only `name`. There is **no** API in that definition to:

- list every output channel that appears in the workbench Output dropdown, or  
- receive events when **another** extension appends to **its** channel.

`LogOutputChannel` extends `OutputChannel` with log-level helpers for **your** log channel, not remote subscription to others.

## Interpretation for product / future specs

| Approach | Feasibility |
|----------|-------------|
| User toggles an adapter and **all** Output channels are streamed into the session | **Not** supported by public API as of the VS Code typings this project uses. |
| User enables **externalLogs** and adds paths to tools’ log files (including VS Code user-data log files where applicable) | **Already supported** pattern; coverage depends on what is actually written to disk and path portability. |
| User enables **terminal** adapter | **Already supported** for Integrated Terminal only; depends on proposed API availability. |
| Third-party extension voluntarily pushes data via `registerIntegrationProvider` or shared files | **Possible**; fits existing extension API surface. |
| Relying on internal/workbench-only hooks or undocumented APIs | Fragile, often marketplace-incompatible; not recommended as a committed design without explicit risk acceptance. |

## Deferred decision

Treat **“integrate all VS Code Output channels”** as **deferred** until either:

1. VS Code exposes a supported, extension-facing way to subscribe to or export arbitrary channel content (unlikely to cover all historical buffer semantics), or  
2. The product scopes a feature to **documented** sources only (files, terminal, debug console where already modeled, cooperative providers).

## References (paths in this repo)

- `src/activation-integrations.ts` — provider registration
- `src/modules/session/session-lifecycle-init.ts` — terminal + external log tailer start
- `src/modules/integrations/terminal-capture.ts` — terminal stream capture
- `src/modules/integrations/providers/external-logs.ts` — file-based logs
- `src/modules/integrations/integrations-ui.ts` — adapter list and user-facing ids
- `node_modules/@types/vscode/index.d.ts` — `OutputChannel` / `LogOutputChannel` contract
