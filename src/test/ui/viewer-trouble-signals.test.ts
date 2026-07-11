import * as assert from 'node:assert';
import * as vm from 'node:vm';
import { getTroubleSignalsScript } from '../../ui/viewer-search-filter/viewer-trouble-signals';

/**
 * Trouble Mode Signals band — renders the current log's top signals (signalsInThisLog) and hides
 * when there are none. Pinned in a VM with a stub DOM; the band's IIFE self-guards on `document`.
 */

interface StubEl { innerHTML: string; textContent: string; classes: Set<string>; classList: { add(c: string): void; remove(c: string): void; toggle(c: string, on?: boolean): void; contains(c: string): boolean }; setAttribute(k: string, v: string): void; attrs: Record<string, string>; listeners: Record<string, (e: unknown) => void>; addEventListener(t: string, fn: (e: unknown) => void): void }

function el(): StubEl {
    const classes = new Set<string>();
    const attrs: Record<string, string> = {};
    const listeners: Record<string, (e: unknown) => void> = {};
    return {
        innerHTML: '', textContent: '', classes, attrs, listeners,
        classList: {
            add: (c) => { classes.add(c); },
            remove: (c) => { classes.delete(c); },
            toggle: (c, on) => { const want = on === undefined ? !classes.has(c) : on; want ? classes.add(c) : classes.delete(c); },
            contains: (c) => classes.has(c),
        },
        setAttribute: (k, v) => { attrs[k] = v; },
        addEventListener: (t, fn) => { listeners[t] = fn; },
    };
}

function load(signalsInThisLog: unknown[] | undefined): { ctx: Record<string, unknown>; els: Record<string, StubEl>; jumps: number[] } {
    const els: Record<string, StubEl> = {
        'trouble-signals': el(), 'trouble-signals-rows': el(),
        'trouble-signals-count': el(), 'trouble-signals-more': el(), 'trouble-signals-toggle': el(),
        'trouble-signals-title': el(),
    };
    const jumps: number[] = [];
    const ctx = vm.createContext({
        document: { getElementById: (id: string) => els[id] ?? null },
        signalDataCache: signalsInThisLog === undefined ? undefined : { signalsInThisLog },
        vt: (key: string, ...a: unknown[]) => key + (a.length ? ':' + a.join(',') : ''),
        scrollToLineNumber: (n: number) => { jumps.push(n); },
        parseInt, isNaN,
    }) as Record<string, unknown>;
    vm.runInContext(getTroubleSignalsScript(), ctx, { filename: 'trouble-signals.js' });
    return { ctx, els, jumps };
}

suite('Trouble Mode Signals band', () => {
    test('renders the top signals and shows the band', () => {
        const { ctx, els } = load([
            { label: 'RenderFlex overflowed', totalOccurrences: 12, lineIndices: [40] },
            { label: 'Slow query', totalOccurrences: 3, lineIndices: [] },
        ]);
        (ctx.renderTroubleSignalsBand as () => void)();
        assert.ok(!els['trouble-signals'].classes.has('u-hidden'), 'band shown when there are signals');
        assert.match(els['trouble-signals-rows'].innerHTML, /RenderFlex overflowed/, 'first signal rendered');
        assert.match(els['trouble-signals-rows'].innerHTML, /tsg-jumpable[^>]*data-line="40"/, 'a signal with a line is jumpable');
        assert.doesNotMatch(els['trouble-signals-rows'].innerHTML, /Slow query[^<]*<\/span><span class="tsg-count">[^<]*<\/span><\/button>\s*<button[^>]*tsg-jumpable/, 'a signal with no line is not jumpable');
        assert.match(els['trouble-signals-count'].textContent, /2/, 'head count reflects total');
    });

    test('hides the band when the log has no signals', () => {
        const { ctx, els } = load([]);
        (ctx.renderTroubleSignalsBand as () => void)();
        assert.ok(els['trouble-signals'].classes.has('u-hidden'), 'band hidden on empty');
        assert.strictEqual(els['trouble-signals-rows'].innerHTML, '', 'no rows');
    });

    test('tolerates a missing signal cache (never-loaded panel)', () => {
        const { ctx, els } = load(undefined);
        (ctx.renderTroubleSignalsBand as () => void)();
        assert.ok(els['trouble-signals'].classes.has('u-hidden'), 'band hidden when the cache is absent');
    });

    test('caps the band at five rows and shows the "All N" link', () => {
        const many = Array.from({ length: 7 }, (_v, i) => ({ label: 'sig' + i, totalOccurrences: i + 1, lineIndices: [i] }));
        const { ctx, els } = load(many);
        (ctx.renderTroubleSignalsBand as () => void)();
        const rowCount = (els['trouble-signals-rows'].innerHTML.match(/class="tsg-row/g) || []).length;
        assert.strictEqual(rowCount, 5, 'only TROUBLE_SIGNALS_BAND_ROWS rows render');
        assert.ok(!els['trouble-signals-more'].classes.has('u-hidden'), 'the "All N" link shows when there are more');
        assert.match(els['trouble-signals-count'].textContent, /7/, 'the head count is the full total, not the shown count');
    });

    test('clicking a jumpable row scrolls the feed to its 1-based line', () => {
        const { els, jumps } = load([{ label: 'RenderFlex', totalOccurrences: 2, lineIndices: [40] }]);
        const clickHandler = els['trouble-signals-rows'].listeners.click;
        assert.ok(clickHandler, 'the rows container has a delegated click handler');
        // The handler reads data-line (0-based) off the closest .tsg-jumpable and adds 1.
        clickHandler({ target: { closest: (sel: string) => sel === '.tsg-jumpable' ? { getAttribute: (k: string) => (k === 'data-line' ? '40' : null) } : null } });
        assert.deepStrictEqual(jumps, [41], 'scrollToLineNumber called with the 1-based line');
    });

    test('collapse toggles the band class and the button aria', () => {
        const { ctx, els } = load([{ label: 'x', totalOccurrences: 1, lineIndices: [1] }]);
        const toggle = ctx.toggleTroubleSignalsCollapsed as () => void;
        toggle();
        assert.ok(els['trouble-signals'].classes.has('tsg-collapsed'), 'collapsed on first toggle');
        assert.strictEqual(els['trouble-signals-toggle'].attrs['aria-expanded'], 'false', 'aria false');
        toggle();
        assert.ok(!els['trouble-signals'].classes.has('tsg-collapsed'), 'expanded on second toggle');
        assert.strictEqual(els['trouble-signals-toggle'].attrs['aria-expanded'], 'true', 'aria true');
    });
});
