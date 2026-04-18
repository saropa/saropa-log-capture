/**
 * ## Viewer SQL repeat compression — behavioral tests (plan **DB_03**)
 *
 * ### Why this file exists
 * Real-time repeat collapse for Drift SQL lives in **embedded JavaScript** (`addToData` in
 * `viewer-data-add.ts`, repeat state in `viewer-data-helpers-core.ts`, fingerprinting in
 * `viewer-data-n-plus-one-script.ts`). String-only embed tests catch regressions in call
 * shape, but they do not execute streak logic. This suite runs the **same script chunks**
 * the webview loads (in the correct order) inside a `node:vm` context with thin stubs for
 * unrelated subsystems (stack frames, filters, compress suggestion).
 *
 * ### What is validated
 * - Fingerprint-keyed streaks merge arg variants; labels use **N × SQL repeated:** on one row.
 * - Distinct normalized fingerprints start **separate** streaks (see comment on quoted
 *   identifiers vs column names — DB_02 normalization can collapse `"a"` / `"b"` table names).
 * - Null `parseSqlFingerprint` on an otherwise Drift-shaped line stores all lines
 *   individually (no notification row) — compress dedup groups them when toggled on.
 * - Non–`database`-tagged duplicates are stored individually in allLines.
 * - `cleanupTrailingRepeats` + marker ingest: tracker reset, anchor row height restored,
 *   no visible `repeat-notification` rows after the marker.
 * - **False positives:** gaps beyond `repeatWindowMs` reset the streak; Drift text without
 *   a logcat/bracket prefix is not `database`-tagged and must not use SQL fingerprint keys.
 *
 * ### Limits / maintenance
 * - Sandbox `parseSourceTag` is a **minimal** subset of `viewer-source-tags.ts` /
 *   `source-tag-parser.ts` (Drift gate + logcat prefix). If production tagging diverges,
 *   update this regex or share a generated test fixture — otherwise VM results may drift.
 * - **DB_06:** SQL repeat drilldown snapshot, variant cap, expand/collapse height, false positives
 *   (non-SQL has no toggle; unknown `seq` toggle is no-op). Does not exercise DOM click/Escape (see
 *   `viewer-script.ts`).
 * - Does not exercise DOM, virtual scroll, or `applyCompressDedupModes` (out of scope for DB_03).
 *
 * @see plans/history/20260323/DB_03_sql-repeat-compression.md
 * @see plans/history/20260323/DB_06_expand-sql-repeats-drilldown.md
 * @see viewer-data-add.ts — `addToData` repeat branch
 */
import * as assert from 'node:assert';
import { loadViewerRepeatSandbox } from './viewer-sql-repeat-compression-sandbox';

/** Logcat-style prefix so sandbox `parseSourceTag` matches Drift DB tagging (see source-tag-parser). */
const FLUTTER = 'I/flutter (1): ';
const ROW_HEIGHT_EXPECTED = 20;

function driftSelectWithArgs(id: number): string {
    return `${FLUTTER}Drift: Sent SELECT * FROM contacts WHERE id = ${id} with args [${id}]`;
}

/** Distinct fingerprints: quoted table names normalize to `?` and would falsely merge (DB_02). */
function driftSelectWhereColumn(col: string): string {
    return `${FLUTTER}Drift: Sent SELECT * FROM items WHERE ${col} = 1 with args []`;
}

suite('Viewer SQL repeat compression (DB_03)', () => {
    test('many identical plain lines are all stored in allLines (compress dedup handles grouping)', () => {
        const s = loadViewerRepeatSandbox();
        const t0 = 11_000_000;
        const msg = 'flutter accessibility_bridge duplicate line';
        for (let i = 0; i < 10; i++) {
            s.addToData(msg, false, 'stdout', t0 + i * 50, false, null, undefined, undefined, 'debug');
        }
        /* Non-SQL repeats are stored individually — the compress dedup algorithm
           (applyCompressDedupModes) groups them when compress mode is toggled on. */
        const repeats = s.allLines.filter((l) => l.type === 'repeat-notification');
        assert.strictEqual(repeats.length, 0, 'non-SQL repeats should not create notification rows');
        const lines = s.allLines.filter((l) => l.type === 'line');
        assert.strictEqual(lines.length, 10, 'all 10 duplicate lines should be stored individually');
        assert.strictEqual(lines[0].height, ROW_HEIGHT_EXPECTED, 'each line is visible when compress is off');
    });

    test('same SQL shape with different args stays one fingerprint-keyed streak (N × SQL repeated:)', () => {
        const s = loadViewerRepeatSandbox();
        const t0 = 1_000_000;
        s.addToData(driftSelectWithArgs(1), false, 'stdout', t0, false, null, undefined, undefined, 'debug');
        s.addToData(driftSelectWithArgs(2), false, 'stdout', t0 + 100, false, null, undefined, undefined, 'debug');
        s.addToData(driftSelectWithArgs(3), false, 'stdout', t0 + 200, false, null, undefined, undefined, 'debug');

        const repeats = s.allLines.filter((l) => l.type === 'repeat-notification');
        assert.strictEqual(repeats.length, 1);
        assert.ok(repeats[0].html?.includes('3 × SQL repeated:'));
        const lines = s.allLines.filter((l) => l.type === 'line');
        assert.strictEqual(lines.length, 1);
        assert.strictEqual(lines[0].repeatHidden, true);
    });

    test('different SQL fingerprints do not merge into one streak', () => {
        const s = loadViewerRepeatSandbox();
        const t0 = 2_000_000;
        s.addToData(driftSelectWhereColumn('foo_id'), false, 'stdout', t0, false, null, undefined, undefined, 'debug');
        s.addToData(driftSelectWhereColumn('foo_id'), false, 'stdout', t0 + 50, false, null, undefined, undefined, 'debug');
        s.addToData(driftSelectWhereColumn('bar_id'), false, 'stdout', t0 + 100, false, null, undefined, undefined, 'debug');
        s.addToData(driftSelectWhereColumn('bar_id'), false, 'stdout', t0 + 150, false, null, undefined, undefined, 'debug');

        const repeats = s.allLines.filter((l) => l.type === 'repeat-notification');
        assert.strictEqual(repeats.length, 2);
        assert.ok(repeats[0].html?.includes('2 × SQL repeated:'));
        assert.ok(repeats[1].html?.includes('2 × SQL repeated:'));
        const lines = s.allLines.filter((l) => l.type === 'line');
        assert.strictEqual(lines.length, 2);
        assert.ok(lines.every((l) => l.repeatHidden === true));
    });

    test('database line with forced null fingerprint falls back to inline repeat badge (not SQL drilldown)', () => {
        const s = loadViewerRepeatSandbox();
        const realParse = s.parseSqlFingerprint;
        assert.ok(typeof realParse === 'function');
        s.parseSqlFingerprint = function (plain: string) {
            if (plain.includes('__NULL_FP__')) {
                return null;
            }
            return realParse(plain);
        };
        const t0 = 3_000_000;
        const line = `${FLUTTER}Drift: Sent SELECT 1 with args [__NULL_FP__]`;
        s.addToData(line, false, 'stdout', t0, false, null, undefined, undefined, 'debug');
        s.addToData(line, false, 'stdout', t0 + 50, false, null, undefined, undefined, 'debug');
        s.addToData(line, false, 'stdout', t0 + 100, false, null, undefined, undefined, 'debug');

        /* Null fingerprint means non-SQL path: all lines stored individually. */
        const repeats = s.allLines.filter((l) => l.type === 'repeat-notification');
        assert.strictEqual(repeats.length, 0, 'null-fingerprint lines should not create notification rows');
        const lines = s.allLines.filter((l) => l.type === 'line');
        assert.strictEqual(lines.length, 3, 'all 3 duplicate lines should be stored individually');
    });

    test('gap beyond repeatWindowMs starts a new streak (does not extend SQL repeated count)', () => {
        const s = loadViewerRepeatSandbox();
        const t0 = 6_000_000;
        // repeatWindowMs defaults to 3000 in viewer-data-helpers-core embed.
        s.addToData(driftSelectWithArgs(1), false, 'stdout', t0, false, null, undefined, undefined, 'debug');
        s.addToData(driftSelectWithArgs(2), false, 'stdout', t0 + 100, false, null, undefined, undefined, 'debug');
        s.addToData(driftSelectWithArgs(3), false, 'stdout', t0 + 100 + 3100, false, null, undefined, undefined, 'debug');

        const repeats = s.allLines.filter((l) => l.type === 'repeat-notification');
        assert.strictEqual(repeats.length, 1);
        assert.ok(repeats[0].html?.includes('2 × SQL repeated:'));
        const lines = s.allLines.filter((l) => l.type === 'line');
        const visibleTail = lines.filter((l) => !l.repeatHidden);
        assert.strictEqual(visibleTail.length, 1);
        assert.ok(visibleTail[0].html?.includes('Drift: Sent'));
    });

    test('Drift-shaped text without logcat prefix is not database-tagged (inline badge, not SQL drilldown)', () => {
        const s = loadViewerRepeatSandbox();
        const t0 = 7_000_000;
        const bare = 'Drift: Sent SELECT 1 with args [x]';
        s.addToData(bare, false, 'stdout', t0, false, null, undefined, undefined, 'debug');
        s.addToData(bare, false, 'stdout', t0 + 50, false, null, undefined, undefined, 'debug');
        s.addToData(bare, false, 'stdout', t0 + 100, false, null, undefined, undefined, 'debug');

        /* Without logcat prefix, not database-tagged — non-SQL path: all lines stored. */
        const repeats = s.allLines.filter((l) => l.type === 'repeat-notification');
        assert.strictEqual(repeats.length, 0, 'non-database lines should not create notification rows');
        const lines = s.allLines.filter((l) => l.type === 'line');
        assert.strictEqual(lines.length, 3, 'all 3 duplicate lines should be stored individually');
    });

    test('non-database identical lines are stored individually (compress dedup handles grouping)', () => {
        const s = loadViewerRepeatSandbox();
        const t0 = 4_000_000;
        const msg = 'plain duplicate line without logcat prefix';
        s.addToData(msg, false, 'stdout', t0, false, null, undefined, undefined, 'debug');
        s.addToData(msg, false, 'stdout', t0 + 50, false, null, undefined, undefined, 'debug');
        s.addToData(msg, false, 'stdout', t0 + 100, false, null, undefined, undefined, 'debug');

        /* Non-database lines are stored individually — compress dedup groups them on toggle. */
        const repeats = s.allLines.filter((l) => l.type === 'repeat-notification');
        assert.strictEqual(repeats.length, 0, 'plain lines should not create notification rows');
        const lines = s.allLines.filter((l) => l.type === 'line');
        assert.strictEqual(lines.length, 3, 'all 3 duplicate lines should be stored individually');
        assert.strictEqual(lines[0].height, ROW_HEIGHT_EXPECTED, 'each line is visible when compress is off');
    });

    test('DB_06: SQL repeat rows carry drilldown snapshot and toggle; expand increases height', () => {
        const s = loadViewerRepeatSandbox();
        const t0 = 8_000_000;
        s.addToData(driftSelectWithArgs(1), false, 'stdout', t0, false, null, undefined, undefined, 'debug');
        s.addToData(driftSelectWithArgs(2), false, 'stdout', t0 + 100, false, null, undefined, undefined, 'debug');
        s.addToData(driftSelectWithArgs(3), false, 'stdout', t0 + 200, false, null, undefined, undefined, 'debug');

        const repeats = s.allLines.filter((l) => l.type === 'repeat-notification');
        assert.strictEqual(repeats.length, 1);
        const tail = repeats[0];
        assert.ok(tail.html?.includes('sql-repeat-drilldown-toggle'));
        assert.ok(tail.sqlRepeatDrilldown);
        assert.strictEqual(tail.sqlRepeatDrilldown.repeatCount, 3);
        assert.strictEqual(tail.sqlRepeatDrilldown.variants.length, 3);
        assert.strictEqual(tail.sqlRepeatDrilldown.moreVariantCount, 0);

        const hCollapsed = s.calcItemHeight(tail);
        assert.strictEqual(hCollapsed, ROW_HEIGHT_EXPECTED);
        s.toggleSqlRepeatDrilldown(tail.seq as number);
        assert.strictEqual(tail.sqlRepeatDrilldownOpen, true);
        assert.ok(tail.html?.includes('sql-repeat-drilldown-detail'));
        s.recalcHeights();
        const hOpen = s.calcItemHeight(tail);
        assert.ok(hOpen > ROW_HEIGHT_EXPECTED);
    });

    test('DB_06: more than 10 distinct arg variants surface moreVariantCount', () => {
        const s = loadViewerRepeatSandbox();
        const t0 = 9_000_000;
        s.addToData(driftSelectWithArgs(1), false, 'stdout', t0, false, null, undefined, undefined, 'debug');
        for (let k = 2; k <= 11; k++) {
            s.addToData(driftSelectWithArgs(k), false, 'stdout', t0 + k * 10, false, null, undefined, undefined, 'debug');
        }
        const repeats = s.allLines.filter((l) => l.type === 'repeat-notification');
        const tail = repeats[repeats.length - 1];
        assert.ok(tail.sqlRepeatDrilldown);
        assert.strictEqual(tail.sqlRepeatDrilldown.variants.length, 10);
        assert.strictEqual(tail.sqlRepeatDrilldown.moreVariantCount, 1);
    });

    test('DB_06: collapsed rows have no detail HTML; second toggle closes; unknown seq is no-op', () => {
        const s = loadViewerRepeatSandbox();
        const t0 = 10_000_000;
        s.addToData(driftSelectWithArgs(1), false, 'stdout', t0, false, null, undefined, undefined, 'debug');
        s.addToData(driftSelectWithArgs(2), false, 'stdout', t0 + 100, false, null, undefined, undefined, 'debug');
        s.addToData(driftSelectWithArgs(3), false, 'stdout', t0 + 200, false, null, undefined, undefined, 'debug');
        const repeats = s.allLines.filter((l) => l.type === 'repeat-notification');
        const tail = repeats[repeats.length - 1];
        assert.ok(!tail.html?.includes('sql-repeat-drilldown-detail'));
        assert.strictEqual(tail.sqlRepeatDrilldownOpen, false);
        const thBefore = s.totalHeight;
        s.toggleSqlRepeatDrilldown(4_000_000);
        assert.strictEqual(s.totalHeight, thBefore);
        s.toggleSqlRepeatDrilldown(tail.seq as number);
        assert.ok(tail.html?.includes('sql-repeat-drilldown-detail'));
        s.toggleSqlRepeatDrilldown(tail.seq as number);
        assert.strictEqual(tail.sqlRepeatDrilldownOpen, false);
        assert.ok(!tail.html?.includes('sql-repeat-drilldown-detail'));
    });

    test('marker boundary restores hidden anchor row and clears repeat tracker state', () => {
        const s = loadViewerRepeatSandbox();
        const t0 = 5_000_000;
        s.addToData(driftSelectWithArgs(1), false, 'stdout', t0, false, null, undefined, undefined, 'debug');
        s.addToData(driftSelectWithArgs(2), false, 'stdout', t0 + 100, false, null, undefined, undefined, 'debug');

        const anchorBefore = s.allLines.find((l) => l.type === 'line');
        assert.ok(anchorBefore);
        assert.strictEqual(anchorBefore?.repeatHidden, true);
        assert.strictEqual(anchorBefore?.height, 0);

        s.addToData('<span>marker</span>', true, 'marker', t0 + 10_000, false, null, undefined, undefined, 'debug');

        assert.strictEqual(s.repeatTracker.count, 0);
        assert.strictEqual(s.repeatTracker.lastHash, null);
        assert.strictEqual(s.repeatTracker.lastLineIndex, -1);
        assert.strictEqual(s.repeatTracker.sqlStreakFingerprint, null);
        assert.strictEqual(s.repeatTracker.streakSqlFp, false);

        const anchorAfter = s.allLines.find((l) => l.type === 'line');
        assert.ok(anchorAfter);
        assert.strictEqual(anchorAfter?.repeatHidden, false);
        assert.strictEqual(anchorAfter?.height, ROW_HEIGHT_EXPECTED);

        // cleanupTrailingRepeats zeroes height on trailing repeat rows before the marker is pushed;
        // rows stay in `allLines` for index stability — no visible repeat tail after marker.
        const visibleRepeats = s.allLines.filter((l) => l.type === 'repeat-notification' && l.height > 0);
        assert.strictEqual(visibleRepeats.length, 0);
        const last = s.allLines.at(-1);
        assert.ok(last);
        assert.strictEqual(last.type, 'marker');
    });
});
