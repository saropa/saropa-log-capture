import * as assert from 'assert';
import { groupShotsByScreen, pickThumbShot, THUMB_BLOCK_H } from '../../../modules/flow-map/flow-map-svg-shots';
import { joinShotsToScreens, type ShotWithSource } from '../../../modules/flow-map/flow-map-screenshots';
import { renderSvg } from '../../../modules/flow-map/flow-map-svg';
import { buildFlowDiagramBody, buildFlowMapBody } from '../../../modules/flow-map/flow-map-html';
import { parseLog } from '../../../modules/flow-map/flow-map-log-parser';
import { buildGraph } from '../../../modules/flow-map/flow-map-builder';
import { flowMapStyles } from '../../../ui/panels/flow-map-panel-styles';

const HEAD = ['=== SAROPA LOG CAPTURE — SESSION START ===', 'Project:        demo'];
const nav = (clock: string, name: string) => `[${clock}.000] [console] [log] Screen Navigation: ${name}`;
const LINES = [...HEAD, nav('08:00:01', 'Home'), nav('08:00:05', 'Contact View')];

/** A minimal sidecar+source entry, defaults chosen so tests only set what they're asserting on. */
function shot(logLine: number, overrides: Partial<ShotWithSource> = {}): ShotWithSource {
    return {
        trigger: 'error', timestamp: 0, logLine, text: 'boom',
        src: 'file:///shots/a.png', path: 'D:\shots\a.png', ...overrides,
    };
}

/** Parse the fixture and join `entries` to the screens they were captured on. */
function fixture(entries: readonly ShotWithSource[]) {
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

        test('should preserve capture order within a screen', () => {
            const { shots } = fixture([shot(3, { trigger: 'nav' }), shot(3, { trigger: 'error' })]);
            assert.strictEqual(groupShotsByScreen(shots).get('home')?.[0].trigger, 'nav');
        });

        test('should key captures with the SAME normalizer the builder keys nodes with', () => {
            // Drift between the two fails silently — thumbnails just stop appearing — so pin it
            // through the real pipeline on a label the normalizer has to actually work on.
            const parsed = parseLog([...HEAD, '[08:00:01.000] [console] [log] Screen Navigation:   Contact   VIEW  ']);
            const graph = buildGraph(parsed);
            const shots = joinShotsToScreens([shot(3)], parsed.events);
            const key = graph.nodes.find(n => n.kind !== 'launch')?.key;
            assert.ok(key, 'the fixture produced a screen node');
            assert.strictEqual(groupShotsByScreen(shots).get(key)?.length, 1, 'capture lands on that node key');
        });

        test('should key a node the same way with or without ANSI in its label', () => {
            // The log parser strips ANSI at ingestion, so a raw fixture line can't reproduce "ANSI
            // slipped through" — this bypasses the parser and hand-builds the event the builder
            // actually keys from, the same way groupShotsByScreen's own caller
            // (screenKeyOf(stripAnsi(shot.screenLabel))) already strips before normalizing. Before
            // the fix, the builder's key kept the raw ANSI bytes and the shot's key didn't — two
            // different strings for the same screen, and the thumbnail silently never appeared.
            const ansiLabel = '[32mContact View[0m';
            const parsed = {
                header: {}, issues: [], crashes: [], slowQueryCount: 0, repeatBatchCount: 0,
                events: [{ tsMs: 1000, clock: '08:00:01', kind: 'nav' as const, label: ansiLabel, logLine: 2 }],
            };
            const graph = buildGraph(parsed);
            const shots = joinShotsToScreens([shot(2)], parsed.events);
            const node = graph.nodes.find(n => n.kind !== 'launch');
            assert.ok(node, 'the fixture produced a screen node');
            assert.strictEqual(node!.key, 'contact view', 'the node key has the ANSI stripped');
            assert.strictEqual(
                groupShotsByScreen(shots).get(node!.key)?.length, 1,
                'the capture lands on that same key — same normalizer, same pre-processing');
        });
    });

    suite('pickThumbShot', () => {
        test('should show a warning capture too — the capturer treats it as a fault', () => {
            const { shots } = fixture([shot(3, { trigger: 'nav' }), shot(3, { trigger: 'warning' })]);
            const picked = pickThumbShot(groupShotsByScreen(shots).get('home') ?? []);
            assert.strictEqual(picked?.shot.trigger, 'warning');
        });

        test('should rank an error above a warning when a screen produced both', () => {
            const { shots } = fixture([shot(3, { trigger: 'warning' }), shot(3, { trigger: 'error' })]);
            assert.strictEqual(pickThumbShot(groupShotsByScreen(shots).get('home') ?? [])?.shot.trigger, 'error');
        });

        test('should show the error capture when a screen has one', () => {
            const { shots } = fixture([shot(3, { trigger: 'nav' }), shot(3, { trigger: 'error' })]);
            const picked = pickThumbShot(groupShotsByScreen(shots).get('home') ?? []);
            assert.strictEqual(picked?.shot.trigger, 'error', 'the fault capture represents the screen');
            assert.strictEqual(picked?.index, 1, 'and reports its real position, not 0');
        });

        test('should fall back to the first capture when none faulted', () => {
            const { shots } = fixture([shot(3, { trigger: 'nav' }), shot(3, { trigger: 'manual' })]);
            const picked = pickThumbShot(groupShotsByScreen(shots).get('home') ?? []);
            assert.strictEqual(picked?.shot.trigger, 'nav');
            assert.strictEqual(picked?.index, 0);
        });

        test('should return undefined for a screen with no captures', () => {
            assert.strictEqual(pickThumbShot([]), undefined);
        });
    });

    suite('renderSvg', () => {
        test('should draw an <image> thumbnail on the node whose screen was captured', () => {
            const { graph, shots } = fixture([shot(3)]);
            const svg = renderSvg(graph, shots);
            assert.ok(svg.includes('class="fm-shot"'), 'thumbnail image present');
            assert.ok(svg.includes('src="file:///shots/a.png"'), 'references the capture by URL');
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

        test('should draw the error capture and flag the pill when a screen faulted', () => {
            const { graph, shots } = fixture([
                shot(3, { trigger: 'nav', src: 'file:///shots/nav.png' }),
                shot(3, { trigger: 'error', src: 'file:///shots/err.png', path: '/shots/err.png' }),
            ]);
            const svg = renderSvg(graph, shots);
            assert.ok(svg.includes('src="file:///shots/err.png"'), 'the fault capture is the thumbnail');
            // ONE thumbnail per screen. The nav capture is reachable through the screen's set island,
            // so the assertion is on the images actually DRAWN, not on the whole document string.
            assert.strictEqual(svg.split('class="fm-shot"').length - 1, 1, 'only the fault capture is drawn');
            assert.ok(!/src="file:\/\/\/shots\/nav\.png"/.test(svg), 'the nav capture is not drawn');
            assert.ok(svg.includes('fm-shot-pill-alert'), 'the pill carries the fault tint');
            assert.ok(svg.includes('data-shot-index="2"'), 'the lightbox counter reports its real position');
        });

        test('should tint the pill at the severity that actually fired', () => {
            const { graph, shots } = fixture([shot(3, { trigger: 'nav' }), shot(3, { trigger: 'warning' })]);
            const svg = renderSvg(graph, shots);
            assert.ok(svg.includes('fm-shot-pill-warn'), 'a warning capture gets the warning tint');
            assert.ok(!svg.includes('fm-shot-pill-alert'), 'not the error tint');
        });

        test('should leave the pill untinted when no capture on the screen faulted', () => {
            const { graph, shots } = fixture([shot(3, { trigger: 'nav' }), shot(3, { trigger: 'manual' })]);
            const svg = renderSvg(graph, shots);
            assert.ok(svg.includes('fm-shot-pill'), 'pill present');
            assert.ok(!/fm-shot-pill-(alert|warn)/.test(svg), 'but not tinted');
        });

        test('should reference only ONE capture per screen, not every one', () => {
            const { graph, shots } = fixture([shot(3), shot(3), shot(3)]);
            const svg = renderSvg(graph, shots);
            assert.strictEqual(svg.split('class="fm-shot"').length - 1, 1, 'one thumbnail per screen');
        });

        test('should render portrait cards (168px wide)', () => {
            const { graph } = fixture([]);
            assert.ok(renderSvg(graph).includes('width="168"'), 'node boxes use the portrait card width');
        });

        test('should POINT a thumbnail at its screen set rather than inlining the set', () => {
            // Inlining every screen's set on every element of that screen grows the markup with the
            // square of the capture count — fine at the 12-capture cap, quietly not fine above it.
            const one = fixture([shot(3)]);
            assert.ok(!renderSvg(one.graph, one.shots).includes('data-shot-screen-key'), 'no pointer for a lone capture');
            const many = fixture([shot(3, { src: 'file:///a.png' }), shot(3, { src: 'file:///b.png' })]);
            const svg = renderSvg(many.graph, many.shots);
            assert.ok(svg.includes('data-shot-screen-key="home"'), 'the thumbnail names its screen');
            assert.ok(svg.includes('data-shot-sib="0"'), 'and its own index within that screen');
            assert.ok(!svg.includes('file:///b.png'), 'the other capture is not copied onto the card');
        });

        test('should class the node box so palette rules cannot repaint the thumbnail frame', () => {
            // ROOT CAUSE of the blank thumbnails. The palette rules were written as descendant
            // selectors (`.fm-p-walked rect`), which also match the thumbnail frame and the count
            // pill — siblings in the same <g> — and a CSS `fill` beats their `fill="none"`
            // presentation attribute. The frame is drawn AFTER the capture, so the node's own color
            // was painted straight over the screenshot on every card.
            const { graph, shots } = fixture([shot(3)]);
            const svg = renderSvg(graph, shots);
            assert.ok(svg.includes('class="fm-box"'), 'the node box is addressable by class');
            assert.ok(/<rect class="fm-shot-frame"/.test(svg), 'the frame is a separate, unclassed-as-box rect');
            const css = flowMapStyles('n');
            assert.ok(css.includes('.fm-p-walked rect.fm-box'), 'palette targets the box only');
            assert.ok(!/\.fm-p-\w+ rect \{/.test(css), 'no bare rect descendant selector survives');
            assert.ok(!/\.fm-node:hover rect,/.test(css), 'nor on the hover rule');
        });

        test('should title the thumbnail with WHY this capture is the one on show', () => {
            // A card shows one of several captures, chosen by trigger — without the clock and
            // trigger on hover the reader cannot tell which one they are looking at.
            const { graph, shots } = fixture([shot(3, { trigger: 'nav' }), shot(3, { trigger: 'error' })]);
            const svg = renderSvg(graph, shots);
            assert.ok(/title="[^"]*·\s*error\s*·\s*Home"/.test(svg), 'names the trigger and screen');
            assert.ok(!svg.includes('· nav ·'), 'and not the capture that is NOT shown');
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

        test('should emit the capture-set island ONCE, in the report and in the pop-out alike', () => {
            // The pop-out renders no gallery but its cards still open the lightbox, so compare would
            // be dead there alone if only the report carried the island.
            const { parsed, graph, shots } = fixture([
                shot(3, { src: 'file:///a.png' }), shot(3, { src: 'file:///b.png' }),
            ]);
            const report = buildFlowMapBody(parsed, graph, undefined, { screenshots: shots, screenshotsOmitted: 0 });
            assert.strictEqual(report.split('id="fm-shot-sets"').length - 1, 1, 'exactly one island in the report');
            assert.ok(report.includes('file:///b.png'), 'the set names every capture of the screen');
            assert.ok(buildFlowDiagramBody(graph, shots).includes('id="fm-shot-sets"'), 'pop-out carries it too');
        });

        test('should emit no island when no screen has a second capture', () => {
            const { parsed, graph, shots } = fixture([shot(3)]);
            const html = buildFlowMapBody(parsed, graph, undefined, { screenshots: shots, screenshotsOmitted: 0 });
            assert.ok(!html.includes('fm-shot-sets'), 'nothing to compare, so no island');
        });

        test('should escape the image URL identically on both surfaces', () => {
            // The diagram thumbnail and the gallery figure render the SAME value; divergent escaping
            // is how one surface ends up with a broken attribute the other does not.
            const { parsed, graph, shots } = fixture([shot(3, { src: 'file:///shots/a"b.png' })]);
            const html = buildFlowMapBody(parsed, graph, undefined, { screenshots: shots, screenshotsOmitted: 0 });
            assert.ok(!/src="file:\/\/\/shots\/a"b\.png"/.test(html), 'gallery escapes the quote');
            assert.ok(html.includes('shots/a&quot;b.png'), 'both surfaces emit the escaped form');
        });

        test('should open the lightbox from a gallery figure instead of jumping the log', () => {
            const { parsed, graph, shots } = fixture([shot(3)]);
            const html = buildFlowMapBody(parsed, graph, undefined, { screenshots: shots, screenshotsOmitted: 0 });
            assert.ok(html.includes('class="shot-img"'), 'figure image is a plain lightbox trigger');
            assert.ok(!html.includes('shot-img loglink'), 'no longer wired to the log-reveal path');
        });
    });

    // Lightbox script source-content checks moved to flow-map-lightbox-script-contract.test.ts
    // (house 300-line limit).
});
