import * as assert from 'assert';
import { parseLog } from '../../../modules/flow-map/flow-map-log-parser';
import { buildGraph, type ScanIndex } from '../../../modules/flow-map/flow-map-builder';
import { renderMermaid } from '../../../modules/flow-map/flow-map-mermaid';
import { buildReport } from '../../../modules/flow-map/flow-map-report';
import { deriveScreenIdentity } from '../../../modules/flow-map/flow-map-presets';
import { extractDartFileAnchor, parseErrorCausingWidget } from '../../../modules/flow-map/error-causing-widget-parser';
import { renderSvg } from '../../../modules/flow-map/flow-map-svg';
import { buildFlowDiagramBody, buildFlowMapBody } from '../../../modules/flow-map/flow-map-html';
import { activityChartHtml } from '../../../modules/flow-map/flow-map-activity-chart';
import type { FlowGraph } from '../../../modules/flow-map/flow-map-model';

/** Representative session: doubled-backslash root, restart, actions, leaf view, slow query, crash. */
const FIXTURE: readonly string[] = [
    '=== SAROPA LOG CAPTURE — SESSION START ===',
    'Project:        demo',
    '  projectRootPath: "D:\\\\src\\\\demo"',
    '  deviceName: "pixel"',
    'Git Branch:     feat/x',
    'Git Commit:     abc123 (dirty)',
    'Extension version: 9.9.9',
    '[08:00:01.000] [console] [log] Home Screen Reached: stream initialized',
    '[08:00:05.000] [console] [log] Screen Navigation: Contact View [sar-1]',
    '[08:00:06.000] [console] [log] Activity flag made Favorite: Jo [sar-1]',
    '[08:00:07.000] [console] [log] Activity flag removed Favorite: Jo [sar-1]',
    '[08:00:08.000] [console] [log] Home Screen Reached: stream initialized',
    '[08:00:10.000] [console] [log] Screen Navigation: Contact View [sar-1]',
    '[08:00:20.000] [console] [log] Viewed Connection Suggestion: Jo [sar-1]',
    '[08:00:30.000] [console] [log] [database] Drift SLOW 2844ms INSERT: INSERT INTO x  » DriftDebugInterceptor._lightLog (./lib/db/drift_debug_interceptor.dart:195:5)',
    '[08:00:31.000] [stderr] WARNING: Your app uses the following plugins that apply Kotlin Gradle Plugin (KGP): foo',
    '[08:01:00.000] [stderr] ════════ Exception caught by rendering library ═══',
    '[08:01:00.001] [stdout] The following assertion was thrown during performResize():',
    '[08:01:00.002] [stdout] Vertical viewport was given unbounded height.',
    '[08:01:00.003] [stdout] The relevant error-causing widget was:',
    '[08:01:00.004] [stdout]     ListView ListView:file:///D:/src/demo/lib/views/x_dialog.dart:42:14',
];

function nodeByKey(graph: FlowGraph, key: string) {
    return graph.nodes.find(n => n.key === key);
}

suite('FlowMap', () => {

    suite('parseLog', () => {
        const parsed = parseLog(FIXTURE);

        test('reads header and normalizes the doubled-backslash project root', () => {
            assert.strictEqual(parsed.header.project, 'demo');
            assert.strictEqual(parsed.header.projectRoot, 'D:\\src\\demo');
            assert.strictEqual(parsed.header.branch, 'feat/x');
        });

        test('counts slow queries and recovers the crash widget + relative anchor', () => {
            assert.strictEqual(parsed.slowQueryCount, 1);
            assert.ok(parsed.crash, 'crash detected');
            assert.strictEqual(parsed.crash?.message, 'Vertical viewport was given unbounded height.');
            assert.strictEqual(parsed.crash?.widget, 'ListView');
            assert.strictEqual(parsed.crash?.source?.file, 'lib/views/x_dialog.dart');
            assert.strictEqual(parsed.crash?.source?.line, 42);
        });

        test('strips ANSI color codes from breadcrumb labels', () => {
            // Flutter colorizes output; without stripping, the ESC sequence leaks as `□[32m…`.
            const ansiLine = '[08:00:01.000] [console] [log] [32mHome Screen Reached[0m: ok';
            const ev = parseLog([ansiLine]).events.find(e => e.kind === 'reached');
            assert.strictEqual(ev?.label, 'Home');
            assert.ok(![...(ev?.label ?? '')].some(c => c.charCodeAt(0) === 27), 'no ESC byte in label');
        });

        test('promotes the worst slow query and the crash into issue rows', () => {
            const slow = parsed.issues.find(i => i.category === 'Slow query');
            assert.ok(slow?.detail.includes('2844ms'));
            assert.strictEqual(slow?.source?.file, 'lib/db/drift_debug_interceptor.dart');
            assert.ok(parsed.issues.some(i => i.category === 'Crash' && i.severity === 'error'));
        });

        test('keeps event times monotonic across a midnight rollover (no negative span)', () => {
            // Clock-only stamps carry no date; before the rollover fix the after-midnight line had a
            // smaller ms-of-day than the before-midnight line, yielding a negative dwell / broken span.
            const overnight = [
                '[23:59:58.000] [console] [log] Home Screen Reached: stream initialized',
                '[00:00:03.000] [console] [log] Screen Navigation: Contact View [sar-1]',
            ];
            const evs = parseLog(overnight).events;
            assert.strictEqual(evs.length, 2, 'both breadcrumb lines produce events');
            assert.ok(evs[1].tsMs > evs[0].tsMs, 'after-midnight event sorts after the earlier one');
            // 23:59:58 → 00:00:03 is 5 seconds, not ~24h backwards.
            assert.strictEqual(evs[1].tsMs - evs[0].tsMs, 5000);
        });
    });

    suite('deriveScreenIdentity', () => {
        test('drops one role suffix, keeps the rest (R6 join key)', () => {
            assert.deepStrictEqual(deriveScreenIdentity('ContactViewScreen'), { key: 'contact view', label: 'Contact View' });
            assert.deepStrictEqual(deriveScreenIdentity('HomeTab'), { key: 'home', label: 'Home' });
        });
    });

    suite('error-causing-widget anchor', () => {
        test('relativizes a file:// dart anchor under the project root', () => {
            const a = extractDartFileAnchor('x:file:///D:/src/demo/lib/a.dart:9:1', 'D:\\src\\demo');
            assert.deepStrictEqual(a, { file: 'lib/a.dart', line: 9 });
        });
        test('returns undefined when the marker is absent', () => {
            assert.strictEqual(parseErrorCausingWidget(['no marker here'], undefined), undefined);
        });
    });

    suite('buildGraph', () => {
        const graph = buildGraph(parseLog(FIXTURE));

        test('R2: re-entry increments visits without a self-loop', () => {
            assert.strictEqual(nodeByKey(graph, 'home')?.visits, 2);
            assert.strictEqual(nodeByKey(graph, 'contact view')?.visits, 2);
            assert.ok(!graph.edges.some(e => e.from === e.to), 'no self-loops');
        });

        test('attributes actions to the active screen', () => {
            assert.strictEqual(nodeByKey(graph, 'contact view')?.actionCounts.Favorite, 2);
        });

        test('inline view is a leaf; the crash edge anchors to the real screen', () => {
            assert.ok(graph.edges.some(e => e.from === 'contact view' && e.to === 'connection suggestion'));
            const crashEdge = graph.edges.find(e => e.to.startsWith('crash:'));
            assert.strictEqual(crashEdge?.from, 'contact view');
            assert.strictEqual(crashEdge?.inferred, true);
        });

        test('the crash badge is only on the dialog node, not the screen active at crash time', () => {
            const screen = nodeByKey(graph, 'contact view');
            assert.ok(!screen?.issues.some(i => i.severity === 'error'), 'screen not flagged');
            const crashNode = graph.nodes.find(n => n.key.startsWith('crash:'));
            assert.ok(crashNode?.issues.some(i => i.severity === 'error'), 'dialog flagged');
        });
    });

    suite('back navigation (return to caller)', () => {
        // Launch → Home → A → B, then back to Home: closing A and B is a return to the ancestor Home.
        const RETURN: readonly string[] = [
            '=== SAROPA LOG CAPTURE — SESSION START ===',
            'Project:        demo',
            '[08:00:01.000] [console] [log] [flowmap] enter screen "Home" lib/views/home.dart:1',
            '[08:00:02.000] [console] [log] [flowmap] enter screen "Alpha" lib/views/alpha.dart:1',
            '[08:00:03.000] [console] [log] [flowmap] enter screen "Beta" lib/views/beta.dart:1',
            '[08:00:09.000] [console] [log] [flowmap] enter screen "Home" lib/views/home.dart:1',
        ];

        test('a deep return to an open ancestor emits a back edge (not just an immediate pop)', () => {
            const graph = buildGraph(parseLog(RETURN));
            const back = graph.edges.find(e => e.back);
            assert.ok(back, 'a back edge exists');
            assert.strictEqual(back?.from, 'beta');
            assert.strictEqual(back?.to, 'home');
            // The forward chain is untouched and stays acyclic for layering.
            assert.ok(graph.edges.some(e => !e.back && e.from === 'home' && e.to === 'alpha'));
            assert.ok(graph.edges.some(e => !e.back && e.from === 'alpha' && e.to === 'beta'));
        });

        test('an immediate re-entry to the previous screen is also recorded as a back edge', () => {
            // The base fixture goes Home → Contact View → Home → Contact View.
            const graph = buildGraph(parseLog(FIXTURE));
            assert.ok(graph.edges.some(e => e.back && e.from === 'contact view' && e.to === 'home'));
            assert.ok(!graph.edges.some(e => e.from === e.to), 'still no self-loops');
        });

        test('the svg draws the back arrow with its own marker and node detail attributes', () => {
            const svg = renderSvg(buildGraph(parseLog(FIXTURE)));
            assert.ok(svg.includes('id="fm-back"'), 'back marker defined');
            assert.ok(svg.includes('url(#fm-back)'), 'a back edge uses the back marker');
            assert.ok(svg.includes('data-detail='), 'nodes carry detail for the double-click popup');
        });

        test('mermaid marks the return edge with a return glyph', () => {
            const m = renderMermaid(buildGraph(parseLog(FIXTURE)));
            assert.ok(m.includes('↩'), 'return glyph present on the back edge');
        });
    });

    suite('static-scan join (R5/R6)', () => {
        test('joins a node to the scan index for label + source', () => {
            const scan: ScanIndex = new Map([
                ['contact view', { label: 'Contact View', source: { file: 'lib/views/contact_view_screen.dart', line: 10 } }],
            ]);
            const graph = buildGraph(parseLog(FIXTURE), scan);
            const node = nodeByKey(graph, 'contact view');
            assert.strictEqual(node?.resolved, true);
            assert.strictEqual(node?.source?.file, 'lib/views/contact_view_screen.dart');
        });
    });

    suite('render', () => {
        const graph = buildGraph(parseLog(FIXTURE));

        test('mermaid styles the crash node and labels the inferred edge', () => {
            const m = renderMermaid(graph);
            assert.ok(m.includes('flowchart TD'));
            assert.ok(m.includes(':::crash'));
            assert.ok(m.includes('|"opens"|'));
        });

        test('report has all four sections and the crash anchor', () => {
            const md = buildReport(parseLog(FIXTURE), graph);
            for (const heading of ['## Flow', '## Screen Visit Log', '## Issue Report', '## Executive Summary']) {
                assert.ok(md.includes(heading), `missing ${heading}`);
            }
            assert.ok(md.includes('x_dialog.dart:42'));
        });

        test('svg draws one rect per node plus an arrow marker', () => {
            const svg = renderSvg(graph);
            assert.ok(svg.startsWith('<svg'));
            assert.strictEqual((svg.match(/<rect /g) ?? []).length, graph.nodes.length);
            assert.ok(svg.includes('fm-arrow'), 'arrow marker defined');
            assert.ok(svg.includes('#3a1a1a'), 'crash node colored');
        });

        test('webview body has the diagram and clickable source cells', () => {
            const body = buildFlowMapBody(parseLog(FIXTURE), graph);
            assert.ok(body.includes('class="diagram"'));
            assert.ok(body.includes('<svg'));
            assert.ok(/<span class="src"[^>]*data-file="lib\/views\/x_dialog.dart"[^>]*data-line="42"/.test(body));
            // Two tables: the (bare) Screen Visit Log table and the sortable Issue Report table.
            assert.strictEqual((body.match(/<table[ >]/g) ?? []).length, 2);
        });

        test('S2: webview body has the zoom/pan toolbar with a crash-jump when a fault exists', () => {
            const body = buildFlowMapBody(parseLog(FIXTURE), graph);
            assert.ok(body.includes('class="fm-zoom-toolbar"'), 'overlay zoom toolbar present');
            assert.ok(body.includes('data-zoom="in"'), 'zoom-in control');
            assert.ok(body.includes('data-zoom="out"'), 'zoom-out control');
            assert.ok(body.includes('data-zoom="reset"'), 'reset-view control');
            // The fixture crashes (x_dialog), so the jump-to-crash control must render.
            assert.ok(body.includes('data-zoom="crash"'), 'jump-to-crash control present when a fault exists');
            // The toolbar sits before the SVG so it overlays the diagram's top-right.
            assert.ok(body.indexOf('fm-zoom-toolbar') < body.indexOf('<svg'), 'toolbar precedes the svg');
        });

        test('S3: the diagram sits in a scroll container and offers a pop-out control', () => {
            const body = buildFlowMapBody(parseLog(FIXTURE), graph);
            assert.ok(body.includes('class="diagram-scroll"'), 'svg lives in a scroll box (zoom scrolls, not crops)');
            assert.ok(body.includes('data-zoom="popout"'), 'pop-out control present in the report');
        });

        test('S3: the pop-out body is diagram-only and never offers a nested pop-out', () => {
            const body = buildFlowDiagramBody(graph);
            assert.ok(body.includes('class="diagram-only"'), 'diagram-only wrapper present');
            assert.ok(body.includes('class="diagram-scroll"'), 'still a scroll box');
            assert.ok(body.includes('<svg'), 'the diagram is rendered');
            assert.ok(!body.includes('data-zoom="popout"'), 'no nested pop-out inside the pop-out');
            assert.ok(!body.includes('<table'), 'no tables in the diagram-only view');
        });

        test('S2: no jump-to-crash control when the session has no fault', () => {
            // A clean two-screen session (no error markers) must not render a dead crash button.
            const clean = ['=== SAROPA LOG CAPTURE — SESSION START ===', 'Project: demo',
                '[flowmap] enter screen "Home" lib/views/home.dart:1',
                '[flowmap] enter screen "Settings" lib/views/settings.dart:1'];
            const cleanGraph = buildGraph(parseLog(clean));
            const body = buildFlowMapBody(parseLog(clean), cleanGraph);
            assert.ok(body.includes('class="fm-zoom-toolbar"'), 'zoom toolbar still present');
            assert.ok(!body.includes('data-zoom="crash"'), 'no crash control without a fault');
        });

        test('webview body has an activity chart above the dwell section, with clickable points', () => {
            const body = buildFlowMapBody(parseLog(FIXTURE), graph);
            // The Activity section must precede Screen dwell (the requested placement).
            assert.ok(body.indexOf('id="sec-activity"') < body.indexOf('id="sec-dwell"'), 'activity before dwell');
            assert.ok(body.includes('<svg class="activity-chart"'), 'chart svg present');
            assert.ok(body.includes('<polyline class="ac-line"'), 'activity line present');
            // At least one point links to a log line (the click-to-reveal target).
            assert.ok(/<circle class="ac-pt ac-link"[^>]*data-line="\d+"/.test(body), 'clickable point');
            // Both axes carry numbering — count (ac-num) and time (ac-clock).
            assert.ok(body.includes('class="ac-num"'), 'count axis labels');
            assert.ok(body.includes('class="ac-clock"'), 'time axis labels');
        });
    });

    suite('activityChart', () => {
        test('renders a note when fewer than two timed samples exist', () => {
            const empty = parseLog(['=== SAROPA LOG CAPTURE — SESSION START ===', 'Project: demo']);
            const html = activityChartHtml(empty, () => '00:00:00');
            assert.ok(html.includes('ac-empty'), 'shows the not-enough-data note');
            assert.ok(!html.includes('<svg'), 'no chart drawn');
        });
    });
});
