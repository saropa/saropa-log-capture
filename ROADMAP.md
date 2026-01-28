# Roadmap

Planned features for future releases.

## Tier 4: Differentiators

| # | Feature | Description |
|---|---|---|
| 74 | .slc session bundle | ZIP export containing logs + metadata + annotations + pins |
| 75 | .slc import | Drag-and-drop import, appears in session history |

## Tier 5: Ecosystem

| # | Feature | Description |
|---|---|---|
| 89 | Tail mode | Watch workspace .log files (file watcher, configurable globs) |
| 90 | Remote workspace / SSH | Enterprise environment support |
| 92 | External log service integration | Logz.io, Loki, Datadog export |

---

## Feature Details

### Session Bundle (Tasks 74-75)

Full session portability — not just .log files, but complete sessions with metadata.

**.slc bundle (ZIP) contains:**
- Log file(s) including split parts
- Session metadata JSON (name, tags, timestamps, line count, error count)
- Annotations and pinned entries
- Split metadata (part info, split reasons)

**Import:** Drag-and-drop .slc files to import sessions into history.

### Tail Mode (Task 89)

Extend beyond debug console to watch any .log file in the workspace.

**Features:**
- File watcher on configured glob patterns
- Stream file changes to the viewer
- Configurable: `saropaLogCapture.tailPatterns: ["*.log", "logs/**/*.txt"]`

### Remote Workspace Support (Task 90)

Support for SSH Remote, WSL, and Dev Containers.

### External Log Service Integration (Task 92)

Export sessions to cloud log platforms: Logz.io, Grafana Loki, Datadog.
