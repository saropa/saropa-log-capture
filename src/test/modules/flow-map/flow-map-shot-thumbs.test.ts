import * as assert from 'assert';
import { groupShotsByScreen, THUMB_BLOCK_H } from '../../../modules/flow-map/flow-map-svg-shots';
import { joinShotsToScreens, type ShotWithDataUri } from '../../../modules/flow-map/flow-map-screenshots';
import { renderSvg } from '../../../modules/flow-map/flow-map-svg';
import { buildFlowDiagramBody, buildFlowMapBody } from '../../../modules/flow-map/flow-map-html';
import { parseLog } from '../../../modules/flow-map/flow-map-log-parser';
import { buildGraph } from '../../../modules/flow-map/flow-map-builder';

const HEAD = ['=== SAROPA LOG CAPTURE — SESSION START ===', 'Project:        demo'];
const nav = (clock: string, name: string) => `[${clock}.000] [console] [log] Screen Navigation: ${name}`;
const LINES = [...HEAD, nav('08:00:01', 'Home'), nav('08:00:05', 'Contact View')];

/** A minimal sidecar+dataUri entry, defaults chosen so tests only set what they're asserting on. */
function shot(logLine: number, overrides: Partial<ShotWithDataUri> = {}): ShotWithDataUri {
    return { trigger: 'error', timestamp: 0, logLine, text: 'boom', dataUri: 'data:image/png;base64,AA==', ...overrides };
}

/** Parse the fixture and join `entries` to the screens they were captured on. */
function fixture(entries: readonly ShotWithDataUri[]) {
    const parsed = parseLog(LINES);
    const graph = buildGraph(parsed);
    return { parsed, graph, shots: joinShotsToScreens(entries, parsed.events) };
}

/** The `height` attribute of the rendered `<svg>` root. */
function svgHeight(svg: string): number {
    return Number(/height="(\d+(?:\.\d+)?)"/.exec(svg)?.[1] ?? 0);
}

suite('FlowMap diagram screenshot thumbnails', () => {

    suite('groupShotsByScreen', () => {
        test('should group captures under the normalized key of their screen', () => {
            const { shots } = fixture([shot(3), shot(3), shot(4)]);
            const grouped = groupShotsByScreen(shots);
            assert.strictEqual(grouped.get('home')?.length, 2, 'both Home captures land on the Home key');
            assert.strictEqual(grouped.get('contact view')?.length, 1, 'the later capture lands on Contact View');
        });

        test('should key by normalized label so multi-word screens match their node', () => {
            const { shots } = fixture([shot(4)]);
            const grouped = groupShotsByScreen(shots);
            assert.ok(grouped.has('contact view'), 'lowercased, whitespace-collapsed key');
        });

        test('should drop captures with no resolved screen — they belong to no node', () => {
            const { shots } = fixture([shot(0)]);
            assert.strictEqual(groupShotsByScreen(shots).size, 0);
        });

        test('should preserve capture order within a screen (first one becomes the thumbnail)', () => {
            const { shots } = fixture([shot(3, { trigger: 'nav' }), shot(3, { trigger: 'error' })]);
            assert.strictEqual(groupShotsByScreen(shots).get('home')?.[0].trigger, 'nav');
        });
    });

    suite('renderSvg', () => {
        test('should draw an <image> thumbnail on the node whose screen was captured', () => {
            const { graph, shots } = fixture([shot(3)]);
            const svg = renderSvg(graph, shots);
            assert.ok(svg.includes('class="fm-shot"'), 'thumbnail image present');
            assert.ok(svg.includes('href="data:image/png;base64,AA=="'), 'embeds the capture data URI');
        });

        test('should draw no thumbnail when the session has no captures', () => {
            const { graph } = fixture([]);
            assert.ok(!renderSvg(graph).includes('fm-shot'), 'no thumbnail markup without captures');
        });

        test('should show the count pill only when a screen has more than one capture', () => {
            const { graph, shots } = fixture([shot(3)]);
            assert.ok(!renderSvg(graph, shots).includes('fm-shot-pill'), 'single capture needs no pill');
            const many = fixture([shot(3), shot(3), shot(3)]);
            const svg = renderSvg(many.graph, many.shots);
            assert.ok(svg.includes('fm-shot-pill'), 'pill present for a repeat-captured screen');
            assert.ok(svg.includes('>3</text>'), 'pill reports the capture count');
        });

        test('should grow the canvas by exactly one thumbnail block when a node gains a capture', () => {
            const { graph, shots } = fixture([shot(3)]);
            const grew = svgHeight(renderSvg(graph, shots)) - svgHeight(renderSvg(graph));
            assert.strictEqual(grew, THUMB_BLOCK_H, 'height grows by the thumbnail block, nothing else');
        });

        test('should embed only the FIRST capture per screen, not every one', () => {
            const { graph, shots } = fixture([shot(3), shot(3), shot(3)]);
            const svg = renderSvg(graph, shots);
            assert.strictEqual(svg.split('class="fm-shot"').length - 1, 1, 'one thumbnail per screen');
        });

        test('should render portrait cards (168px wide)', () => {
            const { graph } = fixture([]);
            assert.ok(renderSvg(graph).includes('width="168"'), 'node boxes use the portrait card width');
        });

        test('should carry the capture facts the lightbox reads', () => {
            const { graph, shots } = fixture([shot(3, { trigger: 'nav' })]);
            const svg = renderSvg(graph, shots);
            assert.ok(svg.includes('data-shot-trigger="nav"'), 'trigger');
            assert.ok(svg.includes('data-shot-screen="Home"'), 'screen label');
            assert.ok(svg.includes('data-shot-line="3"'), 'log line');
        });
    });

    suite('panel bodies', () => {
        test('should put thumbnails in the pop-out diagram too, not just the report', () => {
            const { graph, shots } = fixture([shot(3)]);
            assert.ok(buildFlowDiagramBody(graph, shots).includes('fm-shot'), 'pop-out cards carry thumbnails');
            assert.ok(!buildFlowDiagramBody(graph).includes('fm-shot'), 'and none when no captures are passed');
        });

        test('should open the lightbox from a gallery figure instead of jumping the log', () => {
            const { parsed, graph, shots } = fixture([shot(3)]);
            const html = buildFlowMapBody(parsed, graph, undefined, { screenshots: shots, screenshotsOmitted: 0 });
            assert.ok(html.includes('class="shot-img"'), 'figure image is a plain lightbox trigger');
            assert.ok(!html.includes('shot-img loglink'), 'no longer wired to the log-reveal path');
        });
    });
});
