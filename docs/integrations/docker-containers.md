# Integration: Docker and Containers

## Problem and Goal

When the debuggee runs **inside a container** (Docker, Podman) or when the app depends on **containerized services**, logs and context are split: the Debug Console may show the app’s output, while **container logs** (stdout/stderr of the container), **image digest**, and **runtime info** (env, mounts, network) live in Docker. Correlating them helps with "which image was this?" and "what did the container log before the crash?" This integration attaches **container metadata and optional container log streams** to the session so that the header or a panel shows image, container ID, and optionally the container’s own logs for the same time window.

**Goal:** (1) **Detect container context:** If the debug session is running inside a container (e.g. "attach to container" or "run in container" launch), or if the launch config indicates a container (e.g. `docker run` in preLaunchTask), capture **container ID**, **image name and digest**, and **inspect metadata** (env, entrypoint, user). (2) **Container logs:** Optionally capture the **container’s stdout/stderr** for the session time range (e.g. `docker logs <id> --since <start> --until <end>`) and store as sidecar. (3) **Display:** Add container summary to context header; viewer can show "Container" tab with logs and link to "Inspect" (copy JSON or open Docker extension).

---

## Data Sources

| Source | Data | How to get it |
|--------|------|---------------|
| **Launch config** | docker run, docker-compose service name, containerId | Parse launch.json or inspect running containers matching project |
| **Docker CLI** | docker ps, docker inspect, docker logs | Run `docker` (or `podman`) in child_process; parse JSON/text |
| **Docker API** | Same data via socket or HTTP | Optional: connect to Docker socket for list/inspect/logs; more control, more code |
| **WSL2 / remote** | Docker may be in WSL or remote host | CLI might be `docker` from PATH (forwarded); document DOCKER_HOST |

**Recommended:** Use **Docker CLI** (`docker ps`, `docker inspect`, `docker logs`) so we don’t depend on socket path or API version. User must have Docker in PATH. Support **Podman** via config (e.g. `containerRuntime: "podman"`).

---

## Integration Approach

### 1. When to collect

- **Session start:** If `saropaLogCapture.docker.enabled`, try to infer container context: (a) From launch config: e.g. `"containerId": "abc123"` or `"dockerOptions": { ... }` or preLaunchTask that runs docker. (b) From running containers: list containers (e.g. `docker ps`), filter by label or name pattern (e.g. project name); if exactly one matches, use it. (c) User config: `containerId` or `containerName` in settings for this workspace. Once we have container ID, run `docker inspect <id>` and optionally `docker logs --since 0 <id>` (then we tail until session end).
- **Session end:** Run `docker logs <id> --since <sessionStart> --until <sessionEnd>` (or use ISO timestamps if supported) and write to sidecar `basename.container.log`. If we already tailed from start, we have the buffer; flush it.

### 2. What to store

- **Header:** `Container:    abc123 (image: myapp:latest@sha256:...)` and `Image:        myapp:latest`. Optional: `Runtime:      docker` and one line of env (e.g. `ENV: NODE_ENV=development`).
- **Sidecar:** `basename.container.log` — raw container stdout/stderr for the session window. Optional: `basename.container-inspect.json` — full `docker inspect` output (can be large; make it optional).
- **.meta.json:** `containerId`, `image`, `imageId` (digest), `runtime` (docker/podman).

### 3. Viewer

- "Container" tab when sidecar exists; show container log (same as Terminal/External). Optional: "Inspect" button that copies inspect JSON or opens Docker extension view.

---

## User Experience

### Settings (under `saropaLogCapture.docker.*`)

| Setting | Type | Default | Description |
|--------|------|--------|-------------|
| `enabled` | boolean | `false` | Enable container context and log capture |
| `runtime` | `"docker"` \| `"podman"` | `"docker"` | CLI command name |
| `containerId` | string | `""` | Override: container ID or name (if not inferrable from launch) |
| `containerNamePattern` | string | `""` | Regex to match container name from `docker ps` (e.g. project name) |
| `captureLogs` | boolean | `true` | Capture container logs for session time range to sidecar |
| `includeInspect` | boolean | `false` | Save full docker inspect to sidecar (large) |
| `maxLogLines` | number | `20000` | Cap container log lines |

### Commands

- **"Saropa Log Capture: Set container for this workspace"** — Quick input or pick from `docker ps` to set containerId.
- **"Saropa Log Capture: Open container log for this session"** — Open sidecar or Container tab.

### UI

- **Header:** Container ID, image, optional runtime.
- **Viewer:** "Container" tab with container log content.

---

## Implementation Outline

### Components

1. **Container discovery**
   - **From launch config:** Read `configuration` in SessionContext; look for `containerId`, `containerName`, or custom property. If present, use it.
   - **From docker ps:** Run `docker ps --format '{{.ID}} {{.Names}} {{.Image}}'` (or equivalent for podman); parse; filter by `containerNamePattern` or workspace folder name. If single match, use that ID.
   - **From settings:** Use `saropaLogCapture.docker.containerId` if set.
   - Return `containerId` or undefined. Do not throw; log and return undefined on error.

2. **Inspect and header**
   - If containerId: `docker inspect <id>` (JSON); parse and extract: Id, Config.Image, Image (digest), Config.Env (optional), State.StartedAt. Append to SessionContext (e.g. `containerInfo?: ContainerInfo`) and in `generateContextHeader` add lines.

3. **Log capture**
   - **Option A:** At session end, run `docker logs <id> --since <sessionStartIso> --until <sessionEndIso>`. Check Docker CLI for exact timestamp format. Write stdout to sidecar.
   - **Option B:** At session start, run `docker logs -f <id>` and stream to buffer; at session end stop and flush. Prefer A to avoid long-running process; if Docker doesn’t support --until, use B with timeout.
   - Write to `basename.container.log` in session folder. Respect maxLogLines (trim from start if needed).

4. **Viewer**
   - When sidecar `basename.container.log` exists, add "Container" tab; load and display (same as Terminal/External).

5. **Podman**
   - Same commands: `podman ps`, `podman inspect`, `podman logs`. Use `runtime` setting to choose executable name.

### Edge cases

- **No container:** Discovery returns undefined; skip all Docker logic; no header lines, no sidecar.
- **Multiple containers:** If pattern matches multiple, take first or prompt user (simplest: take first and log "multiple matches, using X").
- **Docker not in PATH:** Log and skip; do not fail session.

---

## Configuration Summary

- **Extension settings:** `saropaLogCapture.docker.*` as above.
- **Launch config:** Document optional `containerId` / `containerName` in launch.json for attach scenarios.

---

## Risks and Alternatives

| Risk | Mitigation |
|------|------------|
| Docker not running | Graceful skip; log message |
| Permission (Linux) | User may need to be in docker group; document |
| Large inspect | includeInspect off by default |
| Remote Docker | DOCKER_HOST; document |

**Alternatives:**

- **Kubernetes pods:** Similar idea (kubectl logs); separate integration or future option.
- **Compose:** Infer service from docker-compose project; resolve to container ID via `docker compose ps`.

---

## References

- Docker CLI: [docker logs](https://docs.docker.com/engine/reference/commandline/logs/), [docker inspect](https://docs.docker.com/engine/reference/commandline/inspect/)
- Existing: session context header, sidecar pattern (terminal, external logs).
