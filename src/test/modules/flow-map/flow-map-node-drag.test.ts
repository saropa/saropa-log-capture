import * as assert from 'assert';
import { renderSvg } from '../../../modules/flow-map/flow-map-svg';
import { flowDiagramHtml } from '../../../modules/flow-map/flow-map-html';
import { flowMapDragScript } from '../../../ui/panels/flow-map-panel-drag-script';
import { flowMapZoomScript } from '../../../ui/panels/flow-map-panel-zoom-script';
import { flowMapStyles } from '../../../ui/panels/flow-map-panel-styles';
import type { FlowEdge, FlowGraph, FlowNode } from '../../../modules/flow-map/flow-map-model';

/**
 * Dragging a card is only possible because the RENDERER publishes what the drag script needs: each
 * card's laid-out box, each edge's two node keys, and the three geometry constants the edge shapes
 * were drawn with. None of that is visible in the diagram, so nothing about a missing attribute
 * looks wrong — the arrows simply stop following the card, which is exactly the failure this
 * feature exists to prevent. These tests pin the contract from both ends.
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
 * Names of `@keyframes` blocks that animate `transform`. Read with a brace counter because keyframe
 * bodies nest — a regex either stops at the first inner `}` or runs past the block into the next
 * rule, and both read as a pass when they should not.
 */
function transformKeyframes(css: string): Set<string> {
    const out = new Set<string>();
    const marker = /@keyframes\s+([\w-]+)[^{]*\{/g;
    for (let m = marker.exec(css); m; m = marker.exec(css)) {
        let depth = 1;
        let i = m.index + m[0].length;
        for (; i < css.length && depth > 0; i++) {
            if (css[i] === '{') { depth++; } else if (css[i] === '}') { depth--; }
        }
        if (css.slice(m.index, i).includes('transform:')) { out.add(m[1]); }
    }
    return out;
}

/** Every keyframe name a rule whose selector mentions `.fm-node` hands to `animation:`. */
function cardAnimationNames(css: string): string[] {
    const out: string[] = [];
    const rule = /(\.fm-node[^{}]*)\{([^}]*)\}/g;
    for (let m = rule.exec(css); m; m = rule.exec(css)) {
        const anim = /animation:\s*([\w-]+)/.exec(m[2]);
        if (anim) { out.push(anim[1]); }
    }
    return out;
}

const LINEAR: FlowGraph = {
    nodes: [node('home'), node('settings')],
    edges: [edge('home', 'settings')],
};

suite('FlowMap card dragging', () => {

    suite('rendered contract', () => {
        test('should publish each card\'s own key and laid-out box', () => {
            const svg = renderSvg(LINEAR);
            // data-key is the NODE key. data-rowkey exists too but a crash node redirects it to the
            // issue table's 'crash' row, so using it here would join every crash card's edges to one
            // imaginary node.
            assert.ok(svg.includes('data-key="home"'), 'the card names itself');
            assert.ok(/data-key="settings"[^>]*data-nx="[\d.]+"/.test(svg), 'and carries its x');
            for (const attr of ['data-nx', 'data-ny', 'data-nw', 'data-nh']) {
                assert.strictEqual(
                    svg.split(attr).length - 1, 2, `${attr} is on both cards`);
            }
        });

        test('should wrap each edge in a group naming the two cards it joins', () => {
            const svg = renderSvg(LINEAR);
            assert.ok(
                svg.includes('<g class="fm-edge" data-from="home" data-to="settings">'),
                'the edge names its endpoints');
            assert.ok(svg.includes('class="fm-e-fwd"'), 'and still contains the arrow itself');
        });

        test('should record which bulge lane a back edge took', () => {
            // Recomputing the lane client-side would let two returns collapse onto each other the
            // moment a drag changed which card is rightmost.
            const graph: FlowGraph = {
                nodes: [node('home'), node('settings'), node('about')],
                edges: [
                    edge('home', 'settings'), edge('settings', 'about'),
                    edge('settings', 'home', { back: true }), edge('about', 'home', { back: true }),
                ],
            };
            const svg = renderSvg(graph);
            assert.ok(svg.includes('data-back="1" data-backidx="0"'), 'first return keeps lane 0');
            assert.ok(svg.includes('data-back="1" data-backidx="1"'), 'second takes lane 1');
        });

        test('should publish the edge geometry constants the shapes were drawn with', () => {
            // The single source of truth: the drag script reads these rather than keeping a copy
            // that silently drifts the next time the renderer's spacing is tuned.
            assert.ok(/data-geom="8,22,14"/.test(renderSvg(LINEAR)), 'gap, bulge, stagger');
        });

        test('should keep the client\'s fallback equal to what the renderer emits', () => {
            // The fallback only runs if the attribute goes missing, so drift in it is invisible
            // until the day it is needed — and then every edge re-routes to the wrong place.
            const rendered = /data-geom="([^"]+)"/.exec(renderSvg(LINEAR))?.[1];
            const fallback = /getAttribute\('data-geom'\) \|\| '([^']+)'/
                .exec(flowMapDragScript('n'))?.[1];
            assert.strictEqual(fallback, rendered, 'fallback matches the rendered constants');
        });
    });

    suite('drag script', () => {
        const script = flowMapDragScript('abc123');

        test('should be nonce-guarded', () => {
            assert.ok(script.startsWith('<script nonce="abc123">'), 'CSP admits scripts by nonce only');
        });

        test('should read the geometry constants off the SVG, not hard-code them', () => {
            assert.ok(script.includes("getAttribute('data-geom')"), 'constants come from the render');
        });

        test('should divide pointer movement by the live zoom scale', () => {
            // Without it, a card at 40% zoom travels two and a half times as far as the pointer.
            assert.ok(script.includes('scaleNow'), 'a scale helper exists');
            assert.ok(/getBoundingClientRect\(\)\.width/.test(script), 'measured, not assumed');
            assert.ok(/e\.clientX - drag\.sx\) \/ s/.test(script), 'the delta is divided by it');
        });

        test('should re-route both edge kinds when a card moves', () => {
            assert.ok(script.includes('rerouteForward'), 'forward arrows follow');
            assert.ok(script.includes('rerouteBack'), 'return curves follow');
            assert.ok(script.includes('.fm-e-label'), 'so do the dwell labels');
            assert.ok(script.includes('.fm-e-back-label'), 'and the return counts');
        });

        test('should require real movement before a press counts as a drag', () => {
            // A card carries a click (row highlight + log jump) and a double-click (detail popup);
            // a tremor during either must not shift the layout.
            assert.ok(script.includes('DRAG_SLOP'), 'a movement threshold exists');
        });

        test('should swallow the click that ends a drag, in the capture phase', () => {
            // Bubble phase would be too late: the card's own click handler and the thumbnail's
            // lightbox binder both sit below the SVG.
            assert.ok(script.includes('suppressClick'), 'a drag release is remembered');
            assert.ok(/addEventListener\('click',[\s\S]*?\}, true\)/.test(script), 'capture phase');
        });

        test('should leave an edge alone when either endpoint was never placed', () => {
            // Writing NaN coordinates is worse than doing nothing: browsers drop the shape silently
            // and log nothing to trace it by.
            assert.ok(/if \(!from \|\| !to\) \{ return; \}/.test(script), 'guarded');
        });

        test('should expose a reset hook for the lens', () => {
            assert.ok(script.includes('window.__fmResetNodes'), 'the lens can clear the arrangement');
        });

        test('should not suppress the default pointerdown action', () => {
            // preventDefault() on pointerdown also suppresses focus-on-mousedown: a plain click on a
            // card would stop focusing it, dropping the focus ring and sending the next Tab back to
            // wherever focus had been left. The lens's pan handler already ignores .fm-node, so
            // there is no gesture to claim here.
            const down = /pointerdown[\s\S]*?\n  \}\);/.exec(script)?.[0] ?? '';
            assert.ok(down.length > 0, 'the pointerdown handler was found');
            // The CALL, not the word — the handler carries a comment explaining why it is absent.
            assert.ok(!/e\.preventDefault\(\);/.test(down), 'pointerdown leaves focus to the browser');
        });

        test('should suppress the browser\'s own image drag once a card drag is armed', () => {
            // A card's thumbnail is an <img>; a native drag-and-drop takes the pointer stream over
            // and the card silently stops following.
            assert.ok(/addEventListener\('dragstart'/.test(script), 'dragstart is handled');
            assert.ok(/if \(drag\) \{ e\.preventDefault\(\); \}/.test(script), 'only while dragging');
        });

        test('should key its lookups on prototype-free objects', () => {
            // Node keys come from the app's own log text. A screen normalizing to "__proto__" would
            // reassign the prototype of a plain {} instead of adding an entry, and the next read
            // would return that prototype rather than an array — throwing mid-loop and leaving every
            // edge after it un-wired.
            for (const name of ['nodes', 'incident', 'offsets']) {
                assert.ok(
                    new RegExp(`var ${name} = Object\\.create\\(null\\)`).test(script),
                    `${name} is prototype-free`);
            }
            // The reset path reassigns one of them — it must not fall back to a plain literal.
            assert.ok(!/= \{\};/.test(script), 'no plain object literal is used as a key map');
        });
    });

    suite('finding the card an event landed in', () => {
        const script = flowMapDragScript('abc123');

        test('should not depend on closest() alone', () => {
            // A card's thumbnail is an HTML <img> inside a <foreignObject>. closest() is the right
            // tool and does cross that boundary, but if it ever stopped, cards would silently
            // refuse to move with nothing logged. The parentNode walk reaches the same answer by a
            // route that cannot depend on it.
            assert.ok(script.includes('nodeGroupOf'), 'the lookup is its own function');
            assert.ok(script.includes('el.parentNode'), 'with a parentNode fallback');
            assert.ok(
                script.includes("el.classList.contains('fm-node')"),
                'the fallback recognizes a card the same way');
        });
    });

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
            assert.ok(script.includes('laneTop'), 'and have derived tops');
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
            assert.ok(/setOffset\(c\.key, x - c\.n\.x, y - c\.n\.y\)/.test(script), 'offsets, not coordinates');
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

    suite('stylesheet guards', () => {
        const css = flowMapStyles('n');

        test('should never animate transform on a card', () => {
            // A card's POSITION is a transform now, so an animation on the same property would
            // fight the drag and snap a moved card back mid-gesture. Scoped to animations a
            // .fm-node rule actually applies: the diagram's own entrance fade animates transform on
            // the <svg> root, which is a different element and no conflict.
            const risky = transformKeyframes(css);
            const applied = cardAnimationNames(css);
            assert.ok(applied.length > 0, 'cards do carry animations, so the check has teeth');
            for (const name of applied) {
                assert.ok(!risky.has(name), `card animation "${name}" animates transform`);
            }
        });

        test('should keep a dragged card from selecting its own text', () => {
            // A pointer sweeping across a card's SVG text starts a selection that fights the drag
            // and leaves the diagram highlighted after the drop.
            assert.ok(/\.fm-node \{[^}]*user-select: none/.test(css), 'cards are not selectable');
        });

        test('should size the lightbox stage and image from one token', () => {
            // Two literals cannot be kept equal by anything. A stage shorter than the image scrolls
            // in fit mode; a taller one leaves dead space the zoomed picture jumps into.
            assert.ok(css.includes('--shot-fit-h: 70vh'), 'the fit height is defined once');
            assert.strictEqual(
                css.split('max-height: var(--shot-fit-h)').length - 1, 2,
                'both the stage and the image read it');
        });

        test('should scope the container query away from the scrolling column', () => {
            // container-type applies layout and size containment; .detail-col also owns the scroll
            // box, the --report-vh budget, the ResizeObserver target and the collapse class.
            assert.ok(css.includes('#sec-session .sec-body { container-type: inline-size'));
            assert.ok(!/\.detail-col \{[^}]*container-type/.test(css), 'not on the column itself');
        });
    });

    suite('locating a card that has been moved', () => {
        test('should offer its offset to anything that measures by getBBox', () => {
            // getBBox reports a group's OWN user space and excludes its transform. Without this,
            // every consumer that locates a card geometrically silently uses its pre-drag position.
            assert.ok(flowMapDragScript('n').includes('window.__fmOffsetOf'), 'the offset is published');
        });

        test('should center the fault on where the card actually is', () => {
            // A dragged or time-arranged crash card would otherwise scroll the viewport to blank
            // canvas and flash a card that is not on screen.
            const zoom = flowMapZoomScript('abc123');
            assert.ok(zoom.includes('window.__fmOffsetOf(crash)'), 'centering asks for the offset');
            assert.ok(/b\.x \+ off\.dx/.test(zoom), 'and adds it to both axes');
            assert.ok(/b\.y \+ off\.dy/.test(zoom));
            assert.ok(
                zoom.includes("typeof window.__fmOffsetOf === 'function'"),
                'guarded — the drag script is a separate block a panel could omit');
        });
    });

    suite('reset view', () => {
        test('should clear a hand-built arrangement as well as the zoom', () => {
            // Reset view is the only way back to the renderer's layout; without this call a reader
            // who dragged cards apart can refit the zoom and still face the scattered arrangement.
            const zoom = flowMapZoomScript('abc123');
            assert.ok(zoom.includes('window.__fmResetNodes()'), 'reset drops node offsets too');
            assert.ok(
                zoom.includes("typeof window.__fmResetNodes === 'function'"),
                'guarded — the drag script is a separate <script> a panel could omit');
        });
    });
});
