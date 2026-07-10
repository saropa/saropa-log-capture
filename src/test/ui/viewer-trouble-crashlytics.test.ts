import * as assert from 'node:assert';
import * as vm from 'node:vm';
import { getTroubleCrashlyticsScript } from '../../ui/viewer-search-filter/viewer-trouble-crashlytics';

/**
 * Trouble Mode Crashlytics band — webview behaviors that are pure enough to pin in a VM:
 *  1. The freshness stamp disambiguates the CLOUD cache time from the log's own time by
 *     showing the date once the cache is not from today (the "Updated 9:17 AM beside an
 *     18:00 log" confusion).
 *  2. The collapse toggle flips the band class and the button's aria-expanded, mirroring the
 *     severity chart's toggle.
 */

/** Load the band script in a VM. With no `document` the bottom IIFE self-guards and no-ops. */
function load(extra: Record<string, unknown> = {}): Record<string, unknown> {
    const ctx = vm.createContext({ Number, String, console, Date, ...extra }) as Record<string, unknown>;
    vm.runInContext(getTroubleCrashlyticsScript(), ctx, { filename: 'trouble-crashlytics.js' });
    return ctx;
}

suite('Trouble Mode Crashlytics band — freshness stamp', () => {
    test('a cache from today shows time only; an older cache includes the date', () => {
        const ctx = load();
        const stamp = ctx.troubleCrashlyticsFreshStamp as (n: number) => string;
        const now = Date.now();
        // Exact glyphs are locale-dependent, so assert the relationship to toLocale*String,
        // not literal text: today === time-only, older !== time-only (it carries the date).
        assert.strictEqual(stamp(now), new Date(now).toLocaleTimeString(), 'today = time only');
        const older = now - 3 * 86_400_000;
        assert.strictEqual(stamp(older), new Date(older).toLocaleString(), 'older = date + time');
        assert.notStrictEqual(stamp(older), new Date(older).toLocaleTimeString(), 'older is not bare time');
    });
});

suite('Trouble Mode Crashlytics band — collapse', () => {
    test('toggling flips the band class and the button aria-expanded', () => {
        let collapsed = false;
        let aria = 'true';
        const band = { classList: { toggle: (_c: string, on: boolean) => { collapsed = on; } } };
        const btn = { addEventListener: () => {}, setAttribute: (_k: string, v: string) => { aria = v; } };
        const document = {
            getElementById: (id: string) =>
                id === 'trouble-crashlytics' ? band : (id === 'trouble-crashlytics-toggle' ? btn : null),
        };
        const ctx = load({ document });
        const toggle = ctx.toggleTroubleCrashlyticsCollapsed as () => void;

        toggle();
        assert.strictEqual(collapsed, true, 'collapsed on first toggle');
        assert.strictEqual(aria, 'false', 'aria-expanded false when collapsed');

        toggle();
        assert.strictEqual(collapsed, false, 'expanded on second toggle');
        assert.strictEqual(aria, 'true', 'aria-expanded true when expanded');
    });
});
