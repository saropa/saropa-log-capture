# Plan 007 — Docker polish: `includeInspect` sidecar and `--until` on logs

## Status: Open

## Goal

Improve the Docker integration adapter with two additions:

1. **`includeInspect` sidecar** — When enabled, run `docker inspect` on captured containers at session end and write the output as a `.docker-inspect.json` sidecar alongside the session log. Gives post-mortem visibility into container config (env, mounts, health, restart policy) without requiring the container to still be running.

2. **`--until` flag on `docker logs`** — The current Docker adapter captures all available container logs. Add a `--until` option (default: session duration + small buffer) so only logs from the debug session window are captured, reducing noise from long-running containers.

---

## Scope

### In scope

- New `includeInspect` boolean on the Docker adapter config (default `false`)
- `docker inspect <containerId>` execution at session end, output written to sidecar
- `--until` timestamp parameter on the existing `docker logs` call
- Settings: `saropaLogCapture.integrations.adapters.docker.includeInspect`, `saropaLogCapture.integrations.adapters.docker.logWindow`
- Error handling: container not found, Docker not installed, permission denied

### Out of scope

- Docker Compose multi-container orchestration
- Streaming Docker logs during session (separate from debug capture)
- Container lifecycle management

---

## Detailed changes

### File 1: Docker adapter provider

Add `includeInspect` to the adapter config interface. At session end, if enabled, spawn `docker inspect` and write the JSON response to `<basename>.docker-inspect.json`.

### File 2: Docker log capture

Add `--until` flag to the `docker logs` command. Compute the timestamp from session start time minus a configurable buffer (default 30s before session start, to catch startup logs).

### File 3: `package.json` + `config.ts`

New settings:
- `saropaLogCapture.integrations.adapters.docker.includeInspect` (boolean, default `false`)
- `saropaLogCapture.integrations.adapters.docker.logWindow` (number, seconds before session start to include, default `30`)

---

## Test plan

1. **Inspect sidecar written:** Enable `includeInspect`, run session with Docker adapter → sidecar JSON file exists with valid container config
2. **Inspect disabled by default:** Default config → no sidecar written
3. **Container not found:** Container stopped/removed before inspect → graceful error logged, no crash
4. **`--until` limits output:** Long-running container → only logs from session window captured
5. **Docker not installed:** Adapter enabled but `docker` not on PATH → error logged to output channel

---

## Risk assessment

| Risk | Mitigation |
|------|------------|
| `docker inspect` hangs on unresponsive daemon | Timeout (10s) on the spawned process |
| `--until` clock skew between host and container | Buffer window (default 30s) absorbs reasonable skew |
| Large inspect output for complex containers | JSON is typically <100KB; no size concern |
