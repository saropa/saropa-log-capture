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
 * - Fingerprint-keyed streaks merge arg variants; labels use **SQL repeated #N**.
 * - Distinct normalized fingerprints start **separate** streaks (see comment on quoted
 *   identifiers vs column names — DB_02 normalization can collapse `"a"` / `"b"` table names).
 * - Null `parseSqlFingerprint` on an otherwise Drift-shaped line falls back to **Repeated #**
 *   (simulated via a scoped wrapper — host `parseDriftSqlFingerprint` cannot return null for
 *   valid `Sent` lines, but the embed branch must stay defensive).
 * - Non–`database`-tagged duplicates keep legacy **Repeated #** wording.
 * - `cleanupTrailingRepeats` + marker ingest: tracker reset, anchor row height restored,
 *   no visible `repeat-notification` rows after the marker.
 * - **False positives:** gaps beyond `repeatWindowMs` reset the streak; Drift text without
 *   a logcat/bracket prefix is not `database`-tagged and must not use SQL fingerprint keys.
 *
 * ### Limits / maintenance
 * - Sandbox `parseSourceTag` is a **minimal** subset of `viewer-source-tags.ts` /
 *   `source-tag-parser.ts` (Drift gate + logcat prefix). If production tagging diverges,
 *   update this regex or share a generated test fixture — otherwise VM results may drift.
 * - Does not exercise DOM, virtual scroll, or `applyCompressDedupModes` (out of scope for DB_03).
 *
 * @see plans/history/20260323/DB_03_sql-repeat-compression.md
 * @see viewer-data-add.ts — `addToData` repeat branch
 */
import * as assert from 'node:assert';
import * as vm from 'node:vm';
import { getViewerDataAddScript } from '../../ui/viewer/viewer-data-add';
import { getViewerDataHelpersCore } from '../../ui/viewer/viewer-data-helpers-core';
import { getViewerDbDetectorFrameworkScript } from '../../ui/viewer/viewer-db-detector-framework-script';
import { getNPlusOneDetectorScript } from '../../ui/viewer/viewer-data-n-plus-one-script';
import { VIEWER_REPEAT_THRESHOLD_DEFAULTS } from '../../modules/db/drift-db-repeat-thresholds';

/** Logcat-style prefix so sandbox `parseSourceTag` matches Drift DB tagging (see source-tag-parser). */
const FLUTTER = 'I/flutter (1): ';
const ROW_HEIGHT_EXPECTED = 20;

interface RepeatTrackerVm {
    lastHash: string | null;
    count: number;
    lastLineIndex: number;
    streakSqlFp: boolean;
}

interface LineItemVm {
    type: string;
    html?: string;
    height: number;
    repeatHidden?: boolean;
}

interface SandboxVm {
    /** Mirrors embedded `addToData` arity (positional args are fixed in the viewer script). */
    addToData: (...args: unknown[]) => void;
    allLines: LineItemVm[];
    totalHeight: number;
    repeatTracker: RepeatTrackerVm;
    cleanupTrailingRepeats: () => void;
    parseSqlFingerprint: ((plain: string) => { fingerprint: string } | null) | undefined;
}

function buildSandboxScript(): string {
    // Stubs and globals required before the real viewer chunks (mirrors load order in viewer-data.ts).
    return /* javascript */ `
var ROW_HEIGHT = 20;
var MARKER_HEIGHT = 28;
var allLines = [];
var totalHeight = 0;
var nextSeq = 1;
var nextGroupId = 0;
var activeGroupHeader = null;
var groupHeaderMap = {};
var sessionStartTs = null;
var autoHiddenCount = 0;
var strictLevelDetection = false;
var suppressTransientErrors = false;
var appOnlyMode = false;

function stripTags(html) { return (html == null ? '' : String(html)).replace(/<[^>]*>/g, ''); }
function isStackFrameText() { return false; }
function parseClassTags() { return []; }
function parseLogcatTag() { return null; }
function classifyLevel() { return 'info'; }
function classifyError() { return null; }
function checkCriticalError() {}
function isClassFiltered() { return false; }
function calcScopeFiltered() { return false; }
function testAutoHide() { return false; }
function finalizeStackGroup() {}
function registerClassTags() {}
function registerSourceTag() {}
function registerSqlPattern() {}
function resetCompressDupStreak() {}
function updateCompressDupStreakAfterLine() {}

/* Minimal parseSourceTag aligned with source-tag-parser driftStatementPattern gate. */
function parseSourceTag(plainText) {
    var sourceTagPattern = /^(?:([VDIWEFA])\\/([^(:\\s]+)\\s*(?:\\(\\s*\\d+\\))?:\\s|\\[([^\\]]+)\\]\\s)/;
    var driftStatementPattern = /\\bDrift:\\s+Sent\\s+(?:SELECT|INSERT|UPDATE|DELETE|WITH|PRAGMA|BEGIN|COMMIT|ROLLBACK)\\b/i;
    var m = sourceTagPattern.exec(plainText);
    if (m) {
        var raw = m[2] || m[3];
        if (!raw) return null;
        var tag = raw.toLowerCase();
        var body = plainText.slice(m[0].length);
        if (driftStatementPattern.test(body)) return 'database';
        return tag;
    }
    return null;
}
`;
}

function loadViewerRepeatSandbox(): SandboxVm {
    const code =
        buildSandboxScript() +
        getNPlusOneDetectorScript(VIEWER_REPEAT_THRESHOLD_DEFAULTS) +
        getViewerDbDetectorFrameworkScript(false) +
        getViewerDataHelpersCore() +
        getViewerDataAddScript();
    const ctx = vm.createContext({ console });
    vm.runInContext(code, ctx, { filename: 'viewer-sql-repeat-compression-sandbox.js', timeout: 10_000 });
    return ctx as unknown as SandboxVm;
}

function driftSelectWithArgs(id: number): string {
    return `${FLUTTER}Drift: Sent SELECT * FROM contacts WHERE id = ${id} with args [${id}]`;
}

/** Distinct fingerprints: quoted table names normalize to `?` and would falsely merge (DB_02). */
function driftSelectWhereColumn(col: string): string {
    return `${FLUTTER}Drift: Sent SELECT * FROM items WHERE ${col} = 1 with args []`;
}

suite('Viewer SQL repeat compression (DB_03)', () => {
    test('same SQL shape with different args stays one fingerprint-keyed streak (SQL repeated #N)', () => {
        const s = loadViewerRepeatSandbox();
        const t0 = 1_000_000;
        s.addToData(driftSelectWithArgs(1), false, 'stdout', t0, false, null, undefined, undefined, 'debug');
        s.addToData(driftSelectWithArgs(2), false, 'stdout', t0 + 100, false, null, undefined, undefined, 'debug');
        s.addToData(driftSelectWithArgs(3), false, 'stdout', t0 + 200, false, null, undefined, undefined, 'debug');

        const repeats = s.allLines.filter((l) => l.type === 'repeat-notification');
        assert.strictEqual(repeats.length, 2);
        assert.ok(repeats.every((r) => r.html?.includes('SQL repeated #')));
        assert.ok(repeats[1].html?.includes('SQL repeated #3'));
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
        assert.ok(repeats[0].html?.includes('SQL repeated #2'));
        assert.ok(repeats[1].html?.includes('SQL repeated #2'));
        const lines = s.allLines.filter((l) => l.type === 'line');
        assert.strictEqual(lines.length, 2);
        assert.ok(lines.every((l) => l.repeatHidden === true));
    });

    test('database line with forced null fingerprint falls back to plain repeat hash (Repeated #, not SQL repeated)', () => {
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

        const repeats = s.allLines.filter((l) => l.type === 'repeat-notification');
        assert.strictEqual(repeats.length, 2);
        assert.ok(repeats.every((r) => r.html?.includes('Repeated #')));
        assert.ok(repeats.every((r) => !r.html?.includes('SQL repeated')));
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
        assert.ok(repeats[0].html?.includes('SQL repeated #2'));
        const lines = s.allLines.filter((l) => l.type === 'line');
        const visibleTail = lines.filter((l) => !l.repeatHidden);
        assert.strictEqual(visibleTail.length, 1);
        assert.ok(visibleTail[0].html?.includes('Drift: Sent'));
    });

    test('Drift-shaped text without logcat prefix is not database-tagged (no SQL repeated label)', () => {
        const s = loadViewerRepeatSandbox();
        const t0 = 7_000_000;
        const bare = 'Drift: Sent SELECT 1 with args [x]';
        s.addToData(bare, false, 'stdout', t0, false, null, undefined, undefined, 'debug');
        s.addToData(bare, false, 'stdout', t0 + 50, false, null, undefined, undefined, 'debug');
        s.addToData(bare, false, 'stdout', t0 + 100, false, null, undefined, undefined, 'debug');

        const repeats = s.allLines.filter((l) => l.type === 'repeat-notification');
        assert.strictEqual(repeats.length, 2);
        assert.ok(repeats.every((r) => r.html?.includes('Repeated #')));
        assert.ok(repeats.every((r) => !r.html?.includes('SQL repeated')));
    });

    test('non-database identical lines use legacy repeat suppression wording', () => {
        const s = loadViewerRepeatSandbox();
        const t0 = 4_000_000;
        const msg = 'plain duplicate line without logcat prefix';
        s.addToData(msg, false, 'stdout', t0, false, null, undefined, undefined, 'debug');
        s.addToData(msg, false, 'stdout', t0 + 50, false, null, undefined, undefined, 'debug');
        s.addToData(msg, false, 'stdout', t0 + 100, false, null, undefined, undefined, 'debug');

        const repeats = s.allLines.filter((l) => l.type === 'repeat-notification');
        assert.strictEqual(repeats.length, 2);
        assert.ok(repeats.every((r) => r.html?.includes('Repeated #')));
        assert.ok(repeats.every((r) => !r.html?.includes('SQL repeated')));
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
