import * as assert from 'assert';
import { groupShotsByScreen, pickThumbShot, THUMB_BLOCK_H } from '../../../modules/flow-map/flow-map-svg-shots';
import { joinShotsToScreens, type ShotWithSource } from '../../../modules/flow-map/flow-map-screenshots';
import { renderSvg } from '../../../modules/flow-map/flow-map-svg';
import { buildFlowDiagramBody, buildFlowMapBody } from '../../../modules/flow-map/flow-map-html';
import { parseLog } from '../../../modules/flow-map/flow-map-log-parser';
import { buildGraph } from '../../../modules/flow-map/flow-map-builder';
import { flowMapLightboxScript } from '../../../ui/panels/flow-map-panel-lightbox-script';

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
            // ONE thumbnail per screen — the nav capture now appears in data-shot-siblings (compare
            // needs the whole set), so the assertion is on the drawn images, not on the string.
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

        test('should carry the screen\'s capture set for compare, and only when there is a set', () => {
            const one = fixture([shot(3)]);
            assert.ok(!renderSvg(one.graph, one.shots).includes('data-shot-siblings'), 'no set for a lone capture');
            const many = fixture([shot(3, { src: 'file:///a.png' }), shot(3, { src: 'file:///b.png' })]);
            const svg = renderSvg(many.graph, many.shots);
            assert.ok(svg.includes('data-shot-siblings'), 'the screen set rides on the thumbnail');
            assert.ok(svg.includes('file:///b.png'), 'including the capture NOT shown on the card');
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

    // The overlay's runtime behavior lives in the webview; what IS checkable from the Extension Host
    // is that the generated script carries the wiring an aria-modal dialog is required to have.
    suite('lightbox script contract', () => {
        const script = flowMapLightboxScript('abc123', {
            title: 'Screenshot', captured: 'Captured', trigger: 'Trigger', screen: 'Screen',
            logLine: 'Log line', close: 'Close', counter: '{0}/{1}', counterScreen: '{0}/{1} here',
            file: 'File', copyPath: 'Copy full path', zoom: 'Zoom', zoomHint: 'Scroll to zoom',
            unavailable: 'Screenshot unavailable',
            compare: 'Compare', comparePrev: 'Previous', compareNext: 'Next',
        });

        test('should keep Tab inside the dialog and restore focus to the opener on close', () => {
            assert.ok(script.includes('trapTab'), 'Tab is trapped inside the card');
            assert.ok(/opener\s*=\s*el/.test(script), 'the clicked thumbnail is remembered');
            assert.ok(script.includes('opener.focus()'), 'focus returns to it on close');
        });

        test('should never build overlay content with innerHTML', () => {
            // Screen labels and triggers come from log text — markup interpolation would let a log
            // line inject nodes into the panel.
            // Matches an ASSIGNMENT, not the word — the script's own comment names innerHTML to
            // explain why it is avoided, and that mention must not fail the check.
            assert.ok(!/innerHTML\s*=/.test(script), 'facts are rendered with textContent only');
        });

        test('should carry the nonce so the strict CSP admits the script', () => {
            assert.ok(script.startsWith('<script nonce="abc123">'), 'nonce-guarded');
        });

        test('should bind BOTH surfaces with one img selector', () => {
            // The diagram thumbnail is an <img> inside a <foreignObject> now, not an SVG <image> —
            // a stale 'image.fm-shot' selector would silently stop opening the lightbox from a card.
            assert.ok(script.includes("'img.shot-img, img.fm-shot'"), 'gallery and card share the binder');
            assert.ok(!script.includes('image.fm-shot'), 'no SVG-image selector left behind');
        });

        test('should copy the full path through its own message, not the summary copier', () => {
            assert.ok(script.includes("'copyShotPath'"), 'dedicated message so the toast names the right thing');
            assert.ok(script.includes('data-shot-path'), 'reads the path off the clicked capture');
        });

        test('should state a load failure instead of leaving a broken-image glyph', () => {
            // A capture present when the report was built can be gone by the time the browser fetches
            // it — the report must say so rather than show a silent browser placeholder.
            assert.ok(/addEventListener\('error'/.test(script), 'both surfaces handle a failed fetch');
            assert.ok(script.includes('fm-shot-missing'), 'and mark the frame as failed');
            assert.ok(script.includes("removeAttribute('role')"), 'a dead thumbnail stops advertising a click');
        });

        test('should offer compare only when the screen has more than one capture', () => {
            assert.ok(script.includes('data-shot-siblings'), 'compare reads the screen set off the element');
            assert.ok(/set\.length > 1/.test(script), 'a lone capture has nothing to compare against');
        });

        test('should walk compare siblings with a BOUNDED scan, never skip-until-different', () => {
            // Nothing dedups captures by file, so every entry in a screen's set can carry the same
            // src; an unbounded "skip until different" loop would spin forever and hang the panel.
            assert.ok(!/do\s*\{/.test(script), 'no unbounded do/while in the sibling walk');
            assert.ok(/for \(var i = 0; i < n; i\+\+\)/.test(script), 'one lap maximum');
        });

        test('should state a load failure in a compare pane too, not just on a thumbnail', () => {
            // A broken-image glyph in the one view meant for spotting differences reads as "this
            // screen changed completely" — the exact wrong conclusion.
            const panes = script.split('fms-cmp-img')[1] || '';
            assert.ok(panes.includes("addEventListener('error'"), 'compare panes handle a failed fetch');
        });

        test('should zoom on wheel and by slider, with a reset back to fit', () => {
            assert.ok(script.includes('zoomAttach'), 'zoom is wired when the overlay opens');
            assert.ok(/addEventListener\('wheel'/.test(script), 'scroll-to-zoom');
            assert.ok(script.includes("slider.addEventListener('input'"), 'slider drives the same scale');
            assert.ok(script.includes('zoomReset'), 'and fit is recoverable');
            assert.ok(script.includes('passive: false'), 'wheel can preventDefault, so the page cannot scroll under it');
        });
    });
});
