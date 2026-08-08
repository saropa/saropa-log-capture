import * as assert from 'node:assert';
import * as os from 'node:os';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { buildScreenshotDiagnosis } from '../../../modules/screenshot/screenshot-diagnose';
import { ScreenshotStore } from '../../../modules/screenshot/screenshot-store';
import type { ScreenshotCapturer } from '../../../modules/screenshot/screenshot-capturer';
import {
    readScreenshotSettings, type ScreenshotSettings,
} from '../../../modules/screenshot/screenshot-settings';

/**
 * The diagnosis exists so a reader can ASK what the pipeline is doing, instead of having to have
 * been watching the output channel at the moment a one-time notice fired. These assert that the
 * answers are actually in it — a report that omits the state someone is debugging is worse than
 * none, because it looks authoritative.
 */
suite('screenshot capture diagnosis', () => {
    let logFsPath = '';

    setup(async () => {
        const dir = path.join(os.tmpdir(), `slc-diag-${process.hrtime.bigint()}`);
        await vscode.workspace.fs.createDirectory(vscode.Uri.file(dir));
        logFsPath = path.join(dir, 'session.log');
    });

    /**
     * Settings resolved through the REAL reader, over a configuration double. Going through
     * `readScreenshotSettings` is the point: the report must describe the values the pipeline
     * resolves, including its clamping, not a second interpretation of the same keys.
     */
    function settings(values: Record<string, unknown> = {}): ScreenshotSettings {
        const cfg = {
            get: (key: string, fallback?: unknown) => (key in values ? values[key] : fallback),
        } as unknown as vscode.WorkspaceConfiguration;
        return readScreenshotSettings(cfg);
    }

    /** Capturer double — the report only reads counters off it. */
    function capturer(logcatSuppressed = 0): ScreenshotCapturer {
        return { suppressedLogcatCrashes: logcatSuppressed } as unknown as ScreenshotCapturer;
    }

    test('should report every setting that decides whether a capture happens', async () => {
        const text = await buildScreenshotDiagnosis({
            capturer: capturer(), store: new ScreenshotStore(), logFsPath,
            settings: settings({
                'integrations.screenshots.enabled': false,
                'integrations.screenshots.onNavigation': true,
                'integrations.screenshots.skipNearDuplicates': true,
                'integrations.screenshots.duplicateSimilarity': 0.9,
            }),
            vmServiceUri: 'ws://127.0.0.1:1234/ws',
        });
        assert.ok(/enabled:\s+no/.test(text), 'the master toggle, which is the first thing to check');
        assert.ok(/on navigation:\s+yes/.test(text));
        assert.ok(/skip near-dupes:\s+yes/.test(text));
        assert.ok(/similarity:\s+0\.9/.test(text));
    });

    test('should report the CLAMPED value the pipeline uses, not the raw setting', () => {
        // The whole reason the report shares the pipeline's reader: a hand-edited settings.json can
        // hold a value capture never actually uses, and a report that echoed it would be lying.
        const resolved = settings({ 'integrations.screenshots.maxPerLog': 0 });
        assert.strictEqual(resolved.maxPerLog, 1, 'clamped up to the manifest minimum');
    });

    test('should name the missing VM Service, the most common reason captures never fire', async () => {
        const text = await buildScreenshotDiagnosis({
            capturer: capturer(), store: new ScreenshotStore(), logFsPath,
            settings: settings(), vmServiceUri: undefined,
        });
        assert.ok(text.includes('captures stay idle'), 'says what the absence MEANS, not just "no"');
    });

    test('should report in-process counts beside what is actually on disk', async () => {
        // The two disagreeing IS the answer to "why is my count wrong" — a pending or failed write.
        const store = new ScreenshotStore();
        await store.save(logFsPath, new Uint8Array([1]), {
            trigger: 'nav', timestamp: 1, logLine: 1, text: 'x', fingerprint: '',
        }, 10);
        store.noteSuppressed(logFsPath);
        const text = await buildScreenshotDiagnosis({
            capturer: capturer(), store, logFsPath, settings: settings(), vmServiceUri: 'ws://x/ws',
        });
        assert.ok(/captures kept:\s+1 this process, 1 on disk/.test(text), `kept counts: ${text}`);
        assert.ok(/near-dupes skipped:\s+1 this process, 0 on disk/.test(text), 'the pending write is visible');
        assert.ok(/count write queued:\s+yes/.test(text), 'and named as pending');
    });

    test('should give the paths, so a reader can look at the files themselves', async () => {
        const text = await buildScreenshotDiagnosis({
            capturer: capturer(), store: new ScreenshotStore(), logFsPath,
            settings: settings(), vmServiceUri: undefined,
        });
        assert.ok(text.includes(logFsPath), 'the log');
        assert.ok(text.includes('.screenshots'), 'the capture directory and sidecar');
    });

    test('should say plainly that there is nothing to count with no session running', async () => {
        const text = await buildScreenshotDiagnosis({
            capturer: capturer(), store: new ScreenshotStore(), logFsPath: undefined,
            settings: settings(), vmServiceUri: undefined,
        });
        assert.ok(text.includes('no session is running'), 'not a row of confusing zeroes');
        assert.ok(!text.includes('Where:'), 'and no paths that would be blank');
    });

    test('should carry the logcat replay count, which is otherwise session-end only', async () => {
        const text = await buildScreenshotDiagnosis({
            capturer: capturer(4), store: new ScreenshotStore(), logFsPath,
            settings: settings(), vmServiceUri: 'ws://x/ws',
        });
        assert.ok(/held as replay: 4/.test(text));
    });
});
