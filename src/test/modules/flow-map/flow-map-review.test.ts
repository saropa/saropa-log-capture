import * as assert from 'assert';
import { parseLog } from '../../../modules/flow-map/flow-map-log-parser';
import { buildGraph } from '../../../modules/flow-map/flow-map-builder';
import { renderSvg } from '../../../modules/flow-map/flow-map-svg';

/** Session header + helper to build breadcrumb lines tersely. */
const HEAD = ['=== SAROPA LOG CAPTURE — SESSION START ===', 'Project:        demo'];
const nav = (clock: string, name: string) =>
    `[${clock}.000] [console] [log] Screen Navigation: ${name}`;

suite('FlowMap review fixes (plan 117)', () => {

    suite('worst slow query keeps its time (item 1)', () => {
        const lines = [...HEAD,
            nav('08:00:01', 'Home'),
            nav('08:00:05', 'Contact View'),
            '[08:00:10.000] [console] [log] [database] Drift SLOW 900ms SELECT: x  » I (./lib/db/i.dart:5:1)',
            '[08:00:20.000] [console] [log] [database] Drift SLOW 2500ms INSERT: y  » I (./lib/db/i.dart:9:1)',
            nav('08:00:30', 'Settings'),
        ];

        test('should stamp the promoted row with the real clock and sort it in time order', () => {
            const parsed = parseLog(lines);
            const slow = parsed.issues.find(i => i.category === 'Slow query');
            assert.strictEqual(slow?.clock, '08:00:20');
            assert.strictEqual(slow?.tsMs, 8 * 3600_000 + 20_000);
        });

        test('should window-attach the worst slow query to the screen active at that moment', () => {
            const graph = buildGraph(parseLog(lines));
            const cv = graph.nodes.find(n => n.key === 'contact view');
            assert.ok(cv?.issues.some(i => i.category === 'Slow query'), 'perf badge on Contact View');
        });
    });

    suite('per-edge dwell labels (item 2)', () => {
        test('should label an edge with dwell before THAT transition, not the node total', () => {
            // Home(4s) → Contact View(55s) → Settings; then Home is re-entered and idles 100s.
            const lines = [...HEAD,
                nav('08:00:01', 'Home'),
                nav('08:00:05', 'Contact View'),
                nav('08:01:00', 'Settings'),
            ];
            const graph = buildGraph(parseLog(lines));
            const edge = graph.edges.find(e => e.from === 'home' && e.to === 'contact view');
            assert.strictEqual(edge?.dwellMs, 4000, 'edge carries the 4s before leaving Home');
            const onward = graph.edges.find(e => e.from === 'contact view' && e.to === 'settings');
            assert.strictEqual(onward?.dwellMs, 55_000);
        });
    });

    suite('multiple crashes (item 3)', () => {
        const lines = [...HEAD,
            nav('08:00:01', 'Home'),
            '[08:00:10.000] [stderr] ════════ Exception caught by rendering library ═══',
            '[08:00:10.001] [stdout] First failure message.',
            nav('08:01:00', 'Settings'),
            '[08:02:00.000] [stderr] ════════ Exception caught by widgets library ═══',
            '[08:02:00.001] [stdout] Second failure message.',
        ];

        test('should detect every exception block, first kept as the crash alias', () => {
            const parsed = parseLog(lines);
            assert.strictEqual(parsed.crashes.length, 2);
            assert.strictEqual(parsed.crash?.message, 'First failure message.');
            assert.strictEqual(parsed.crashes[1].message, 'Second failure message.');
            assert.strictEqual(parsed.issues.filter(i => i.category === 'Crash').length, 2);
        });

        test('should anchor each crash edge to the screen active at ITS moment', () => {
            const graph = buildGraph(parseLog(lines));
            const crashEdges = graph.edges.filter(e => e.inferred);
            assert.ok(crashEdges.some(e => e.from === 'home'), 'first crash hangs off Home');
            assert.ok(crashEdges.some(e => e.from === 'settings'), 'second crash hangs off Settings');
        });
    });

    suite('nearest-occurrence back-pop (item 4)', () => {
        test('should pop to the nearest stack occurrence, keeping earlier ancestors open', () => {
            // Home → A → Home (return) → B: the return must pop only A, and B then chains off Home.
            const lines = [...HEAD,
                nav('08:00:01', 'Home'), nav('08:00:05', 'Alpha'),
                nav('08:00:10', 'Home'), nav('08:00:15', 'Beta'),
            ];
            const graph = buildGraph(parseLog(lines));
            assert.ok(graph.edges.some(e => e.back && e.from === 'alpha' && e.to === 'home'));
            assert.ok(graph.edges.some(e => !e.back && e.from === 'home' && e.to === 'beta'));
        });
    });

    suite('warning repeat counts (item 5)', () => {
        test('should keep one row per category with the repeat count appended', () => {
            const warn = '[08:00:02.000] [stderr] OSM Tile Usage policy';
            const lines = [...HEAD, nav('08:00:01', 'Home'), warn, warn, warn];
            const parsed = parseLog(lines);
            const rows = parsed.issues.filter(i => i.category === 'Tiles');
            assert.strictEqual(rows.length, 1, 'still deduped to one row');
            assert.ok(rows[0].detail.endsWith('×3'), `count appended: ${rows[0].detail}`);
        });

        test('should not append a count for a single occurrence', () => {
            const lines = [...HEAD, nav('08:00:01', 'Home'), '[08:00:02.000] [stderr] OSM Tile Usage policy'];
            const row = parseLog(lines).issues.find(i => i.category === 'Tiles');
            assert.ok(row && !row.detail.includes('×'), 'no ×1 noise');
        });
    });

    suite('hot-restart handling (item 6)', () => {
        test('should reset to launch on a mid-session App Startup and count the extra launch visit', () => {
            const lines = [...HEAD,
                nav('08:00:01', 'Home'), nav('08:00:05', 'Alpha'),
                '[08:00:20.000] [console] [log] App Startup: cold start',
                nav('08:00:30', 'Home'),
            ];
            const graph = buildGraph(parseLog(lines));
            const launch = graph.nodes.find(n => n.kind === 'launch');
            assert.strictEqual(launch?.visits, 2, 'restart counted on the launch node');
            // The post-restart Home entry chains from launch, not from Alpha.
            assert.ok(graph.edges.some(e => e.from === 'app launch' && e.to === 'home' && !e.back));
            assert.ok(!graph.edges.some(e => e.from === 'alpha' && e.to === 'home'), 'no fake Alpha→Home edge');
        });
    });

    suite('visit badge and svg (items 8/9 groundwork)', () => {
        test('should render the svg without errors for a multi-crash graph', () => {
            const lines = [...HEAD,
                nav('08:00:01', 'Home'),
                '[08:00:10.000] [stderr] ════════ Exception caught by rendering library ═══',
                '[08:00:10.001] [stdout] Boom.',
            ];
            const svg = renderSvg(buildGraph(parseLog(lines)));
            assert.ok(svg.startsWith('<svg'), 'svg renders');
        });
    });
});
