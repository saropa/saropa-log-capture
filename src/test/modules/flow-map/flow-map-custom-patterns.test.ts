/**
 * Tests for the user-configurable capture patterns (plan 117, Phase D) —
 * `saropaLogCapture.flowMap.customBreadcrumbs` / `customIssues`. Covers the pure compile/match
 * helpers directly, plus their end-to-end effect once threaded through `parseLog`/`buildGraph`.
 */

import * as assert from 'assert';
import { parseLog } from '../../../modules/flow-map/flow-map-log-parser';
import { buildGraph } from '../../../modules/flow-map/flow-map-builder';
import { compileCustomPatterns, matchCustomBreadcrumb, matchCustomIssue } from '../../../modules/flow-map/flow-map-custom-patterns';

/** Session header + helper to build a decorated log line tersely. */
const HEAD = ['=== SAROPA LOG CAPTURE — SESSION START ===', 'Project:        demo'];
const line = (clock: string, text: string) => `[${clock}.000] [console] [log] ${text}`;

suite('FlowMap custom capture patterns (plan 117, Phase D)', () => {

    suite('compileCustomPatterns', () => {
        test('should return empty patterns for non-array input', () => {
            const compiled = compileCustomPatterns(undefined, null);
            assert.strictEqual(compiled.breadcrumbs.length, 0);
            assert.strictEqual(compiled.issues.length, 0);
        });

        test('should skip an entry with an invalid regex without throwing', () => {
            const compiled = compileCustomPatterns(
                [{ pattern: '(unclosed' }, { pattern: 'Went to (\\w+)' }],
                [{ pattern: '(unclosed', category: 'Bad' }, { pattern: 'Timeout', category: 'Net' }],
            );
            assert.strictEqual(compiled.breadcrumbs.length, 1, 'invalid regex dropped, valid one kept');
            assert.strictEqual(compiled.issues.length, 1, 'invalid regex dropped, valid one kept');
        });

        test('should skip non-object entries and entries missing required fields', () => {
            const compiled = compileCustomPatterns(
                ['not an object', {}, { pattern: 'ok' }],
                [null, { category: 'no pattern' }, { pattern: 'ok' }],
            );
            assert.strictEqual(compiled.breadcrumbs.length, 1);
            assert.strictEqual(compiled.issues.length, 0, 'issue entries need BOTH pattern and category');
        });
    });

    suite('matchCustomBreadcrumb label template', () => {
        test('should substitute $1 from the first capture group', () => {
            const compiled = compileCustomPatterns([{ pattern: 'Went to (\\w+)' }], []);
            const match = matchCustomBreadcrumb(compiled, 'Went to Kitchen');
            assert.strictEqual(match?.kind, 'nav', 'defaults to nav when kind omitted');
            assert.strictEqual(match?.label, 'Kitchen');
        });

        test('should fall back to the whole match when the pattern has no capture group', () => {
            const compiled = compileCustomPatterns([{ pattern: 'Went home' }], []);
            const match = matchCustomBreadcrumb(compiled, 'Went home');
            assert.strictEqual(match?.label, 'Went home');
        });

        test('should default handoff nodeKind to external unless overridden', () => {
            const compiled = compileCustomPatterns([{ pattern: 'Opened (\\w+)', kind: 'handoff' }], []);
            const match = matchCustomBreadcrumb(compiled, 'Opened Maps');
            assert.strictEqual(match?.nodeKind, 'external');
        });
    });

    suite('matchCustomIssue', () => {
        test('should return undefined when nothing matches', () => {
            const compiled = compileCustomPatterns([], [{ pattern: 'Timeout', category: 'Net' }]);
            assert.strictEqual(matchCustomIssue(compiled, 'all fine here'), undefined);
        });

        test('should default detail to the category when detail is omitted', () => {
            const compiled = compileCustomPatterns([], [{ pattern: 'Timeout', category: 'Net' }]);
            const match = matchCustomIssue(compiled, 'Request Timeout after 30s');
            assert.strictEqual(match?.category, 'Net');
            assert.strictEqual(match?.detail, 'Net');
            assert.strictEqual(match?.severity, 'warn', 'defaults to warn');
        });
    });

    suite('threaded through parseLog/buildGraph', () => {
        test('should create a node from a custom nav breadcrumb', () => {
            const custom = compileCustomPatterns([{ pattern: 'Went to (\\w+)', nodeKind: 'screen' }], []);
            const lines = [...HEAD, line('08:00:01', 'Went to Kitchen')];
            const graph = buildGraph(parseLog(lines, undefined, custom));
            assert.ok(graph.nodes.some(n => n.key === 'kitchen'), 'custom breadcrumb produced a node');
        });

        test('should increment actionCounts from a custom action breadcrumb', () => {
            const custom = compileCustomPatterns(
                [
                    { pattern: 'Went to (\\w+)', nodeKind: 'screen' },
                    { pattern: 'Tapped (\\w+)', kind: 'action' },
                ],
                [],
            );
            const lines = [...HEAD, line('08:00:01', 'Went to Kitchen'), line('08:00:02', 'Tapped Fridge')];
            const graph = buildGraph(parseLog(lines, undefined, custom));
            const kitchen = graph.nodes.find(n => n.key === 'kitchen');
            assert.strictEqual(kitchen?.actionCounts['Fridge'], 1);
        });

        test('should dedup a repeated custom warn issue with the ×N count', () => {
            const custom = compileCustomPatterns([], [{ pattern: 'Retry storm', category: 'Net' }]);
            const warn = line('08:00:02', 'Retry storm detected');
            const lines = [...HEAD, line('08:00:01', 'Went to Kitchen'), warn, warn, warn];
            const parsed = parseLog(lines, undefined, custom);
            const rows = parsed.issues.filter(i => i.category === 'Net');
            assert.strictEqual(rows.length, 1, 'deduped to one row like built-in warnings');
            assert.ok(rows[0].detail.endsWith('×3'), `count appended: ${rows[0].detail}`);
        });

        test('should push a custom error-severity issue straight through, undeduped', () => {
            const custom = compileCustomPatterns(
                [], [{ pattern: 'Payment failed', category: 'Payment', severity: 'error' }],
            );
            const bad = line('08:00:02', 'Payment failed for order 7');
            const lines = [...HEAD, line('08:00:01', 'Went to Kitchen'), bad, bad];
            const parsed = parseLog(lines, undefined, custom);
            const rows = parsed.issues.filter(i => i.category === 'Payment');
            assert.strictEqual(rows.length, 2, 'error severity is not deduped');
            assert.strictEqual(rows[0].severity, 'error');
        });
    });
});
