import * as assert from 'node:assert';
import * as vscode from 'vscode';
import { loadScreenshotSidecarEvents, getSourceLabel, getSourceColor } from '../../../modules/timeline/timeline-loader';

const sidecarUri = vscode.Uri.file('d:/reports/output.screenshots.json');

function sidecarJson(screenshots: unknown): string {
    return JSON.stringify({ version: 1, screenshots });
}

suite('loadScreenshotSidecarEvents', () => {
    test('should map sidecar entries to screenshot timeline events', () => {
        const events = loadScreenshotSidecarEvents(sidecarJson([
            { file: '001_error_1719849123456.png', trigger: 'error', timestamp: 1719849123456, logLine: 847, text: 'NullPointerException', fingerprint: 'a1' },
            { file: '002_nav_1719849125000.png', trigger: 'nav', timestamp: 1719849125000, logLine: 900, text: '', fingerprint: '' },
        ]), sidecarUri);
        assert.strictEqual(events.length, 2);
        assert.strictEqual(events[0].source, 'screenshot');
        assert.strictEqual(events[0].level, 'error');
        assert.strictEqual(events[0].timestamp, 1719849123456);
        assert.ok(events[0].summary.includes('line 847'));
        assert.ok(events[0].summary.includes('NullPointerException'));
        // Location points at the PNG inside the sibling .screenshots directory.
        assert.ok(events[0].location?.file.includes('output.screenshots/001_error_1719849123456.png'));
        assert.strictEqual(events[1].level, 'info');
    });

    test('should return empty on malformed or non-sidecar JSON', () => {
        assert.deepStrictEqual(loadScreenshotSidecarEvents('not json', sidecarUri), []);
        assert.deepStrictEqual(loadScreenshotSidecarEvents('{}', sidecarUri), []);
        assert.deepStrictEqual(loadScreenshotSidecarEvents(sidecarJson('nope'), sidecarUri), []);
    });

    test('should skip entries missing timestamp or file', () => {
        const events = loadScreenshotSidecarEvents(sidecarJson([
            { trigger: 'error', logLine: 1 },
            { file: 'x.png', trigger: 'manual' },
            null,
            { file: '003_manual_5.png', trigger: 'manual', timestamp: 5, logLine: 0, text: '', fingerprint: '' },
        ]), sidecarUri);
        assert.strictEqual(events.length, 1);
        // logLine 0 (manual, no anchor) must not fabricate a "(line 0)" suffix.
        assert.ok(!events[0].summary.includes('line 0'));
    });

    test('should have a label and color for the screenshot source', () => {
        assert.strictEqual(getSourceLabel('screenshot'), 'Screenshot');
        assert.ok(getSourceColor('screenshot').length > 0);
    });
});
