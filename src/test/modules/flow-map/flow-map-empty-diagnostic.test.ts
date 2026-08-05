/**
 * Tests for the empty-state breadcrumb diagnostic (`flow-map-empty-diagnostic.ts`) — the heuristic
 * that turns a "no navigation breadcrumbs" dead end into onboarding by suggesting custom-rule
 * patterns built from the log's own repeated `Prefix: value` line shapes.
 */

import * as assert from 'assert';
import { parseLog } from '../../../modules/flow-map/flow-map-log-parser';
import { buildGraph } from '../../../modules/flow-map/flow-map-builder';
import { flowDiagramHtml } from '../../../modules/flow-map/flow-map-html';
import { suggestBreadcrumbPatterns } from '../../../modules/flow-map/flow-map-empty-diagnostic';

const line = (clock: string, text: string) => `[${clock}.000] [console] ${text}`;

suite('FlowMap empty-state breadcrumb diagnostic', () => {

    suite('suggestBreadcrumbPatterns', () => {
        test('should suggest a repeated "Route pushed: X" prefix with the right anchored pattern + count', () => {
            const lines = [
                line('08:00:01', 'Route pushed: HomePage'),
                line('08:00:02', 'Route pushed: SettingsPage'),
                line('08:00:03', 'Route pushed: ProfilePage'),
            ];
            const suggestions = suggestBreadcrumbPatterns(lines);
            assert.strictEqual(suggestions.length, 1);
            assert.strictEqual(suggestions[0].pattern, '^Route pushed:\\s+(.+)$');
            assert.strictEqual(suggestions[0].label, '$1');
            assert.strictEqual(suggestions[0].count, 3);
            assert.strictEqual(suggestions[0].sample, 'HomePage');
        });

        test('should see through the real stacked-bracket capture format', () => {
            // Real capture lines carry BOTH the DAP channel and Flutter's [log] marker. Stripping a
            // single bracket group left a '['-leading string that matched no prefix shape, so the
            // whole feature silently returned nothing for the exact format it targets.
            const real = [
                '[08:00:01.000] [console] [log] Route pushed: HomePage',
                '[08:00:02.000] [console] [log] Route pushed: SettingsPage',
            ];
            const suggestions = suggestBreadcrumbPatterns(real);
            assert.strictEqual(suggestions.length, 1);
            assert.strictEqual(suggestions[0].pattern, '^Route pushed:\\s+(.+)$');
            assert.strictEqual(suggestions[0].sample, 'HomePage');
        });

        test('should never suggest logcat tags or any prefix carrying a process id', () => {
            // These dominate a logcat-heavy capture by volume but are platform plumbing, and the
            // embedded pid changes each run — a generated rule would make junk nodes, then go stale.
            const noisy = [
                line('08:00:01', 'W/ViewRootImpl(15450): gpuCompletedTime unavailable'),
                line('08:00:02', 'W/ViewRootImpl(15450): gpuCompletedTime unavailable'),
                line('08:00:03', 'D/FirebaseSessions(15450): App foregrounded'),
                line('08:00:04', 'D/FirebaseSessions(15450): App foregrounded'),
                line('08:00:05', 'Worker(9911): started'),
                line('08:00:06', 'Worker(9911): started'),
            ];
            assert.strictEqual(suggestBreadcrumbPatterns(noisy).length, 0);
        });

        test('should support arrow separators and keep each shape\'s own rule', () => {
            const arrows = [
                line('08:00:01', 'Navigated -> HomePage'),
                line('08:00:02', 'Navigated -> Settings'),
            ];
            const suggestions = suggestBreadcrumbPatterns(arrows);
            assert.strictEqual(suggestions.length, 1);
            assert.strictEqual(suggestions[0].pattern, '^Navigated ->\\s+(.+)$');
            assert.ok(new RegExp(suggestions[0].pattern).test('Navigated -> HomePage'),
                'the generated rule matches the very line it was derived from');
        });

        test('should offer a lone navigation-worded line only when nothing repeats', () => {
            // A short capture can hold exactly one real route line; returning nothing there is the
            // dead end this feature exists to remove.
            const short = [line('08:00:01', 'Route pushed: HomePage'), line('08:00:02', 'Cache warm: done')];
            const suggestions = suggestBreadcrumbPatterns(short);
            assert.strictEqual(suggestions.length, 1);
            assert.strictEqual(suggestions[0].pattern, '^Route pushed:\\s+(.+)$');
            assert.strictEqual(suggestions[0].count, 1);
        });

        test('should prefer repeated shapes over lone navigation-worded ones', () => {
            const mixed = [
                line('08:00:01', 'Route pushed: HomePage'),
                line('08:00:02', 'Widget built: Card'),
                line('08:00:03', 'Widget built: List'),
            ];
            const suggestions = suggestBreadcrumbPatterns(mixed);
            assert.strictEqual(suggestions.length, 1, 'the repeated shape wins outright');
            assert.strictEqual(suggestions[0].pattern, '^Widget built:\\s+(.+)$');
        });

        test('should ignore prefixes seen only once when none reads as navigation', () => {
            // Singletons are dropped; the nav-worded fallback deliberately exempts route/screen/page
            // wording, so this fixture uses prefixes that carry no navigation sense at all.
            const lines = [
                line('08:00:01', 'Cache warm: done'),
                line('08:00:02', 'Something else: value'),
            ];
            assert.strictEqual(suggestBreadcrumbPatterns(lines).length, 0);
        });

        test('should NOT suggest "Screen Navigation:" — the built-in matcher already handles it', () => {
            const lines = [
                line('08:00:01', 'Screen Navigation: Contact View'),
                line('08:00:02', 'Screen Navigation: Home'),
                line('08:00:03', 'Screen Navigation: Settings'),
            ];
            assert.strictEqual(suggestBreadcrumbPatterns(lines).length, 0);
        });

        test('should escape regex metacharacters in the prefix', () => {
            const lines = [
                line('08:00:01', 'Nav (v2): HomePage'),
                line('08:00:02', 'Nav (v2): SettingsPage'),
            ];
            const suggestions = suggestBreadcrumbPatterns(lines);
            assert.strictEqual(suggestions.length, 1);
            assert.strictEqual(suggestions[0].pattern, '^Nav \\(v2\\):\\s+(.+)$');
            // The generated pattern must actually compile and match the source line.
            assert.ok(new RegExp(suggestions[0].pattern).test('Nav (v2): HomePage'));
        });

        test('should return [] and never throw on empty or garbage input', () => {
            assert.deepStrictEqual(suggestBreadcrumbPatterns([]), []);
            assert.doesNotThrow(() => suggestBreadcrumbPatterns(['garbage', '', '[not a clock] line']));
            // @ts-expect-error deliberately malformed input for the never-throws guarantee
            assert.doesNotThrow(() => suggestBreadcrumbPatterns(null));
        });

        test('should rank by count desc and cap at `max`', () => {
            const lines = [
                ...Array(2).fill(0).map((_v, i) => line(`08:00:0${i}`, 'A thing: x')),
                ...Array(4).fill(0).map((_v, i) => line(`08:01:0${i}`, 'B thing: y')),
            ];
            const suggestions = suggestBreadcrumbPatterns(lines, 1);
            assert.strictEqual(suggestions.length, 1);
            assert.strictEqual(suggestions[0].count, 4, 'the more frequent prefix wins the single slot');
        });
    });

    suite('empty-state HTML rendering', () => {
        // A log with no breadcrumbs, so the diagram graph has zero nodes.
        const emptyGraph = buildGraph(parseLog(['=== SAROPA LOG CAPTURE — SESSION START ===']));

        test('renders the suggestion block + button when suggestions exist', () => {
            const html = flowDiagramHtml(emptyGraph, false, '', [
                { pattern: '^Route pushed: (.+)$', label: '$1', sample: 'HomePage', count: 3 },
            ]);
            assert.ok(html.includes('fm-suggest'), 'suggestion block present');
            assert.ok(html.includes('fm-suggest-btn'), 'add-rule button present');
            assert.ok(html.includes('data-pattern="^Route pushed: (.+)$"'), 'pattern carried on the button');
        });

        test('renders NO fm-suggest block when there are no suggestions', () => {
            const html = flowDiagramHtml(emptyGraph, false, '', []);
            assert.ok(!html.includes('fm-suggest'), 'no suggestion block for an empty suggestion list');
        });
    });
});
