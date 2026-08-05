import * as assert from 'assert';
import { parseLog } from '../../../modules/flow-map/flow-map-log-parser';
import { buildGraph } from '../../../modules/flow-map/flow-map-builder';
import { renderSvg } from '../../../modules/flow-map/flow-map-svg';
import { buildFlowDiagramBody, buildFlowMapBody } from '../../../modules/flow-map/flow-map-html';

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

        test('should not let a widget-less crash steal the NEXT crash\'s widget anchor', () => {
            // Crash #1 has no "error-causing widget" block; crash #2 does. The widget scan must stop
            // at the next banner, or crash #1 walks forward and claims x_dialog.dart as its own.
            const twoCrashes = ['=== SAROPA LOG CAPTURE — SESSION START ===', 'Project: demo',
                '  projectRootPath: "D:\\\\src\\\\demo"',
                nav('08:00:01', 'Home'),
                '[08:00:10.000] [stderr] ════════ Exception caught by rendering library ═══',
                '[08:00:10.001] [stdout] Widgetless failure.',
                nav('08:01:00', 'Settings'),
                '[08:02:00.000] [stderr] ════════ Exception caught by widgets library ═══',
                '[08:02:00.001] [stdout] Widgeted failure.',
                '[08:02:00.002] [stdout] The relevant error-causing widget was:',
                '[08:02:00.003] [stdout]     ListView ListView:file:///D:/src/demo/lib/views/x_dialog.dart:42:14',
            ];
            const parsed = parseLog(twoCrashes);
            assert.strictEqual(parsed.crashes.length, 2);
            assert.strictEqual(parsed.crashes[0].widget, undefined, 'crash #1 has no widget of its own');
            assert.strictEqual(parsed.crashes[0].source, undefined, 'crash #1 must not claim crash #2\'s anchor');
            assert.strictEqual(parsed.crashes[1].widget, 'ListView');
            assert.strictEqual(parsed.crashes[1].source?.file, 'lib/views/x_dialog.dart');
        });

        test('should anchor each crash edge to the screen active at ITS moment', () => {
            const graph = buildGraph(parseLog(lines));
            const crashEdges = graph.edges.filter(e => e.inferred);
            assert.ok(crashEdges.some(e => e.from === 'home'), 'first crash hangs off Home');
            assert.ok(crashEdges.some(e => e.from === 'settings'), 'second crash hangs off Settings');
        });

        test('should anchor a crash in a revisit gap to the screen ACTUALLY current, not the revisited one', () => {
            // Home 8:00 → Alpha 8:05 (crash 8:06 while ON Alpha) → Home 8:10. Home's dwell WINDOW
            // spans 8:00–end and would swallow the 8:06 crash; the occupancy segments must not.
            const gapLines = [...HEAD,
                nav('08:00:01', 'Home'),
                nav('08:05:00', 'Alpha'),
                '[08:06:00.000] [stderr] ════════ Exception caught by rendering library ═══',
                '[08:06:00.001] [stdout] Gap failure.',
                nav('08:10:00', 'Home'),
            ];
            const graph = buildGraph(parseLog(gapLines));
            const crashEdge = graph.edges.find(e => e.inferred);
            assert.strictEqual(crashEdge?.from, 'alpha', 'crash hangs off Alpha, not the revisited Home');
        });

        test('should anchor a crash at the exact transition instant to the NEWLY entered screen', () => {
            // Segment boundaries touch: Home's stay ends at the same ms Alpha's begins. The later
            // segment wins the tie — the crash renders off the surface the user just landed on.
            const tieLines = [...HEAD,
                nav('08:00:01', 'Home'),
                nav('08:05:00', 'Alpha'),
                '[08:05:00.000] [stderr] ════════ Exception caught by rendering library ═══',
                '[08:05:00.001] [stdout] Boundary failure.',
                nav('08:10:00', 'Beta'),
            ];
            const graph = buildGraph(parseLog(tieLines));
            const crashEdge = graph.edges.find(e => e.inferred);
            assert.strictEqual(crashEdge?.from, 'alpha', 'tie resolves to the newly entered screen');
        });

        test('should render a valid (non-negative) svg and an empty note for a breadcrumb-less log', () => {
            // A logcat-only capture yields zero nodes; the layout previously computed height="-2",
            // an invalid SVG browsers render as NOTHING — the report showed a silent blank space.
            const noCrumbs = parseLog([...HEAD, '[08:00:01.000] [logcat] D Foo: system noise']);
            const graph = buildGraph(noCrumbs);
            assert.strictEqual(graph.nodes.length, 0, 'nothing classified');
            const svg = renderSvg(graph);
            assert.ok(!/height="-/.test(svg) && !/viewBox="[^"]*-/.test(svg), 'no negative dimensions');
            const body = buildFlowMapBody(noCrumbs, graph);
            assert.ok(body.includes('fm-empty'), 'empty-state note shown');
            assert.ok(!body.includes('fm-zoom-toolbar'), 'no dead zoom toolbar over an empty diagram');
            // A glyph key beside "no breadcrumbs" has nothing to decode — suppressed in both bodies.
            assert.ok(!body.includes('fm-legend-tip'), 'no legend over an empty diagram');
            assert.ok(!buildFlowDiagramBody(graph).includes('fm-legend-tip'), 'same in the pop-out');
        });

        test('should distinguish a scanned-but-breadcrumbless log from one with no timestamps', () => {
            // Both yield zero nodes; only the second suggests the capture format itself is off. A
            // parser regression would otherwise wear the "instrument your app" note and mislead.
            const scanned = parseLog([...HEAD, '[08:00:01.000] [logcat] D Foo: noise']);
            const scannedBody = buildFlowMapBody(scanned, buildGraph(scanned));
            assert.ok(scannedBody.includes('08:00:01'), 'names the last scanned clock');

            const untimed = parseLog([...HEAD, 'plain untimestamped output']);
            const untimedBody = buildFlowMapBody(untimed, buildGraph(untimed));
            assert.ok(!untimedBody.includes('08:00:01'), 'no clock to report');
            assert.ok(untimedBody.includes('fm-empty-detail'), 'still explains the empty state');
        });

        test('should keep the legend and toolbar once the graph has real nodes', () => {
            const walked = parseLog([...HEAD, nav('08:00:01', 'Home'), nav('08:00:05', 'Alpha')]);
            const body = buildFlowMapBody(walked, buildGraph(walked));
            assert.ok(body.includes('fm-legend-tip'), 'legend present for a real diagram');
            assert.ok(body.includes('fm-zoom-toolbar'), 'toolbar present for a real diagram');
            assert.ok(!body.includes('fm-empty'), 'no empty note when nodes exist');
        });

        test('should detect a gesture exception banner (no "library" suffix)', () => {
            const gestureLines = [...HEAD,
                nav('08:00:01', 'Home'),
                '[08:00:10.000] [stderr] ════════ Exception caught by gesture ═══',
                '[08:00:10.001] [stdout] Tap handler threw.',
            ];
            const parsed = parseLog(gestureLines);
            assert.strictEqual(parsed.crashes.length, 1, 'gesture banner detected');
            assert.strictEqual(parsed.crashes[0].message, 'Tap handler threw.');
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

    suite('svg polish (items 7-10)', () => {
        test('should color nodes/edges via theme palette classes, not baked hex fills', () => {
            const lines = [...HEAD,
                nav('08:00:01', 'Home'),
                '[08:00:10.000] [stderr] ════════ Exception caught by rendering library ═══',
                '[08:00:10.001] [stdout] Boom.',
            ];
            const svg = renderSvg(buildGraph(parseLog(lines)));
            assert.ok(svg.includes('fm-p-walked'), 'walked palette class');
            assert.ok(svg.includes('fm-p-crash'), 'crash palette class');
            assert.ok(svg.includes('fm-arrow-head'), 'marker head classed');
            assert.ok(!/(fill|stroke)="#/.test(svg), 'no hard-coded hex fills or strokes remain');
        });

        test('should hide the visit badge on single visits and show it on revisits', () => {
            const once = renderSvg(buildGraph(parseLog([...HEAD, nav('08:00:01', 'Home'), nav('08:00:05', 'Alpha')])));
            assert.ok(!once.includes('fm-badge'), 'no badge noise on single visits');
            const twice = renderSvg(buildGraph(parseLog([...HEAD,
                nav('08:00:01', 'Home'), nav('08:00:05', 'Alpha'), nav('08:00:09', 'Home')])));
            assert.ok(twice.includes('fm-badge'), 'revisited node gets the badge');
        });

        test('should stagger multiple back edges so their bulges differ', () => {
            // Two distinct returns: Alpha→Home and Beta→Alpha.
            const lines = [...HEAD,
                nav('08:00:01', 'Home'), nav('08:00:05', 'Alpha'), nav('08:00:09', 'Home'),
                nav('08:00:12', 'Alpha'), nav('08:00:15', 'Beta'), nav('08:00:20', 'Alpha'),
            ];
            const svg = renderSvg(buildGraph(parseLog(lines)));
            const bulges = [...svg.matchAll(/class="fm-e-back" d="M[\d.]+,[\d.]+ C([\d.]+),/g)].map(m => m[1]);
            assert.strictEqual(bulges.length, 2, 'two back edges drawn');
            assert.notStrictEqual(bulges[0], bulges[1], 'bulge x-offsets differ');
        });
    });
});
