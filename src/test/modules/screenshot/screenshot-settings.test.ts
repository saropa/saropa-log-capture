import * as assert from 'node:assert';
import type * as vscode from 'vscode';
import {
    SCREENSHOT_LIMITS, readScreenshotEnabled, readScreenshotSettings,
} from '../../../modules/screenshot/screenshot-settings';

/**
 * The reader is the single source of what the screenshot pipeline is configured to do — both the
 * capturer and the diagnosis command go through it. These pin the two properties that makes it worth
 * having: that every key is read under its real name, and that out-of-range values are clamped to
 * what capture will actually use rather than passed through.
 */
suite('screenshot settings reader', () => {
    /** A configuration double that answers only the keys given, and defaults the rest. */
    function cfg(values: Record<string, unknown> = {}): vscode.WorkspaceConfiguration {
        return {
            get: (key: string, fallback?: unknown) => (key in values ? values[key] : fallback),
        } as unknown as vscode.WorkspaceConfiguration;
    }

    /** The full key, as it appears in package.json — a rename must break these tests. */
    const key = (name: string): string => `integrations.screenshots.${name}`;

    test('should default to capture-on-error with everything optional turned off', () => {
        const s = readScreenshotSettings(cfg());
        assert.strictEqual(s.enabled, true);
        assert.strictEqual(s.onError, true, 'errors are the default reason to capture');
        assert.strictEqual(s.onWarning, false);
        assert.strictEqual(s.onNavigation, false);
        assert.strictEqual(s.skipNearDuplicates, false, 'nothing that DISCARDS a capture is on by default');
    });

    test('should read every key under its published name', () => {
        // A renamed key would otherwise resolve to its default, silently, in both the pipeline and
        // the report that exists to tell you what the pipeline is doing.
        const s = readScreenshotSettings(cfg({
            [key('enabled')]: false,
            [key('onError')]: false,
            [key('onWarning')]: true,
            [key('onNavigation')]: true,
            [key('cooldownMs')]: 1234,
            [key('maxPerLog')]: 7,
            [key('skipNearDuplicates')]: true,
            [key('duplicateSimilarity')]: 0.97,
        }));
        assert.deepStrictEqual(s, {
            enabled: false, onError: false, onWarning: true, onNavigation: true,
            cooldownMs: 1234, maxPerLog: 7, skipNearDuplicates: true, duplicateSimilarity: 0.97,
        });
    });

    test('should CLAMP a hand-edited value to what capture will really use', () => {
        // A raw get() skips the validation getConfig() performs: maxPerLog 0 would silently disable
        // capture, and duplicateSimilarity 0 would make every capture a duplicate of the one before.
        const low = readScreenshotSettings(cfg({
            [key('cooldownMs')]: 0, [key('maxPerLog')]: 0, [key('duplicateSimilarity')]: 0,
        }));
        assert.strictEqual(low.cooldownMs, SCREENSHOT_LIMITS.cooldownMs.min);
        assert.strictEqual(low.maxPerLog, SCREENSHOT_LIMITS.maxPerLog.min);
        assert.strictEqual(low.duplicateSimilarity, SCREENSHOT_LIMITS.duplicateSimilarity.min);
        const high = readScreenshotSettings(cfg({
            [key('cooldownMs')]: 999_999, [key('maxPerLog')]: 999_999, [key('duplicateSimilarity')]: 5,
        }));
        assert.strictEqual(high.cooldownMs, SCREENSHOT_LIMITS.cooldownMs.max);
        assert.strictEqual(high.maxPerLog, SCREENSHOT_LIMITS.maxPerLog.max);
        assert.strictEqual(high.duplicateSimilarity, SCREENSHOT_LIMITS.duplicateSimilarity.max);
    });

    test('should answer the master toggle without reading the other seven keys', () => {
        // The capture path checks this per line, ahead of everything else.
        let reads = 0;
        const counting = {
            get: (key: string, fallback?: unknown) => { reads++; return key.endsWith('.enabled') ? false : fallback; },
        } as unknown as vscode.WorkspaceConfiguration;
        assert.strictEqual(readScreenshotEnabled(counting), false);
        assert.strictEqual(reads, 1, 'one key read, not the whole group');
    });

    test('should resolve the toggle to the same value either way', () => {
        // Two readers of one key is what this module exists to prevent.
        const values = { [key('enabled')]: false };
        assert.strictEqual(readScreenshotEnabled(cfg(values)), readScreenshotSettings(cfg(values)).enabled);
    });

    test('should fall back for a value of the wrong type rather than propagate it', () => {
        const s = readScreenshotSettings(cfg({ [key('maxPerLog')]: 'lots' }));
        assert.strictEqual(s.maxPerLog, SCREENSHOT_LIMITS.maxPerLog.fallback);
    });
});
