# Wow feature specs

Full design documents for **Consider for Wow** items from [ROADMAP §7](../../ROADMAP.md#7-recommendations-prioritized) and for selected roadmap features (e.g. Tier 5).

| # | Feature | Spec | Summary |
|---|---------|------|---------|
| 1 | AI "Explain this error" | [AI_EXPLAIN_ERROR.md](AI_EXPLAIN_ERROR.md) | Right-click log line(s) → Explain with AI (VS Code Language Model API); dedicated panel or view with markdown explanation. |
| 2 | Session replay | [SESSION_REPLAY.md](SESSION_REPLAY.md) | Replay a loaded log with optional timing (elapsed deltas); play/pause/speed/seek. |
| 3 | One-click export to Loki/Grafana | [EXPORT_LOKI_GRAFANA.md](EXPORT_LOKI_GRAFANA.md) | Push current session to Grafana Loki when URL (and optional auth) is configured; optional "Open in Grafana" link. |
| 4 | Remote / SSH, WSL, Dev Containers (Task 90) | [REMOTE_SSH_WSL_DEVCONTAINERS.md](REMOTE_SSH_WSL_DEVCONTAINERS.md) | Support for Remote - SSH, WSL, and Dev Containers: extension runs in workspace (remote); capture, storage, and viewer work in remote context. |

These are **proposed** features. Implementation order and scope may change; each spec includes phases and success criteria to guide development.
