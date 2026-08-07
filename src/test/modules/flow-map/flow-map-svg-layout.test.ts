import * as assert from 'assert';
import { MAX_ROW_CARDS, computeDepths, planRows } from '../../../modules/flow-map/flow-map-svg-layout';
import { renderSvg } from '../../../modules/flow-map/flow-map-svg';
import type { FlowEdge, FlowGraph, FlowNode } from '../../../modules/flow-map/flow-map-model';

/** A plain walked screen node. */
function node(key: string, overrides: Partial<FlowNode> = {}): FlowNode {
    return {
        key, label: key, kind: 'screen', visits: 1, dwellMs: 0, actionCounts: {}, issues: [],
        walked: true, resolved: false, ...overrides,
    };
}

/** A node carrying an error issue — what `nodeHasError` (and the fault column) keys off. */
function faultNode(key: string): FlowNode {
    return node(key, {
        issues: [{ tsMs: 0, severity: 'error', category: 'crash', detail: 'boom', clock: '00:00:00' }],
    });
}

function edge(from: string, to: string, overrides: Partial<FlowEdge> = {}): FlowEdge {
    return { from, to, count: 1, walked: true, ...overrides };
}

/** The `viewBox` width of a rendered diagram. */
function svgWidth(graph: FlowGraph): number {
    return Number(/viewBox="0 0 (\d+(?:\.\d+)?)/.exec(renderSvg(graph))?.[1] ?? 0);
}

suite('FlowMap diagram row planning', () => {

    suite('terminal fault leaves', () => {
        test('should pull a terminal fault node out of the walk and key it by its parent', () => {
            const graph: FlowGraph = {
                nodes: [node('home'), faultNode('crash:a')],
                edges: [edge('home', 'crash:a')],
            };
            const plan = planRows(graph);
            assert.deepStrictEqual(plan.rows.flat().map(n => n.key), ['home'], 'walk keeps only the screen');
            assert.deepStrictEqual(plan.faultLeaves.get('home')?.map(n => n.key), ['crash:a']);
        });

        test('should collect every fault leaf of one parent into that parent\'s stack', () => {
            const keys = ['crash:a', 'crash:b', 'crash:c', 'crash:d', 'crash:e'];
            const graph: FlowGraph = {
                nodes: [node('home'), ...keys.map(faultNode)],
                edges: keys.map(k => edge('home', k)),
            };
            assert.strictEqual(planRows(graph).faultLeaves.get('home')?.length, 5);
            assert.strictEqual(planRows(graph).rows.length, 1, 'the walk is one row deep, not two');
        });

        test('should keep a fault node that the session continued past IN the walk', () => {
            // It is a step the user took that happened to fault, not an annotation hanging off one.
            const graph: FlowGraph = {
                nodes: [node('home'), faultNode('settings'), node('about')],
                edges: [edge('home', 'settings'), edge('settings', 'about')],
            };
            const plan = planRows(graph);
            assert.strictEqual(plan.faultLeaves.size, 0, 'nothing moved to the fault column');
            assert.deepStrictEqual(plan.rows.map(r => r.map(n => n.key)), [['home'], ['settings'], ['about']]);
        });

        test('should keep an ORPHAN fault node in the walk — it has no parent to sit beside', () => {
            const graph: FlowGraph = { nodes: [node('home'), faultNode('crash:a')], edges: [] };
            const plan = planRows(graph);
            assert.strictEqual(plan.faultLeaves.size, 0);
            assert.deepStrictEqual(plan.rows.flat().map(n => n.key).sort(), ['crash:a', 'home']);
        });

        test('should not treat a BACK edge as the walk continuing past a fault node', () => {
            const graph: FlowGraph = {
                nodes: [node('home'), faultNode('crash:a')],
                edges: [edge('home', 'crash:a'), edge('crash:a', 'home', { back: true })],
            };
            assert.strictEqual(planRows(graph).faultLeaves.get('home')?.length, 1);
        });
    });

    suite('wide-row wrapping', () => {
        test('should leave a row at the cap alone', () => {
            const kids = ['a', 'b', 'c'];
            const graph: FlowGraph = {
                nodes: [node('home'), ...kids.map(k => node(k))],
                edges: kids.map(k => edge('home', k)),
            };
            assert.deepStrictEqual(planRows(graph).rows.map(r => r.length), [1, MAX_ROW_CARDS]);
        });

        test('should split an over-cap row into near-equal sub-rows, not a full row plus a straggler', () => {
            const kids = ['a', 'b', 'c', 'd'];
            const graph: FlowGraph = {
                nodes: [node('home'), ...kids.map(k => node(k))],
                edges: kids.map(k => edge('home', k)),
            };
            assert.deepStrictEqual(planRows(graph).rows.map(r => r.length), [1, 2, 2]);
        });

        test('should never emit a row wider than the cap', () => {
            const kids = Array.from({ length: 11 }, (_, i) => `k${i}`);
            const graph: FlowGraph = {
                nodes: [node('home'), ...kids.map(k => node(k))],
                edges: kids.map(k => edge('home', k)),
            };
            const widths = planRows(graph).rows.map(r => r.length);
            assert.ok(widths.every(w => w <= MAX_ROW_CARDS), `rows ${widths} all within the cap`);
            assert.strictEqual(widths.reduce((a, b) => a + b, 0), 12, 'and no node was dropped');
        });
    });

    suite('computeDepths', () => {
        test('should layer by LONGEST path so a shortcut never pulls a node up a row', () => {
            const graph: FlowGraph = {
                nodes: [node('a'), node('b'), node('c')],
                edges: [edge('a', 'b'), edge('b', 'c'), edge('a', 'c')],
            };
            assert.strictEqual(computeDepths(graph).get('c'), 2, 'the two-hop path wins');
        });

        test('should not shift a walk node\'s depth just because a fault leaf moved aside', () => {
            const graph: FlowGraph = {
                nodes: [node('home'), faultNode('crash:a'), node('settings')],
                edges: [edge('home', 'crash:a'), edge('home', 'settings')],
            };
            assert.deepStrictEqual(planRows(graph).rows.map(r => r.map(n => n.key)), [['home'], ['settings']]);
        });
    });

    suite('rendered canvas', () => {
        test('should render five sibling faults far narrower than five cards side by side', () => {
            // The reported defect: a four-step session 1272px wide because five terminal crash cards
            // shared one row. Five 168px cards plus gaps alone exceed 980px.
            const keys = ['crash:a', 'crash:b', 'crash:c', 'crash:d', 'crash:e'];
            const graph: FlowGraph = {
                nodes: [node('home'), ...keys.map(faultNode)],
                edges: keys.map(k => edge('home', k)),
            };
            assert.ok(svgWidth(graph) < 500, `canvas is ${svgWidth(graph)}px, not a fan-out`);
        });

        test('should wrap a very tall fault stack into more columns instead of growing forever', () => {
            // Otherwise the fix becomes its own defect rotated ninety degrees: twenty faults under
            // one screen would make a 2000px column beside a 400px walk.
            const build = (n: number): FlowGraph => {
                const keys = Array.from({ length: n }, (_, i) => `crash:${i}`);
                return { nodes: [node('home'), ...keys.map(faultNode)], edges: keys.map(k => edge('home', k)) };
            };
            const svgHeight = (g: FlowGraph) =>
                Number(/viewBox="0 0 [\d.]+ (\d+(?:\.\d+)?)/.exec(renderSvg(g))?.[1] ?? 0);
            assert.strictEqual(svgHeight(build(20)), svgHeight(build(40)), 'height is bounded, not linear in fault count');
            assert.ok(svgWidth(build(40)) > svgWidth(build(20)), 'the overflow goes sideways into more columns');
            assert.strictEqual(svgWidth(build(5)), svgWidth(build(8)), 'and a stack that fits still uses one column');
        });

        test('should cost no extra width when the session has no fault leaves', () => {
            const plain: FlowGraph = { nodes: [node('home'), node('settings')], edges: [edge('home', 'settings')] };
            assert.strictEqual(svgWidth(plain), 168 + 26 * 2, 'one card plus margins — no empty column reserved');
        });

        test('should place every fault leaf below its parent so the arrow still reads downward', () => {
            const graph: FlowGraph = {
                nodes: [node('home'), faultNode('crash:a'), faultNode('crash:b')],
                edges: [edge('home', 'crash:a'), edge('home', 'crash:b')],
            };
            const svg = renderSvg(graph);
            const ys = [...svg.matchAll(/<rect x="(\d+(?:\.\d+)?)" y="(\d+(?:\.\d+)?)"/g)]
                .map(m => ({ x: Number(m[1]), y: Number(m[2]) }));
            const parent = ys[0];
            assert.ok(ys.slice(1).every(r => r.x > parent.x), 'fault cards sit to the right of the walk');
            assert.ok(ys.slice(1).every(r => r.y > parent.y), 'and below their parent');
            assert.notStrictEqual(ys[1].y, ys[2].y, 'stacked, not side by side');
        });
    });
});
