# Plan: Docker — includeInspect and --until time bound

**Adapter:** `docker`
**Provider:** `src/modules/integrations/providers/docker-containers.ts`

## What exists

At session end: resolves container ID, runs `docker inspect` (parses image/imageId only), runs `docker logs --since ... --tail N` when `captureLogs` is true. Writes container.log sidecar and meta.

## What's missing

1. **`includeInspect` config**: write the full `docker inspect` output as a separate sidecar file
2. **`--until` time bound**: use session end time to bound log capture instead of relying solely on `--tail`

## Sub-features

### 1. includeInspect sidecar

**Config additions:**

Add to `IntegrationDockerConfig`:
- `includeInspect`: `boolean` (default `false`)

Add to `package.json`:
- `saropaLogCapture.integrations.docker.includeInspect` — boolean, default `false`
- Description: "Write full docker inspect output as a sidecar JSON file."

**Implementation:**

In `onSessionEnd`, after running `docker inspect`:
- If `includeInspect` is true and inspect succeeded, add a sidecar contribution:
  - Filename: `${baseFileName}.container-inspect.json`
  - Content: the raw inspect JSON output (already a valid JSON string)
- Update meta payload to include `inspectSidecar` filename

### 2. --until time bound on logs

**Implementation:**

Currently the logs command is:
```
docker logs --since <epochSeconds>s --tail <maxLogLines> <containerId>
```

Change to:
```
docker logs --since <startEpoch>s --until <endEpoch>s --tail <maxLogLines> <containerId>
```

Where `endEpoch` = `Math.ceil((sessionEndTime + lagBuffer) / 1000)`. The `--tail` cap remains as a safety limit.

This requires `sessionEndTime` from `IntegrationEndContext` (already available).

Add a small lag buffer (e.g. 60 seconds, matching the existing lead on `--since`) to avoid clipping logs that arrive slightly after the session end event.

### 3. Files to modify

| File | Change |
|------|--------|
| `src/modules/config/config-types.ts` | Add `includeInspect` to `IntegrationDockerConfig` |
| `src/modules/config/integration-config.ts` | Read `includeInspect` setting |
| `package.json` | Add `includeInspect` boolean setting |
| `src/modules/integrations/providers/docker-containers.ts` | Add inspect sidecar logic; add `--until` to logs command |

### 4. Considerations

- `docker inspect` output can be large (typically 5–20 KB) but manageable
- `--until` flag requires Docker API 1.35+ (Docker 17.12+, Dec 2017) — safe to assume
- Podman also supports `--until` — no runtime-specific branching needed
