import * as assert from 'assert';
import { processApiWriteLine, OutputEventTarget, WriteLineDeps } from '../../../modules/session/session-manager-events';
import { FloodGuard } from '../../../modules/capture/flood-guard';
import { parseExclusionPattern } from '../../../modules/features/exclusion-matcher';
import type { LineData } from '../../../modules/session/session-event-bus';

/** Minimal mock LogSession for testing appendLine and lineCount. */
function mockSession() {
    const lines: string[] = [];
    return {
        lines,
        lineCount: 0,
        state: 'recording' as const,
        appendLine(text: string) { lines.push(text); this.lineCount++; },
    };
}

/** Build deps with sensible defaults. */
function makeDeps(overrides?: Partial<WriteLineDeps>): WriteLineDeps {
    return {
        config: { enabled: true },
        exclusionRules: [],
        floodGuard: new FloodGuard(),
        ...overrides,
    };
}

/** Build target that collects broadcast calls. */
function makeTarget(): OutputEventTarget & { broadcasts: Omit<LineData, 'watchHits'>[] } {
    const broadcasts: Omit<LineData, 'watchHits'>[] = [];
    return {
        broadcasts,
        counters: { categoryCounts: {}, floodSuppressedTotal: 0 },
        broadcastLine: (data) => { broadcasts.push(data); },
    };
}

/** Build a WriteLineInput from simple args. */
function input(session: unknown, text: string, category = 'console', timestamp = new Date()) {
    return { session: session as any, text, category, timestamp };
}

suite('processApiWriteLine', () => {

    test('should write a single line and broadcast it', () => {
        const session = mockSession();
        const target = makeTarget();
        const now = new Date();
        processApiWriteLine(makeDeps(), target, input(session, 'hello world', 'console', now));
        assert.strictEqual(session.lines.length, 1);
        assert.strictEqual(session.lines[0], 'hello world');
        assert.strictEqual(target.broadcasts.length, 1);
        assert.strictEqual(target.broadcasts[0].text, 'hello world');
        assert.strictEqual(target.broadcasts[0].category, 'console');
        assert.strictEqual(target.broadcasts[0].isMarker, false);
    });

    test('should split multi-line text into separate lines', () => {
        const session = mockSession();
        const target = makeTarget();
        processApiWriteLine(makeDeps(), target, input(session, 'line1\nline2\nline3'));
        assert.strictEqual(session.lines.length, 3);
        assert.strictEqual(target.broadcasts.length, 3);
        assert.strictEqual(target.broadcasts[0].text, 'line1');
        assert.strictEqual(target.broadcasts[1].text, 'line2');
        assert.strictEqual(target.broadcasts[2].text, 'line3');
    });

    test('should strip trailing newline before splitting', () => {
        const session = mockSession();
        const target = makeTarget();
        processApiWriteLine(makeDeps(), target, input(session, 'hello\n'));
        assert.strictEqual(session.lines.length, 1);
        assert.strictEqual(session.lines[0], 'hello');
    });

    test('should handle Windows \\r\\n line endings without leaking \\r', () => {
        const session = mockSession();
        const target = makeTarget();
        processApiWriteLine(makeDeps(), target, input(session, 'line1\r\nline2\r\nline3\r\n'));
        assert.strictEqual(session.lines.length, 3);
        assert.strictEqual(session.lines[0], 'line1');
        assert.strictEqual(session.lines[1], 'line2');
        assert.strictEqual(session.lines[2], 'line3');
    });

    test('should allow empty strings (blank lines)', () => {
        const session = mockSession();
        const target = makeTarget();
        processApiWriteLine(makeDeps(), target, input(session, ''));
        assert.strictEqual(session.lines.length, 1);
        assert.strictEqual(session.lines[0], '');
        assert.strictEqual(target.broadcasts.length, 1);
    });

    test('should apply exclusion rules', () => {
        const session = mockSession();
        const target = makeTarget();
        const rule = parseExclusionPattern('secret');
        assert.ok(rule, 'parseExclusionPattern should return a rule');
        const deps = makeDeps({ exclusionRules: [rule] });
        processApiWriteLine(deps, target, input(session, 'secret data'));
        assert.strictEqual(session.lines.length, 0);
        assert.strictEqual(target.broadcasts.length, 0);
    });

    test('should no-op when capture is disabled', () => {
        const session = mockSession();
        const target = makeTarget();
        const deps = makeDeps({ config: { enabled: false } });
        processApiWriteLine(deps, target, input(session, 'hello'));
        assert.strictEqual(session.lines.length, 0);
        assert.strictEqual(target.broadcasts.length, 0);
    });

    test('should use custom category in broadcast', () => {
        const session = mockSession();
        const target = makeTarget();
        processApiWriteLine(makeDeps(), target, input(session, 'query result', 'drift-perf'));
        assert.strictEqual(target.broadcasts[0].category, 'drift-perf');
        assert.strictEqual(target.counters.categoryCounts['drift-perf'], 1);
    });

    test('should use provided timestamp in broadcast', () => {
        const session = mockSession();
        const target = makeTarget();
        const past = new Date('2025-01-01T00:00:00Z');
        processApiWriteLine(makeDeps(), target, input(session, 'old event', 'console', past));
        assert.strictEqual(target.broadcasts[0].timestamp, past);
    });

    test('should not filter by category whitelist', () => {
        const session = mockSession();
        const target = makeTarget();
        processApiWriteLine(makeDeps(), target, input(session, 'test', 'custom-cat'));
        assert.strictEqual(session.lines.length, 1);
    });
});
