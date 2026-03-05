# Spec: Docker and Containers Integration

**Adapter id:** `docker`  
**Status:** Implemented  
**Design:** Implemented; see provider in `src/modules/integrations/providers/docker-containers.ts` and this spec.

## Goal

Attach container ID, image, and container logs to the session when debugging in or with containers.

## Config

- `saropaLogCapture.integrations.adapters` includes `docker`
- `saropaLogCapture.integrations.docker.*`: runtime (docker | podman), containerId, containerNamePattern, captureLogs, includeInspect, maxLogLines

## Implementation

- **Provider:** Discover container from launch config or docker ps (filter by name/pattern). `onSessionStartSync`: if containerId, run docker inspect; return header lines + meta. `onSessionEnd`: docker logs --since/--until; write basename.container.log.
- **Viewer:** "Container" tab when sidecar exists; optional "Inspect" link.
- **Performance:** Inspect and logs via CLI; run at end for logs so as not to block. Graceful when Docker not in PATH.
- **Status bar:** "Docker" when contributed.

## UX

- No spinner. Container tab when sidecar exists. Clear message when Docker unavailable.
