# DB_16: DB Timestamp Burst Detector

## Problem

Multiple database queries firing at the exact same millisecond timestamp is a code smell — it suggests missing caching, redundant lookups, or unnecessary parallel DB hits. The existing detectors don't catch this:

- **Slow burst (DB_08)** — requires `durationMs` metadata; plain Drift lines don't have it
- **N+1 (DB_07)** — requires 8+ repeats of the same fingerprint with 4+ distinct args

Neither flags "3 DB queries at the same millisecond" as suspicious.

## Example

```
1848  T12:00:10  Drift SELECT: SELECT * FROM "provider_auths" WHERE ... | args: [apple]
1849  T12:00:10  Drift SELECT: SELECT * FROM "provider_auths" WHERE ... | args: [apple]
1850  T12:00:10  Drift SELECT: SELECT * FROM "contacts" WHERE ... | args: [sar-868d24b5...]
```

Three DB hits at identical timestamps — two are identical (dedup already flags visually) but the burst itself is the smell worth surfacing.

## Solution

A new detector (`db.timestamp-burst`) that:

1. Tracks the timestamp of each DB-classified line
2. Counts consecutive lines sharing the same timestamp (within a tolerance of ≤10ms)
3. When count reaches threshold (default 3), emits a **marker** result

## Algorithm

```
State per session:
  currentTs: number | null
  count: number
  firstSeq: number

On each feed(ctx):
  if |ctx.timestampMs - currentTs| <= toleranceMs:
    count++
  else:
    currentTs = ctx.timestampMs
    count = 1
    firstSeq = ctx.anchorSeq

  if count === minCount (first time hitting threshold for this burst):
    emit marker "DB timestamp burst (N queries at same instant)"
```

## Thresholds

| Param | Default | Range | Description |
|-------|---------|-------|-------------|
| `minCount` | 3 | 2–50 | Queries at same timestamp to trigger |
| `toleranceMs` | 10 | 0–100 | Max timestamp difference to consider "same instant" |
| `cooldownMs` | 5000 | 0–60000 | Suppress repeated markers within this window |

## Integration

- **Detector ID:** `db.timestamp-burst`
- **Priority:** 80 (before slow burst at 85)
- **Result kind:** `marker` (same as slow burst)
- **Toggle:** `timestampBurstEnabled` in `ViewerDbDetectorToggles`

## Files to create/modify

| Action | File |
|--------|------|
| Create | `src/modules/db/drift-db-timestamp-burst-detector.ts` |
| Create | `src/modules/db/drift-db-timestamp-burst-thresholds.ts` |
| Create | `src/test/modules/db/drift-db-timestamp-burst-detector.test.ts` |
| Modify | `src/ui/viewer/viewer-db-detector-framework-script.ts` |
| Modify | `src/modules/config/config-types.ts` |
| Modify | `CHANGELOG.md` |
