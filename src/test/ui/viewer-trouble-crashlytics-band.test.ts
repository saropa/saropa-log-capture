import * as assert from 'node:assert';
import * as vm from 'node:vm';
import { getTroubleCrashlyticsScript } from '../../ui/viewer-search-filter/viewer-trouble-crashlytics';
import { stringsWebview } from '../../l10n/strings-webview';

/**
 * Trouble Mode Crashlytics band (plan 110, Stage 5) — band composition.
 *
 * Pins the three contracts the compaction introduced:
 *  1. Only TROUBLE_CRASHLYTICS_BAND_ROWS rows render inline; the rest are reachable only
 *     through the "All N issues" link. The band is a triage cue, not the issue backlog —
 *     a longer list costs the feed more height than it returns.
 *  2. "All N issues" states the host's `total` (the non-archived count BEFORE the host's
 *     own row cap), never the number of rows that happen to have been posted. Showing the
 *     posted count would understate the backlog whenever the host cap bites.
 *  3. The band labels its own staleness. Rows are read from the watcher's on-disk cache
 *     and never refetched here, so an unlabeled list would imply a liveness it lacks.
 *
 * A cold cache (no rows) must hide the band entirely rather than render an empty shell.
 */

/** The subset of the DOM the band script touches, recorded so assertions can read it back. */
interface StubEl {
    innerHTML: string;
    textContent: string;
    classes: Set<string>;
    classList: { add(c: string): void; remove(c: string): void; contains(c: string): boolean };
    addEventListener(): void;
}

function stubEl(): StubEl {
    const classes = new Set<string>();
    return {
        innerHTML: '',
        textContent: '',
        classes,
        classList: {
            add: (c: string) => { classes.add(c); },
            remove: (c: string) => { classes.delete(c); },
            contains: (c: string) => classes.has(c),
        },
        addEventListener: () => { /* the band's click delegation is not under test here */ },
    };
}

interface BandCtx {
    els: Record<string, StubEl>;
    render(msg: unknown): void;
    bandRows: number;
}

/**
 * Load the band script against a stub document. `vt` resolves against the REAL English
 * catalog and substitutes {0}/{1} exactly as viewer-l10n-inject.ts does, so the assertions
 * read composed user-visible strings — and a key deleted from the catalog fails here rather
 * than shipping as raw-key text in the UI.
 */
function loadBand(): BandCtx {
    const ids = ['trouble-crashlytics', 'trouble-crashlytics-rows', 'trouble-crashlytics-fresh', 'trouble-crashlytics-more'];
    const els: Record<string, StubEl> = {};
    for (const id of ids) { els[id] = stubEl(); }

    const vt = (key: string, ...args: unknown[]): string => {
        const template = stringsWebview[key as keyof typeof stringsWebview];
        assert.ok(template, `webview string key missing from the catalog: ${key}`);
        return args.reduce<string>((acc, a, i) => acc.split(`{${i}}`).join(String(a)), template);
    };

    const ctx = vm.createContext({
        vt,
        Date,
        document: { getElementById: (id: string) => els[id] ?? null },
        window: {},
    }) as Record<string, unknown>;
    vm.runInContext(getTroubleCrashlyticsScript(), ctx, { filename: 'trouble-crashlytics-band.js' });

    return {
        els,
        render: ctx.renderTroubleCrashlyticsRows as (msg: unknown) => void,
        bandRows: ctx.TROUBLE_CRASHLYTICS_BAND_ROWS as number,
    };
}

/** N synthetic rows, titled so a rendered row can be identified by index. */
function rows(n: number): unknown[] {
    return Array.from({ length: n }, (_, i) => ({
        id: `id-${i}`, title: `issue-${i}`, subtitle: 's', events: '9', users: '4',
        fatal: false, kind: 'nonfatal', state: 'OPEN', fv: '1.0', lv: '1.0',
    }));
}

suite('Trouble Mode Crashlytics band — composition', () => {
    test('renders at most TROUBLE_CRASHLYTICS_BAND_ROWS rows inline', () => {
        const band = loadBand();
        assert.strictEqual(band.bandRows, 5, 'band row cap');
        band.render({ rows: rows(12), total: 12, cachedAt: 1_700_000_000_000 });

        const html = band.els['trouble-crashlytics-rows'].innerHTML;
        assert.strictEqual(html.split('class="tcx-row"').length - 1, 5, 'exactly five rows drawn');
        assert.ok(html.includes('issue-4'), 'the fifth-busiest issue is shown');
        assert.ok(!html.includes('issue-5'), 'the sixth is not — it lives behind the link');
    });

    test('"All N issues" reports the host total, not the number of rows posted', () => {
        const band = loadBand();
        // The host caps `rows` at 15 but reports the true non-archived backlog in `total`.
        band.render({ rows: rows(15), total: 63, cachedAt: 1_700_000_000_000 });

        const more = band.els['trouble-crashlytics-more'];
        assert.ok(more.innerHTML.includes('All 63 issues'), 'link states the real backlog size');
        assert.ok(!more.classes.has('u-hidden'), 'link is visible when issues are hidden');
    });

    test('no "All N issues" link when every issue is already on screen', () => {
        const band = loadBand();
        band.render({ rows: rows(3), total: 3, cachedAt: 1_700_000_000_000 });

        const more = band.els['trouble-crashlytics-more'];
        assert.ok(more.classes.has('u-hidden'), 'link hidden — nothing is hidden behind it');
        assert.strictEqual(more.innerHTML, '', 'and its markup is cleared');
    });

    test('freshness label states the cache write time, or says cached when unstamped', () => {
        const band = loadBand();
        const at = 1_700_000_000_000;
        band.render({ rows: rows(2), total: 2, cachedAt: at });
        assert.strictEqual(
            band.els['trouble-crashlytics-fresh'].textContent,
            `Updated ${new Date(at).toLocaleTimeString()}`,
            'absolute clock time — a relative label would rot, the band is not re-rendered as it ages',
        );

        // A cache written before the cachedAt stamp existed must not render "Updated undefined".
        const stale = loadBand();
        stale.render({ rows: rows(2), total: 2 });
        assert.strictEqual(stale.els['trouble-crashlytics-fresh'].textContent, 'Cached', 'unstamped cache degrades');
    });

    test('a cold cache hides the band instead of rendering an empty shell', () => {
        const band = loadBand();
        band.render({ rows: [], total: 0 });
        assert.ok(band.els['trouble-crashlytics'].classes.has('u-hidden'), 'band hidden');
        assert.strictEqual(band.els['trouble-crashlytics-rows'].innerHTML, '', 'no rows');
    });
});
