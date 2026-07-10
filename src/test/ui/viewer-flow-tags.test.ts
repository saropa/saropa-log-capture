import * as assert from 'node:assert';
import * as vm from 'node:vm';
import { stringsWebview } from '../../l10n/strings-webview';
import { stringsWebviewB } from '../../l10n/strings-webview-b';
import { getFlowTagsScript } from '../../ui/viewer-flow-tags/viewer-flow-tags';
import { getLineBirthScript } from '../../ui/viewer/viewer-data-add-line-birth';

/**
 * Flow-tag chips (plan 109). Exercises the webview flow-tags script in a VM (no DOM,
 * no vscode) — the classifier, the chip renderer, and the 'hidden' height filter at
 * both line birth (computeLineBirthHeight) and via applyFlowFilter over allLines.
 */
function vtStub(k: string, ...a: (string | number)[]): string {
    let s = stringsWebview[k] ?? stringsWebviewB[k] ?? k;
    for (let i = 0; i < a.length; i++) { s = s.split('{' + i + '}').join(String(a[i])); }
    return s;
}

interface FlowCtx extends Record<string, unknown> {
    classifyFlowTag(text: string): { verb: string; kind: string; name: string; source: unknown } | null;
    renderFlowChip(flow: unknown): string;
    calcFlowFiltered(flowTag: unknown): boolean;
    setFlowTagMode(mode: string): void;
    computeLineBirthHeight(...a: unknown[]): number;
    allLines: { type: string; flowTag: unknown; flowFiltered?: boolean }[];
}

function build(): FlowCtx {
    // ROW_HEIGHT + the two helpers computeLineBirthHeight consults; allLines for applyFlowFilter.
    const prelude = /* javascript */ `
var ROW_HEIGHT = 20;
var allLines = [];
function calcLevelFiltered() { return false; }
function isLineContentBlank() { return false; }
`;
    const code = prelude + getFlowTagsScript() + getLineBirthScript();
    const ctx = vm.createContext({ console, vt: vtStub }) as FlowCtx;
    vm.runInContext(code, ctx, { filename: 'flow-tags.js', timeout: 10_000 });
    return ctx;
}

const TAG = '[12:00:00.000] [console] [log] ';

suite('FlowMap tag chips (plan 109)', () => {

    suite('classifyFlowTag', () => {
        test('parses every verb with kind, name, and optional source', () => {
            const ctx = build();
            const enter = ctx.classifyFlowTag(TAG + '[flowmap] enter screen "Contact View" lib/views/contact_view.dart:58');
            assert.deepStrictEqual(
                { v: enter?.verb, k: enter?.kind, n: enter?.name },
                { v: 'enter', k: 'screen', n: 'Contact View' },
            );
            // Assert on primitive fields: a VM-realm object fails deepStrictEqual's prototype check.
            const es = enter?.source as { file: string; line: number };
            assert.strictEqual(es.file, 'lib/views/contact_view.dart');
            assert.strictEqual(es.line, 58);

            assert.strictEqual(ctx.classifyFlowTag(TAG + '[flowmap] back tab "Home"')?.verb, 'back');
            assert.strictEqual(ctx.classifyFlowTag(TAG + '[flowmap] exit dialog "Picker"')?.verb, 'exit');
            assert.strictEqual(ctx.classifyFlowTag(TAG + '[flowmap] handoff app "Google Maps"')?.verb, 'handoff');
            assert.strictEqual(ctx.classifyFlowTag(TAG + '[flowmap] action "Favorite"')?.verb, 'action');
            assert.strictEqual(ctx.classifyFlowTag(TAG + '[flowmap] error "Payment declined"')?.verb, 'error');
        });

        test('an enter carrying the trailing back keyword classifies as a return', () => {
            const ctx = build();
            const tag = ctx.classifyFlowTag(TAG + '[flowmap] enter screen "Home" back lib/views/home.dart:7');
            assert.strictEqual(tag?.verb, 'back');
            const s = tag?.source as { file: string; line: number };
            assert.strictEqual(s.file, 'lib/views/home.dart');
            assert.strictEqual(s.line, 7);
        });

        test('a non-flow line returns null', () => {
            const ctx = build();
            assert.strictEqual(ctx.classifyFlowTag(TAG + 'Screen Navigation: Home'), null);
            assert.strictEqual(ctx.classifyFlowTag(TAG + 'ordinary debug output'), null);
        });
    });

    suite('renderFlowChip', () => {
        test('emits a verb-classed chip with the localized meaning in the tooltip and no raw tag text', () => {
            const ctx = build();
            const tag = ctx.classifyFlowTag(TAG + '[flowmap] error "Payment declined" lib/api/pay.dart:9');
            const chip = ctx.renderFlowChip(tag);
            assert.ok(chip.includes('class="flow-chip flow-chip-error"'), 'error verb class');
            assert.ok(chip.includes('Payment declined'), 'name shown');
            assert.ok(chip.includes('Failure reported on this surface'), 'localized meaning in tooltip');
            assert.ok(chip.includes('lib/api/pay.dart:9'), 'source anchor in tooltip');
            assert.ok(!chip.includes('[flowmap]'), 'raw tag text stripped');
        });

        test('escapes HTML in a hostile surface name', () => {
            const ctx = build();
            const tag = ctx.classifyFlowTag(TAG + '[flowmap] enter screen "<img src=x>"');
            const chip = ctx.renderFlowChip(tag);
            assert.ok(!chip.includes('<img'), 'angle brackets escaped');
            assert.ok(chip.includes('&lt;img'), 'escaped form present');
        });
    });

    suite('hidden mode filters flow lines only', () => {
        test('calcFlowFiltered gates on hidden mode and a present tag', () => {
            const ctx = build();
            const tag = ctx.classifyFlowTag(TAG + '[flowmap] enter tab "Home"');
            assert.strictEqual(ctx.calcFlowFiltered(tag), false, 'chips mode: not filtered');
            assert.strictEqual(ctx.calcFlowFiltered(null), false, 'non-flow line: never filtered');
            ctx.setFlowTagMode('hidden');
            assert.strictEqual(ctx.calcFlowFiltered(tag), true, 'hidden mode: flow line filtered');
            assert.strictEqual(ctx.calcFlowFiltered(null), false, 'hidden mode: non-flow line still visible');
        });

        test('a flow line is born at height 0 under hidden mode, full height otherwise', () => {
            const ctx = build();
            const tag = ctx.classifyFlowTag(TAG + '[flowmap] enter tab "Home"');
            // computeLineBirthHeight(html, errorSuppressed, tierHidden, classHidden, catFiltered, lvl, scopeFilt, autoHidden, flowTag)
            const args = ['<span>x</span>', false, false, false, false, 'info', false, false] as const;
            assert.strictEqual(ctx.computeLineBirthHeight(...args, tag), 20, 'chips mode: full height');
            ctx.setFlowTagMode('hidden');
            assert.strictEqual(ctx.computeLineBirthHeight(...args, tag), 0, 'hidden mode: born hidden');
            assert.strictEqual(ctx.computeLineBirthHeight(...args, null), 20, 'non-flow line unaffected');
        });

        test('applyFlowFilter marks flow lines but never markers', () => {
            const ctx = build();
            const tag = ctx.classifyFlowTag(TAG + '[flowmap] enter tab "Home"');
            ctx.allLines.push({ type: 'line', flowTag: tag });
            ctx.allLines.push({ type: 'marker', flowTag: null });
            ctx.setFlowTagMode('hidden');
            assert.strictEqual(ctx.allLines[0].flowFiltered, true, 'flow line filtered');
            assert.strictEqual(ctx.allLines[1].flowFiltered, false, 'marker never filtered');
        });
    });
});
