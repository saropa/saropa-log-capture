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
            assert.strictEqual(suggestions[0].pattern, '^Route pushed: (.+)$');
            assert.strictEqual(suggestions[0].label, '$1');
            assert.strictEqual(suggestions[0].count, 3);
            assert.strictEqual(suggestions[0].sample, 'HomePage');
        });

        test('should ignore prefixes seen only once', () => {
            const lines = [
                line('08:00:01', 'Route pushed: HomePage'),
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
            assert.strictEqual(suggestions[0].pattern, '^Nav \\(v2\\): (.+)$');
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
