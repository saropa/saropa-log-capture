import * as assert from 'assert';
import { renderSvg } from '../../../modules/flow-map/flow-map-svg';
import { flowDiagramHtml } from '../../../modules/flow-map/flow-map-html';
import { flowMapDragScript } from '../../../ui/panels/flow-map-panel-drag-script';
import { flowMapZoomScript } from '../../../ui/panels/flow-map-panel-zoom-script';
import type { FlowEdge, FlowGraph, FlowNode } from '../../../modules/flow-map/flow-map-model';

/**
 * The two features that reuse the drag script's `setOffset`/re-route machinery without adding a
 * second layout engine: laying cards out by entry time, and exporting the diagram — arranged by
 * hand or by time or left at the default — as a standalone SVG. Split out of
 * `flow-map-node-drag.test.ts` when the drag-contract suite alone reached the file's line budget.
 */

function node(key: string, overrides: Partial<FlowNode> = {}): FlowNode {
    return {
        key, label: key, kind: 'screen', visits: 1, dwellMs: 0, actionCounts: {}, issues: [],
        walked: true, resolved: false, ...overrides,
    };
}

function edge(from: string, to: string, overrides: Partial<FlowEdge> = {}): FlowEdge {
    return { from, to, count: 1, walked: true, ...overrides };
}

/**
 * A top-level function's parameter list and body, found by brace-counting rather than a fixed
 * indentation guess — the depth counter tolerates incidental reformatting the same way
 * `transformKeyframes` (in the sibling drag-contract test file) already does for CSS.
 */
function extractFunction(script: string, name: string): { params: string; body: string } {
    const head = new RegExp(`function ${name}\\(([^)]*)\\)\\{`).exec(script);
    if (!head) { throw new Error(`${name} not found in the generated script`); }
    let depth = 1;
    let i = head.index + head[0].length;
    for (; i < script.length && depth > 0; i++) {
        if (script[i] === '{') { depth++; } else if (script[i] === '}') { depth--; }
    }
    return { params: head[1], body: script.slice(head.index + head[0].length, i - 1) };
}

const LINEAR: FlowGraph = {
    nodes: [node('home'), node('settings')],
    edges: [edge('home', 'settings')],
};

suite('FlowMap arrange-by-time and SVG export', () => {

    suite('arrange by time', () => {
        const script = flowMapDragScript('abc123');
        const timed = (key: string, ts: number) => node(key, { firstTsMs: ts });

        test('should publish each card\'s entry time as its own attribute', () => {
            // Not read out of data-detail: that is a JSON blob built for a human-readable popup, and
            // a layout should not have to parse a document to run.
            const svg = renderSvg({ nodes: [timed('home', 5000)], edges: [] });
            assert.ok(svg.includes('data-ts="5000"'), 'the entry time rides on the card');
        });

        test('should omit the attribute for a card that was never entered', () => {
            // Absent, not zero — 0 is a real ms-of-day (midnight), so a zero default would place an
            // unentered card at the very start of the session.
            assert.ok(!renderSvg({ nodes: [node('home')], edges: [] }).includes('data-ts'));
        });

        test('should offer the control only when something carries a time', () => {
            const withTimes = flowDiagramHtml({ nodes: [timed('home', 1000)], edges: [] });
            const without = flowDiagramHtml({ nodes: [node('home')], edges: [] });
            assert.ok(withTimes.includes('data-zoom="time"'), 'the control is offered');
            assert.ok(!without.includes('data-zoom="time"'), 'and never rendered inert');
        });

        test('should normalize the axis into the canvas the renderer already sized', () => {
            // The lens sizes the SVG from a static viewBox, so a card placed past it is clipped with
            // nothing to scroll to — silently losing the last screen of the session.
            assert.ok(script.includes('BASE_W - TIME_MARGIN * 2 - widest'), 'the axis fits the canvas');
            assert.ok(script.includes('span > 0 && usable > 0'), 'a zero span cannot divide by zero');
        });

        test('should lane-pack cards that land at nearly the same moment', () => {
            assert.ok(script.includes('pickLane'), 'lanes exist');
        });

        test('should size each lane by its own occupants, not the tallest card anywhere', () => {
            // A single oversized crash card must not inflate the row height of every lane below it —
            // only lanes that actually hold a tall card should grow to match.
            assert.ok(script.includes('laneCards'), 'cards are grouped by the lane they landed in');
            assert.ok(
                /entries\.forEach\(function\(e\)\{ if \(e\.c\.n\.h > laneH\)/.test(script),
                'each lane\'s height comes from ITS OWN cards');
            assert.ok(!script.includes('var tallest = 0;'), 'no single global height feeds every lane');
        });

        test('should place untimed cards rather than leave them over the arrangement', () => {
            // Left where the depth layout put them, they would land on top of timed cards.
            assert.ok(script.includes('arrangeUntimed'), 'they get their own row');
        });

        test('should wrap the untimed row at the canvas edge', () => {
            // Same reason the time axis is normalized into the canvas: the lens sizes the SVG from a
            // static viewBox, so an unbounded row silently drops screens off the right of the report.
            assert.ok(
                /x \+ n\.w > BASE_W - TIME_MARGIN/.test(script), 'the row is bounded by the canvas');
            assert.ok(
                /x > TIME_MARGIN &&/.test(script),
                'but a card wider than the canvas still lands rather than wrapping forever');
        });

        test('should drive the arrangement through the drag path, not a second layout engine', () => {
            // An arranged card is a card with an offset, so it stays draggable and its edges
            // re-route through exactly the same code.
            assert.ok(
                /setOffset\(e\.c\.key, e\.x - e\.c\.n\.x, y - e\.c\.n\.y\)/.test(script),
                'offsets, not coordinates');
        });

        test('should refuse to arrange when nothing carries a time', () => {
            assert.ok(
                /if \(cards\.length === 0\) \{ return false; \}/.test(script),
                'the depth layout is left alone rather than collapsed to the left margin');
        });

        test('should clear the arranged flag when the view is reset', () => {
            // Reset drops every offset; a flag left set would make the next press try to un-arrange
            // an arrangement that is no longer on screen.
            assert.ok(/offsets = Object\.create\(null\);\n    arranged = false;/.test(script));
            const zoom = flowMapZoomScript('abc123');
            assert.ok(
                zoom.includes("timeBtn.classList.remove('fm-zoom-active')"),
                'and the control stops reading as engaged');
        });

        test('should light the control while the mode is on', () => {
            const zoom = flowMapZoomScript('abc123');
            assert.ok(
                /btn\.classList\.toggle\('fm-zoom-active', window\.__fmArrangeByTime\(\)\)/.test(zoom),
                'the toggle drives the lit state from the layout\'s own answer');
        });
    });

    suite('arrange by time — lane height, numerically', () => {
        test('should not let a tall card in one lane push down a later lane by MORE than that lane\'s own content', () => {
            // Source-string assertions (elsewhere in this suite) can show "laneCards exists" without
            // proving the arithmetic is right. This runs the REAL extracted timeScale/pickLane/
            // arrangeTimed functions — the same technique flow-map-node-drag.test.ts uses for
            // nodeGroupOf — against hand-picked cards and checks the actual Y two lanes land at.
            const script = flowMapDragScript('n');
            const pl = extractFunction(script, 'pickLane');
            const pickLane = new Function(pl.params, pl.body) as (lanes: number[], x: number) => number;
            const ts = extractFunction(script, 'timeScale');
            const timeScaleFactory = new Function(
                'BASE_W', 'TIME_MARGIN', `return function(${ts.params}){${ts.body}};`,
            ) as (baseW: number, timeMargin: number) => (cards: unknown[]) => (t: number) => number;
            // The five names arrangeTimed's body closes over are passed as ONE dependency object,
            // not five positional arguments — this factory's own parameter count would otherwise
            // trip the project's 4-parameter limit on the very function type that pins it.
            const at = extractFunction(script, 'arrangeTimed');
            const arrangeTimedFactory = new Function(
                'deps',
                'var timeScale = deps.timeScale, pickLane = deps.pickLane, '
                    + 'TIME_MARGIN = deps.TIME_MARGIN, LANE_GAP = deps.LANE_GAP, setOffset = deps.setOffset;'
                    + ` return function(${at.params}){${at.body}};`,
            ) as (deps: {
                timeScale: unknown; pickLane: unknown; TIME_MARGIN: number; LANE_GAP: number;
                setOffset: (key: string, dx: number, dy: number) => void;
            }) => (cards: unknown[]) => number;

            const BASE_W = 2000;
            const TIME_MARGIN = 26;
            const LANE_GAP = 26;
            const timeScale = timeScaleFactory(BASE_W, TIME_MARGIN);
            const offsets: Record<string, { dx: number; dy: number }> = {};
            const setOffset = (key: string, dx: number, dy: number) => { offsets[key] = { dx, dy }; };
            const arrangeTimed = arrangeTimedFactory({ timeScale, pickLane, TIME_MARGIN, LANE_GAP, setOffset });

            const cardAt = (key: string, entryTs: number, h: number) =>
                ({ key, n: { x: 0, y: 0, w: 100, h, ts: entryTs } });
            // "tall" establishes the axis's left end and is TALL; "short-samelane" enters far later
            // and lands in the SAME lane (their x-ranges don't overlap). "lane1" and "lane2" share
            // "short-samelane"'s exact entry instant, so each needs its OWN lane — every card in
            // those two lanes is short, which is exactly the case the old single-pass model got
            // wrong: it sized EVERY lane's row from the tallest card anywhere in the diagram.
            const cards = [
                cardAt('tall', 0, 300),
                cardAt('short-samelane', 1000, 40),
                cardAt('lane1', 1000, 40),
                cardAt('lane2', 1000, 40),
            ];
            arrangeTimed(cards);

            // By hand: lane 0 (tall + short-samelane) is 300 tall, so lane 1 starts at
            // 26 + 300 + 26 = 352; lane 1 holds only a 40-tall card, so lane 2 starts at
            // 352 + 40 + 26 = 418 — not 26 + 2*(300+26) = 678, which is what sizing every lane
            // from the tallest card anywhere would have produced.
            assert.strictEqual(offsets.lane1.dy, 352, 'lane 1 starts after lane 0\'s real height');
            assert.strictEqual(
                offsets.lane2.dy, 418, 'lane 2 starts after lane 1\'s OWN height, not lane 0\'s');
        });
    });

    suite('exporting the arranged diagram as SVG', () => {
        const zoom = flowMapZoomScript('abc123');

        test('should offer the control unconditionally, unlike arrange-by-time', () => {
            // Unlike the time button (gated on something carrying a timestamp), the default depth
            // layout is itself worth exporting — the control has no reason to ever be inert.
            assert.ok(flowDiagramHtml(LINEAR).includes('data-zoom="export-svg"'), 'always rendered');
        });

        test('should bake computed style into a CLONE, never the live diagram', () => {
            // The live SVG is what the reader is looking at and dragging; mutating it to prepare an
            // export would visibly flicker the diagram (or worse, leave export-only styling behind).
            assert.ok(zoom.includes('svg.cloneNode(true)'), 'a clone is made');
            assert.ok(
                /bakeComputedStyle\(svg, clone\)/.test(zoom),
                'computed style is read off the LIVE element and written onto the CLONE');
        });

        test('should walk live and clone elements in lockstep, not by matching selectors', () => {
            // cloneNode(true) preserves document order exactly; querySelectorAll('*') on both trees
            // then visits corresponding elements at the same index with no per-element lookup.
            assert.ok(/liveEls\[i\], cloneEls\[i\]/.test(zoom), 'paired positionally');
        });

        test('should clear stale inline style before baking a fresh one', () => {
            // The live root's zoom-scale width/height rides on svg.style and would otherwise survive
            // the clone verbatim — a leftover CSS-pixel scale baked into a "real size" export.
            assert.ok(/removeAttribute\('style'\)/.test(zoom), 'old inline style is dropped first');
        });

        test('should limit itself to a fixed, small style whitelist', () => {
            // Not a faithful re-creation of every CSS rule — hover states, focus rings and
            // animations have no meaning in a static file and are deliberately left out.
            for (const prop of ['fill', 'stroke', 'stroke-width', 'font-family']) {
                assert.ok(zoom.includes(`'${prop}'`), `${prop} is in the export whitelist`);
            }
        });

        test('should send a self-contained, standalone-renderable document', () => {
            assert.ok(zoom.includes("clone.setAttribute('xmlns'"), 'xmlns survives outside the webview');
            assert.ok(zoom.includes('new XMLSerializer()'), 'serialized to text');
            assert.ok(zoom.includes("send('exportArrangedSvg'"), 'handed to the host to write');
        });

        test('should tell the host how many screenshots were left out', () => {
            // "No silent async": a click that quietly drops information the reader may have wanted
            // must say so, not report the save as if nothing was left out.
            assert.ok(zoom.includes('shotsOmitted: stripped'), 'the count rides along with the export');
        });

        test('should strip thumbnails after baking, not before', () => {
            // Removing nodes from the clone BEFORE the live/clone querySelectorAll('*') pairing
            // would desync the two NodeLists mid-walk — this only works run last.
            assert.ok(
                /bakeComputedStyle\(liveEls\[i\], cloneEls\[i\]\); \}\s*var stripped = stripThumbnails\(clone\)/
                    .test(zoom.replace(/\n\s*/g, ' ')),
                'stripping happens after the baking loop completes');
        });

        test('should remove every thumbnail foreignObject, run against a real fake DOM', () => {
            // Runs the ACTUAL extracted stripThumbnails against fake elements, so the fix for the
            // broken-thumbnail-export defect is proven rather than merely present in the source.
            const sf = extractFunction(zoom, 'stripThumbnails');
            const stripThumbnails = new Function(sf.params, sf.body) as (root: unknown) => number;
            const removed: string[] = [];
            const foreignObject = (id: string) => {
                const el: { id: string; parentNode: null | { removeChild: (c: unknown) => void } } =
                    { id, parentNode: null };
                el.parentNode = { removeChild: (c: unknown) => { removed.push((c as { id: string }).id); } };
                return el;
            };
            const shots = [foreignObject('fo1'), foreignObject('fo2')];
            const root = { querySelectorAll: (sel: string) => (sel === 'foreignObject' ? shots : []) };

            const count = stripThumbnails(root);

            assert.deepStrictEqual(removed.sort(), ['fo1', 'fo2'], 'both thumbnails are removed');
            assert.strictEqual(count, 2, 'and the removed count is returned for the host-side notice');
        });

        test('should do nothing to a diagram with no thumbnails', () => {
            const sf = extractFunction(zoom, 'stripThumbnails');
            const stripThumbnails = new Function(sf.params, sf.body) as (root: unknown) => number;
            const root = { querySelectorAll: () => [] as unknown[] };
            assert.strictEqual(stripThumbnails(root), 0);
        });
    });
});
