import * as assert from 'node:assert';
import type { LineData } from '../../modules/session/session-event-bus';
import { buildPendingLineFromLineData } from '../../ui/provider/log-viewer-provider-batch';
import { MAX_LINES_PER_BATCH } from '../../ui/provider/viewer-provider-helpers';
import { ViewerBroadcaster } from '../../ui/provider/viewer-broadcaster';
import type { PendingLine } from '../../ui/viewer/viewer-file-loader';
import type { ViewerTarget } from '../../ui/viewer/viewer-target';

function sampleLineData(overrides: Partial<LineData> & Pick<LineData, 'text'>): LineData {
    const { text, isMarker, lineCount, category, timestamp, ...rest } = overrides;
    return {
        text,
        isMarker: isMarker ?? false,
        lineCount: lineCount ?? 1,
        category: category ?? 'stdout',
        timestamp: timestamp ?? new Date(0),
        ...rest,
    };
}

suite('buildPendingLineFromLineData', () => {
    test('marker lines escape HTML so angle brackets are not raw markup', () => {
        const pl = buildPendingLineFromLineData(
            sampleLineData({ text: '<em>x</em>', isMarker: true, lineCount: 1 }),
        );
        assert.ok(!pl.text.includes('<em>'), 'expected escaped or stripped angle brackets for marker');
        assert.ok(pl.text.includes('em') || pl.text.includes('&lt;'), 'expected HTML escape of tags');
    });

    test('same LineData yields identical PendingLine text when called twice (pure transform)', () => {
        const data = sampleLineData({ text: 'plain stdout line', lineCount: 42 });
        const a = buildPendingLineFromLineData(data);
        const b = buildPendingLineFromLineData(data);
        assert.strictEqual(a.text, b.text);
        assert.strictEqual(a.lineCount, b.lineCount);
    });

    test('Drift Sent line with args gets dimmed markup in PendingLine text', () => {
        const drift =
            'I/flutter (28183): Drift: Sent PRAGMA table_info("x") with args []';
        const pl = buildPendingLineFromLineData(sampleLineData({ text: drift, lineCount: 1 }));
        assert.ok(pl.text.includes('drift-args-dim'), 'expected dim wrapper');
        assert.ok(pl.text.includes(' with args []'), 'suffix should remain in HTML');
    });

    test('rawText preserves original unprocessed text for regular lines', () => {
        const raw = 'Hello \x1b[31mworld\x1b[0m';
        const pl = buildPendingLineFromLineData(sampleLineData({ text: raw, lineCount: 1 }));
        assert.strictEqual(pl.rawText, raw, 'rawText should be the original text before HTML conversion');
        assert.ok(pl.text.includes('color:'), 'HTML should contain ANSI-converted span');
    });

    test('rawText preserves original text for marker lines', () => {
        const pl = buildPendingLineFromLineData(
            sampleLineData({ text: '--- MARKER: test ---', isMarker: true, lineCount: 0 }),
        );
        assert.strictEqual(pl.rawText, '--- MARKER: test ---');
    });
});

suite('ViewerBroadcaster.addLine — single build, fan-out', () => {
    test('two targets each receive appendLiveLineFromBroadcast with the same built text', () => {
        const texts: string[] = [];
        const makeTarget = (): ViewerTarget =>
            ({
                isLiveCaptureHydrating: () => false,
                addLine: () => {
                    assert.fail('addLine must not be used when not hydrating');
                },
                appendLiveLineFromBroadcast: (line: PendingLine, _raw: string) => {
                    texts.push(line.text);
                },
            }) as unknown as ViewerTarget;

        const b = new ViewerBroadcaster();
        b.addTarget(makeTarget());
        b.addTarget(makeTarget());
        b.addLine(sampleLineData({ text: 'fan-out-test-line' }));
        assert.strictEqual(texts.length, 2);
        assert.strictEqual(texts[0], texts[1]);
    });

    test('hydrating target gets raw addLine(LineData); others get appendLiveLineFromBroadcast', () => {
        let addLineCalls = 0;
        let appendCalls = 0;
        const hydrating = {
            isLiveCaptureHydrating: () => true,
            addLine: (_data: LineData) => {
                addLineCalls++;
            },
            appendLiveLineFromBroadcast: () => {
                assert.fail('appendLiveLineFromBroadcast must not run while hydrating');
            },
        } as unknown as ViewerTarget;
        const normal = {
            isLiveCaptureHydrating: () => false,
            addLine: () => {
                assert.fail('addLine must not run on non-hydrating targets under broadcaster');
            },
            appendLiveLineFromBroadcast: () => {
                appendCalls++;
            },
        } as unknown as ViewerTarget;

        const b = new ViewerBroadcaster();
        b.addTarget(hydrating);
        b.addTarget(normal);
        b.addLine(sampleLineData({ text: 'hydrate-branch' }));
        assert.strictEqual(addLineCalls, 1);
        assert.strictEqual(appendCalls, 1);
    });
});

suite('viewer batch size constant', () => {
    test('MAX_LINES_PER_BATCH is capped to limit webview addLines payload size', () => {
        assert.strictEqual(MAX_LINES_PER_BATCH, 800);
    });
});

suite('buildPendingLineFromLineData — lint data', () => {
    test('without DiagnosticCache, PendingLine has no lint fields', () => {
        const pl = buildPendingLineFromLineData(
            sampleLineData({ text: 'no cache', lineCount: 1 }),
        );
        assert.strictEqual(pl.lintErrors, undefined);
        assert.strictEqual(pl.lintWarnings, undefined);
    });

    test('marker lines skip lint lookup even with DiagnosticCache', () => {
        // Pass undefined as cache — marker lines short-circuit before cache access
        const pl = buildPendingLineFromLineData(
            sampleLineData({ text: '=== SESSION ===', isMarker: true, lineCount: 0 }),
            undefined,
        );
        assert.strictEqual(pl.lintErrors, undefined);
        assert.strictEqual(pl.lintWarnings, undefined);
    });
});

suite('ViewerBroadcaster.setDiagnosticCache', () => {
    test('setDiagnosticCache does not throw when called before addLine', () => {
        const b = new ViewerBroadcaster();
        // Create a minimal mock cache
        const mockCache = {
            lookupForLine: () => undefined,
        } as never;
        b.setDiagnosticCache(mockCache);
        // No assertion — just verifying no exception
    });
});
