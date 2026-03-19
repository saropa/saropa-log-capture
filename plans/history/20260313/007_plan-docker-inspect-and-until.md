# Plan: Docker — includeInspect and --until time bound

**Adapter:** `docker`
**Provider:** `src/modules/integrations/providers/docker-containers.ts`

**Completed:** 2026-03-13. Both sub-features implemented: `includeInspect` sidecar and `--until` on logs.

---

## What existed (before implementation)

At session end: resolves container ID, runs `docker inspect` (parses image/imageId only), runs `docker logs --since ... --tail N` when `captureLogs` is true. Writes container.log sidecar and meta.

## What was implemented

1. **`includeInspect` config:** `IntegrationDockerConfig.includeInspect` (default `false`), setting `integrations.docker.includeInspect`. When true, full `docker inspect` output is written to `${baseFileName}.container-inspect.json` and `inspectSidecar` is set in meta.
2. **`--until` time bound:** `docker logs` now uses `--since <startEpoch>s --until <endEpoch>s --tail <maxLogLines> <containerId>` with `endEpoch = Math.ceil((sessionEndTime + 60_000) / 1000)` (60s lag). `--tail` remains as safety limit.

## Files modified

- `src/modules/config/config-types.ts` — added `includeInspect` to `IntegrationDockerConfig`
- `src/modules/config/integration-config.ts` — read `includeInspect` setting
- `package.json` — added `saropaLogCapture.integrations.docker.includeInspect`
- `src/modules/integrations/providers/docker-containers.ts` — inspect sidecar logic; `--until` on logs command

## Considerations (unchanged)

- `docker inspect` output can be large (typically 5–20 KB) but manageable
- `--until` flag requires Docker API 1.35+ (Docker 17.12+, Dec 2017) — safe to assume
- Podman also supports `--until` — no runtime-specific branching needed
