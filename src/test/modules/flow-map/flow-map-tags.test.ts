/**
 * Tests for the explicit `[flowmap]` tag verbs — `handoff` (bug 009) and `action` (bug 010).
 * Split out of flow-map.test.ts to keep both files under the max-lines gate; the `enter` verb
 * stays there because the core graph suites are built on it.
 */

import * as assert from 'assert';
import { parseLog } from '../../../modules/flow-map/flow-map-log-parser';
import { buildGraph } from '../../../modules/flow-map/flow-map-builder';
import { renderMermaid } from '../../../modules/flow-map/flow-map-mermaid';
import { buildReport } from '../../../modules/flow-map/flow-map-report';
import { renderSvg } from '../../../modules/flow-map/flow-map-svg';
import type { FlowGraph } from '../../../modules/flow-map/flow-map-model';

function nodeByKey(graph: FlowGraph, key: string) {
    return graph.nodes.find(n => n.key === key);
}

suite('FlowMap tag verbs', () => {

    suite('handoff (bug 009 — off-app external nodes)', () => {
        // A session that enters a screen, then hands off to Google Maps (app) and an API (api).
        const HANDOFF: readonly string[] = [
            '=== SAROPA LOG CAPTURE — SESSION START ===',
            'Project:        demo',
            '[08:00:01.000] [console] [log] [flowmap] enter screen "Contact View" lib/views/contact_view.dart:58',
            '[08:00:05.000] [console] [log] [FLOWMAP] handoff app "Google Maps" lib/utils/lat_lng_map_utils.dart:42',
            '[08:00:09.000] [console] [log] [flowmap] handoff api "wikipedia.search"',
            '[08:00:30.000] [console] [log] [flowmap] enter screen "Country View" lib/views/country_view.dart:12',
        ];

        test('parses app + api handoffs as external handoff events (case-insensitive, source optional)', () => {
            const events = parseLog(HANDOFF).events.filter(e => e.kind === 'handoff');
            assert.strictEqual(events.length, 2);
            const app = events.find(e => e.actionCategory === 'app');
            assert.strictEqual(app?.nodeKind, 'external');
            assert.strictEqual(app?.label, 'Google Maps');
            assert.strictEqual(app?.source?.file, 'lib/utils/lat_lng_map_utils.dart');
            assert.strictEqual(app?.source?.line, 42);
            const api = events.find(e => e.actionCategory === 'api');
            assert.strictEqual(api?.label, 'wikipedia.search');
            assert.strictEqual(api?.source, undefined);
        });

        test('builds external leaf nodes with an edge from the active screen, screen stays current', () => {
            const graph = buildGraph(parseLog(HANDOFF));
            const app = nodeByKey(graph, 'google maps');
            assert.strictEqual(app?.kind, 'external');
            assert.strictEqual(app?.source?.file, 'lib/utils/lat_lng_map_utils.dart');
            // api handoffs are prefixed so they read distinctly from app launches.
            assert.ok(nodeByKey(graph, 'api: wikipedia.search'), 'api node present with type prefix');
            // Edges fan out FROM the screen; the handoffs never become current — so Contact View, not
            // a handoff, owns the edge to the next screen (Country View).
            assert.ok(graph.edges.some(e => e.from === 'contact view' && e.to === 'google maps'));
            assert.ok(graph.edges.some(e => e.from === 'contact view' && e.to === 'api: wikipedia.search'));
            assert.ok(graph.edges.some(e => e.from === 'contact view' && e.to === 'country view'));
            assert.ok(!graph.edges.some(e => e.from === 'google maps'), 'external node is a leaf');
        });

        test('renderers give the external node a distinct style and no kind falls through to unknown', () => {
            const graph = buildGraph(parseLog(HANDOFF));
            const m = renderMermaid(graph);
            assert.ok(m.includes(':::external'), 'mermaid external class applied');
            const svg = renderSvg(graph);
            assert.ok(svg.includes('#a371f7'), 'svg external stroke color present');
            const md = buildReport(parseLog(HANDOFF), graph);
            assert.ok(md.includes('| external |'), 'report Type column shows external');
        });
    });

    suite('action tag (bug 010 — explicit in-screen actions)', () => {
        // A session that enters a screen, then fires two tagged actions (one repeated) on it.
        const ACTION: readonly string[] = [
            '=== SAROPA LOG CAPTURE — SESSION START ===',
            'Project:        demo',
            '[08:00:01.000] [console] [log] [flowmap] enter screen "Contact View" lib/views/contact_view.dart:58',
            '[08:00:05.000] [console] [log] [FLOWMAP] action "Favorite" lib/components/activity/activity_flag_button.dart:88',
            '[08:00:07.000] [console] [log] [flowmap] action "Favorite" lib/components/activity/activity_flag_button.dart:88',
            '[08:00:09.000] [console] [log] [flowmap] action "Share"',
        ];

        test('parses tagged actions with label = category (case-insensitive, source optional)', () => {
            const events = parseLog(ACTION).events.filter(e => e.kind === 'action');
            assert.strictEqual(events.length, 3);
            const fav = events[0];
            assert.strictEqual(fav.label, 'Favorite');
            assert.strictEqual(fav.actionCategory, 'Favorite');
            assert.strictEqual(fav.source?.file, 'lib/components/activity/activity_flag_button.dart');
            assert.strictEqual(fav.source?.line, 88);
            const share = events[2];
            assert.strictEqual(share.actionCategory, 'Share');
            assert.strictEqual(share.source, undefined);
        });

        test('folds tagged action counts onto the current node without creating nodes or edges', () => {
            const graph = buildGraph(parseLog(ACTION));
            const node = nodeByKey(graph, 'contact view');
            assert.strictEqual(node?.actionCounts['Favorite'], 2);
            assert.strictEqual(node?.actionCounts['Share'], 1);
            // Actions are counters on the screen, never nodes of their own.
            assert.strictEqual(nodeByKey(graph, 'favorite'), undefined);
            assert.ok(!graph.edges.some(e => e.to === 'favorite'), 'no edge to an action');
        });

        test('an action before any screen is entered is dropped, not crashed on', () => {
            const orphan = ['=== SAROPA LOG CAPTURE — SESSION START ===', 'Project: demo',
                '[08:00:01.000] [console] [log] [flowmap] action "Favorite"'];
            const graph = buildGraph(parseLog(orphan));
            assert.strictEqual(graph.nodes.length, 0);
        });

        test('the explicit tag wins over a heuristic match on the same line', () => {
            // The payload starts with heuristic-matching text; the tag parser runs first so the
            // line must classify as the tagged action, not a "Screen Navigation" nav event.
            const both = ['=== SAROPA LOG CAPTURE — SESSION START ===', 'Project: demo',
                '[08:00:01.000] [console] [log] [flowmap] enter screen "Home"',
                '[08:00:02.000] [console] [log] Screen Navigation: Ignored [flowmap] action "Share"'];
            const events = parseLog(both).events;
            assert.strictEqual(events[1].kind, 'action');
            assert.strictEqual(events[1].actionCategory, 'Share');
            assert.ok(!events.some(e => e.label === 'Ignored'), 'no nav event from the heuristic text');
        });

        test('a trailing correlation suffix after the quotes never leaks into category or source', () => {
            // The quote-bounded capture stops at the closing quote; the [sar-…] tail fails the
            // optional .dart anchor group, so the match succeeds with no source anchor.
            const suffixed = ['=== SAROPA LOG CAPTURE — SESSION START ===', 'Project: demo',
                '[08:00:01.000] [console] [log] [flowmap] enter screen "Home"',
                '[08:00:02.000] [console] [log] [flowmap] action "Favorite" [sar-abc-123]'];
            const action = parseLog(suffixed).events.find(e => e.kind === 'action');
            assert.strictEqual(action?.actionCategory, 'Favorite');
            assert.strictEqual(action?.source, undefined);
        });
    });
});
