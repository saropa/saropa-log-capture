/**
 * The ONE place `integrations.screenshots.*` is read.
 *
 * It exists because there were two: the wiring read the keys to drive capture, and the diagnosis
 * report read them again to describe it. Two readers of the same settings is a reporting tool that
 * can confidently show a default for a key that was renamed — precisely when someone reaches for it
 * because they no longer trust the behavior. Now the report shows the values the pipeline is
 * actually using, because it is handed the same object.
 *
 * Values are CLAMPED here, not at the call site. A raw `cfg.get()` skips the validation `getConfig()`
 * performs, so a hand-edited `settings.json` (maxPerLog 0, duplicateSimilarity 0) would otherwise
 * silently disable capture while every UI surface showed the sensible number.
 *
 * Read one key at a time rather than through `getConfig()`, because this runs on the live capture
 * firehose and `getConfig()` rebuilds all ~256 settings per call — the same trade the error snackbar
 * documents.
 */

import type * as vscode from 'vscode';
import { clamp } from '../config/config-validation';
import type { ScreenshotTriggerSettings } from './screenshot-capturer';

/** Everything the screenshot pipeline is configured to do. */
export interface ScreenshotSettings extends ScreenshotTriggerSettings {
    /** Master toggle. When false nothing below it matters, but the report still shows it all. */
    readonly enabled: boolean;
}

/** Bounds for every numeric setting, so the clamp and the manifest cannot drift apart silently. */
export const SCREENSHOT_LIMITS = {
    cooldownMs: { min: 250, max: 60_000, fallback: 2000 },
    maxPerLog: { min: 1, max: 500, fallback: 50 },
    duplicateSimilarity: { min: 0.5, max: 0.999, fallback: 0.985 },
} as const;

/** Namespace prefix, named once so a key cannot be spelled two ways across this module. */
const PREFIX = 'integrations.screenshots';

/**
 * Just the master toggle. The capture path checks it per line, ahead of everything else, and reading
 * eight keys to answer one boolean is work the firehose does not need to do.
 */
export function readScreenshotEnabled(cfg: vscode.WorkspaceConfiguration): boolean {
    return cfg.get<boolean>(`${PREFIX}.enabled`, true);
}

/** Resolve the screenshot settings from a configuration, clamped and defaulted. */
export function readScreenshotSettings(cfg: vscode.WorkspaceConfiguration): ScreenshotSettings {
    const bool = (key: string, fallback: boolean): boolean =>
        cfg.get<boolean>(`${PREFIX}.${key}`, fallback);
    const num = (key: keyof typeof SCREENSHOT_LIMITS): number => {
        const { min, max, fallback } = SCREENSHOT_LIMITS[key];
        return clamp(cfg.get(`${PREFIX}.${key}`), min, max, fallback);
    };
    return {
        enabled: readScreenshotEnabled(cfg),
        onError: bool('onError', true),
        onWarning: bool('onWarning', false),
        onNavigation: bool('onNavigation', false),
        cooldownMs: num('cooldownMs'),
        maxPerLog: num('maxPerLog'),
        skipNearDuplicates: bool('skipNearDuplicates', true),
        duplicateSimilarity: num('duplicateSimilarity'),
    };
}
