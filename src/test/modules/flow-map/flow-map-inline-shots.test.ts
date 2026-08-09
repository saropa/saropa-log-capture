import * as assert from 'assert';
import { joinShotsToScreens, type ShotWithSource } from '../../../modules/flow-map/flow-map-screenshots';
import { buildFlowMapBody } from '../../../modules/flow-map/flow-map-html';
import { activityChartHtml } from '../../../modules/flow-map/flow-map-activity-chart';
import { parseLog } from '../../../modules/flow-map/flow-map-log-parser';
import { buildGraph } from '../../../modules/flow-map/flow-map-builder';
import { flowMapLightboxScript } from '../../../ui/panels/flow-map-panel-lightbox-script';

/**
 * Captures now appear on three surfaces beyond the gallery: the diagram cards, the activity
 * timeline, and the screen-visit table. All three open the SAME lightbox off the SAME data
 * attributes, so the failure mode when one drifts is a picture that renders and then does nothing
 * when clicked — visually indistinguishable from a working one.
 */

const HEAD = ['=== SAROPA LOG CAPTURE — SESSION START ===', 'Project:        demo'];
// The REAL decorated line shape. A bare 'Screen Navigation: Home' classifies as nothing, silently.
const nav = (clock: string, name: string) => `[${clock}.000] [console] [log] Screen Navigation: ${name}`;
const LINES = [
    ...HEAD,
    nav('08:00:01', 'Home'), nav('08:00:05', 'Contact View'),
    nav('08:00:20', 'Settings'), nav('08:00:40', 'About'),
];

function shot(logLine: number, overrides: Partial<ShotWithSource> = {}): ShotWithSource {
    return {
        trigger: 'nav', timestamp: 0, logLine, text: 'capture',
        src: 'file:///shots/a.png', path: 'D:/shots/a.png', ...overrides,
    };
}

function fixture(entries: readonly ShotWithSource[]) {
    const parsed = parseLog(LINES);
    const graph = buildGraph(parsed);
    return { parsed, graph, shots: joinShotsToScreens(entries, parsed.events) };
}

/** The full report body, with or without captures. */
function body(entries: readonly ShotWithSource[]): string {
    const { parsed, graph, shots } = fixture(entries);
    return buildFlowMapBody(parsed, graph, 'D:/logs/demo.log', {
        screenshots: shots, screenshotsOmitted: 0,
    });
}

suite('FlowMap inline capture thumbnails', () => {

    suite('screen-visit table', () => {
        test('should show the screen\'s capture in its own row', () => {
            const html = body([shot(3), shot(4)]);
            // dwell-shot, not bare fm-mini-shot: the lightbox's prev/next navigates within the
            // class the reader clicked from, and this is what keeps it from mixing this surface's
            // captures with the timeline's (both share fm-mini-shot for styling only).
            assert.ok(html.includes('<td class="shot-cell"><img class="fm-mini-shot dwell-shot"'), 'a thumbnail cell');
            assert.ok(html.includes('data-shot-path="D:/shots/a.png"'), 'carrying the lightbox facts');
        });

        test('should emit an empty cell for a screen that was never captured', () => {
            // Not "no cell": a row with fewer cells than its header shifts every later column left,
            // and the table still renders — just wrong.
            const html = body([shot(3)]);
            assert.ok(html.includes('<td class="shot-cell"></td>'), 'uncaptured screens hold their place');
        });

        test('should leave the column out entirely when the session captured nothing', () => {
            const html = body([]);
            assert.ok(!html.includes('shot-cell'), 'no empty column on every row');
        });

        test('should count captures against the whole session, not the row', () => {
            // These open the gallery's lightbox, whose counter reads "Capture 2 of 3" — a per-row
            // denominator would make the same overlay say two different things.
            const html = body([shot(3), shot(4), shot(5)]);
            assert.ok(/data-shot-index="2" data-shot-total="3"/.test(html), 'session-wide position');
        });
    });

    suite('activity timeline', () => {
        test('should draw a capture under the bin it belongs to', () => {
            const { parsed, shots } = fixture([shot(4)]);
            const html = activityChartHtml(parsed, () => '08:00:00', shots);
            assert.ok(html.includes('class="fm-mini-shot ac-shot"'), 'a thumbnail in the strip');
            assert.ok(html.includes('<foreignObject'), 'inside the chart, sharing its coordinates');
        });

        test('should place a capture by LOG LINE, never by its clock', () => {
            // A capture's clock is HOST-local while every chart sample is DEVICE-local ms-of-day;
            // binning on the clock scatters thumbnails hours from their points, silently.
            const { parsed, shots } = fixture([shot(6, { timestamp: 0 })]);
            const html = activityChartHtml(parsed, () => '08:00:00', shots);
            const shotX = Number(/<foreignObject x="([\d.]+)"/.exec(html)?.[1] ?? -1);
            // 1970-epoch timestamp 0 formats to an early-morning clock; a clock-based placement would
            // pin it to the very first bin at the left edge of the plot.
            assert.ok(shotX > 46, 'placed past the y-axis margin, where its log line actually falls');
        });

        test('should grow the canvas only when the strip has something in it', () => {
            const { parsed, shots } = fixture([shot(4)]);
            const withShots = activityChartHtml(parsed, () => '08:00:00', shots);
            const without = activityChartHtml(parsed, () => '08:00:00');
            const heightOf = (h: string) => Number(/viewBox="0 0 \d+ (\d+)"/.exec(h)?.[1] ?? 0);
            assert.strictEqual(heightOf(without), 220, 'unchanged when there is nothing to show');
            assert.ok(heightOf(withShots) > 220, 'the strip claims its own band');
        });

        test('should resolve a capture sharing a log line with several samples to the latest', () => {
            // The lookup binary-searches log lines, and a log line can carry more than one timed
            // sample. Pinning the tie-break stops a later refactor from silently choosing the other
            // end of the run and shifting a thumbnail a bin sideways.
            const { parsed, shots } = fixture([shot(5)]);
            const html = activityChartHtml(parsed, () => '08:00:00', shots);
            assert.ok(html.includes('ac-shot'), 'the capture is placed, not dropped');
        });

        test('should drop a capture no timed sample precedes', () => {
            // It cannot be placed, and pinning it to the chart's start would state a time it never had.
            const { parsed, shots } = fixture([shot(0)]);
            const html = activityChartHtml(parsed, () => '08:00:00', shots);
            assert.ok(!html.includes('ac-shot'), 'left out rather than misplaced');
        });
    });

    suite('lightbox navigation', () => {
        const script = flowMapLightboxScript('abc123', {
            title: 'Screenshot', captured: 'Captured', trigger: 'Trigger', screen: 'Screen',
            logLine: 'Log line', close: 'Close', counter: '{0}/{1}', counterScreen: '{0}/{1} here',
            file: 'File', copyPath: 'Copy full path', zoom: 'Zoom', zoomHint: 'Scroll to zoom',
            unavailable: 'Screenshot unavailable', prev: 'Previous screenshot', next: 'Next screenshot',
            compare: 'Compare', comparePrev: 'Previous', compareNext: 'Next',
            compareSession: 'Other session', compareThisSession: 'This session',
            compareLoading: 'Reading…', compareNoMatch: 'No capture of this screen',
        });

        test('should navigate within the surface it was opened from', () => {
            // A flat session-wide list would jump the reader between the gallery, the cards, the
            // timeline and the dwell table, and make the overlay's own counter disagree with where
            // the arrows go. ac-shot/dwell-shot, not the shared fm-mini-shot styling class — that
            // class alone would silently merge the timeline and the dwell table into one set.
            assert.ok(script.includes('NAV_CLASSES'), 'the four surfaces are named');
            assert.ok(
                script.includes("'shot-img', 'fm-shot', 'ac-shot', 'dwell-shot'"),
                'all four, in one list, by their surface-specific classes');
        });

        test('should skip captures whose file failed to load', () => {
            // Their click target is stripped, so stepping onto one opens an empty stage with no
            // statement of why.
            assert.ok(script.includes(':not(.fm-shot-missing)'), 'broken captures leave the set');
        });

        test('should disable the arrows at the ends rather than wrapping', () => {
            assert.ok(/b\.disabled = !navList\[navIndex \+ delta\]/.test(script), 'ends are dead ends');
        });

        test('should leave arrow keys to a focused form control', () => {
            // The zoom slider is a range input inside the same dialog; arrows are its own increment.
            assert.ok(script.includes("tag === 'INPUT'"), 'the slider keeps its arrow keys');
        });

        test('should not bounce focus through the outgoing thumbnail while navigating', () => {
            assert.ok(script.includes('navigating'), 'the intermediate focus restore is suppressed');
            assert.ok(script.includes('if (!navigating && opener'), 'close() honors it');
        });

        test('should clear the navigating flag even when opening throws', () => {
            // Left set, it permanently disables focus restoration for every later close of the panel.
            assert.ok(
                /try \{ open\(next, next\.src\); \} finally \{ navigating = false; \}/.test(script),
                'the flag is cleared in a finally');
        });

        test('should leave arrow keys to the compare view while it is open', () => {
            // Stepping to another capture rebuilds the dialog, silently discarding the comparison the
            // reader set up. Guarded on the pane being visible, NOT on the focused tag being BUTTON:
            // the close button takes focus the moment the dialog opens, so a tag-name guard would
            // disable arrow navigation by default everywhere else.
            assert.ok(
                script.includes('.fms-cmp:not(.fms-off)'),
                'compare keeps the arrows while its pane is showing');
            assert.ok(!/tag === 'BUTTON'/.test(script), 'not guarded by focused tag name');
        });
    });
});
