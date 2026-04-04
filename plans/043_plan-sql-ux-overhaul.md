# 043 — SQL UX Overhaul: Command-Type Filters + Continuation Collapsing

## Problem

1. **SQL pattern chips are useless.** The chips show truncated parameterized SQL (`SELECT * FROM ? WHERE ? = ? LIMIT ?...`). There are 13+ chips that all look similar. You can't read them, and even if you could, the parameterized shape isn't what you care about — you care about the *operation type*: SELECT, INSERT, UPDATE, DELETE, BEGIN, COMMIT.

2. **Long SQL statements are unreadable.** Flutter's logcat splits output at ~1000 chars. A single batch INSERT of 57 rows becomes 40+ viewer lines. You can't tell where one operation ends and the next begins. The log is useless for understanding what your app did.

## Solution

Two changes, both needed together.

### Part A: Replace SQL pattern chips with command-type filters

**Current:** 13 chips like `SELECT * FROM ? WHERE ? = ? LIMIT ?... 6`
**New:** ~6 chips like `SELECT 18 | INSERT 3 | BEGIN 5 | COMMIT 5 | Other SQL 2`

The verb is **already extracted** by `parseSqlFingerprint()` in `viewer-data-n-plus-one-script.ts:62-77` — it returns `{ verb: 'SELECT' | 'INSERT' | ... }`. Currently only used for N+1 detection. We repurpose it for filtering.

#### Changes

1. **`viewer-sql-pattern-tags.ts`** — Gut the fingerprint-based chip system. Replace with verb-based:
   - Track `sqlVerbCounts: { SELECT: 14, INSERT: 3, ... }` instead of `sqlPatternRawCounts`
   - `registerSqlPattern(item)` → `registerSqlVerb(item)`: increment verb count, set `item.sqlVerbKey = verb`
   - `unregisterSqlPattern(item)` → `unregisterSqlVerb(item)`: decrement on trim
   - `hiddenSqlPatterns` → `hiddenSqlVerbs`: same toggle logic, simpler keys
   - `rebuildSqlPatternChips()` → `rebuildSqlVerbChips()`: render 6 buttons instead of 13+
   - Remove `sqlChipMinCount` / `sqlPatternMaxChips` settings — no longer needed (always ≤8 chips)
   - Keep All/None buttons

2. **`viewer-data-add.ts`** — In `addToData()`:
   - Store `item.sqlVerbKey` (from `sqlMeta.verb`) instead of `item.sqlPatternChipKey`
   - Store `item.sqlVerbFiltered` instead of `item.sqlPatternFiltered`

3. **`viewer-data-helpers-core.ts`** — In `calcItemHeight()`:
   - Check `item.sqlVerbFiltered` instead of `item.sqlPatternFiltered`

4. **`package.json` + `config.ts`** — Remove `chipMinCount` and `chipMaxChips` settings (or repurpose)

5. **`viewer-data-n-plus-one-script.ts`** — No changes needed; `parseSqlFingerprint()` already returns `verb`

#### Verb categories

| Chip label | Matches |
|-----------|---------|
| SELECT | SELECT, WITH (read queries) |
| INSERT | INSERT |
| UPDATE | UPDATE |
| DELETE | DELETE |
| Transaction | BEGIN, COMMIT, ROLLBACK |
| Other SQL | PRAGMA, anything else |

### Part B: Continuation line collapsing

Detect when consecutive physical lines are fragments of one logical message. Collapse them into a single row with an expand toggle.

#### Detection criteria

Two consecutive lines are continuations if **all** of:
- Same timestamp (within tolerance, e.g. ≤100ms or identical)
- Same source (logcat tag + PID, or same DAP category)
- Previous line did not end with a natural boundary (`;`, `)`, closing bracket at depth 0)
- OR current line starts mid-token (lowercase letter, continuation of bracket nesting)

Simpler heuristic to start: same timestamp + same source + within a configurable max-continuation window (e.g. 50 lines). The "natural boundary" check can be a v2 refinement.

#### Architecture

Follow the existing **stack-frame grouping** pattern in `viewer-data-add.ts:56-94`:

1. **New item types:** `continuation-header` and `continuation-line` (parallel to `stack-header` / `stack-frame`)

2. **In `addToData()`:**
   - When a new line arrives, check if it continues the previous non-marker line (same ts + same source)
   - If yes and no active continuation group: retroactively convert the previous line into a `continuation-header`, start a new group
   - If yes and active continuation group: add as `continuation-line` with same `groupId`
   - If no: finalize any active continuation group, add as normal `line`

3. **`calcItemHeight()`:**
   - `continuation-header`: always visible (shows first fragment + expand toggle)
   - `continuation-line`: visible only when group is expanded (like stack frames when not collapsed)

4. **Toggle UI:**
   - Click the continuation header → expand/collapse children
   - Header shows: original first line text + ` [+N continuation lines]` badge
   - Expanded: all fragments visible at normal height

5. **Interaction with other filters:**
   - SQL verb filter applies to the `continuation-header` — if filtered, the whole group hides
   - Framework muting applies to the header — if the first line is fw, whole group is fw
   - Search should search across all fragments (even collapsed ones) — matching expands the group

#### Changes

1. **`viewer-data-add.ts`** — Add continuation detection logic in `addToData()`, parallel to stack-frame detection
2. **`viewer-data-helpers-core.ts`** — Add `continuation-line` height logic in `calcItemHeight()`
3. **`viewer-data-helpers-render.ts`** — Render continuation header with expand badge + click handler
4. **`viewer-styles-*.ts`** — Styling for continuation badge (reuse stack-group collapse styling where possible)

## Implementation order

1. **Part A first** (smaller, standalone, immediately useful)
   - Swap chip system from fingerprint → verb
   - Remove obsolete settings
   - Test with existing SQL logs

2. **Part B second** (larger, builds on Part A)
   - Continuation detection + grouping
   - Expand/collapse UI
   - Filter interaction

## Risk / edge cases

- **Part A:** N+1 detection still needs the full fingerprint internally — don't remove `parseSqlFingerprint()`, just stop using fingerprints for chips. The verb filter is orthogonal to N+1 detection.
- **Part B:** False positives — two genuinely separate log lines at the same timestamp could get incorrectly grouped. Mitigate with the natural-boundary heuristic and a max-continuation-lines cap.
- **Part B:** Performance — grouping adds overhead per line. Keep it O(1) per line (just compare with previous line).

## Files touched

### Part A (~6 files)
- `src/ui/viewer-stack-tags/viewer-sql-pattern-tags.ts` — major rewrite
- `src/ui/viewer/viewer-data-add.ts` — swap property names
- `src/ui/viewer/viewer-data-helpers-core.ts` — swap filter check
- `src/ui/viewer/viewer-data-n-plus-one-script.ts` — no change (already has verb)
- `package.json` — remove/update settings
- `src/config.ts` — remove/update settings readers

### Part B (~5 files)
- `src/ui/viewer/viewer-data-add.ts` — continuation detection
- `src/ui/viewer/viewer-data-helpers-core.ts` — continuation height calc
- `src/ui/viewer/viewer-data-helpers-render.ts` — continuation header rendering
- `src/ui/viewer-styles/viewer-styles-*.ts` — badge styling
- Tests for both parts
