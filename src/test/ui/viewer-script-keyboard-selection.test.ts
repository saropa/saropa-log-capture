import * as assert from 'node:assert';
import { getKeyboardScriptWithDefaults } from '../../ui/viewer/viewer-script-keyboard';
import { getSelectionKeyboardScript } from '../../ui/viewer/viewer-selection-keyboard';
import {
    VIEWER_KEYBINDING_ACTION_IDS,
    getDefaultKeyToAction,
    getViewerActionLabel,
} from '../../ui/viewer/viewer-keybindings';

/* The keyboard-driven selection extension lives across three files:
   - viewer-keybindings.ts:        registers the six action IDs + default keys + labels
   - viewer-script-keyboard.ts:    dispatches keys to the right helper
   - viewer-selection-keyboard.ts: defines the helpers themselves
   These tests pin the contract between all three so a rename in one file does
   not silently break the keyboard chain (the actions are not exercised through
   tsc — they pass through a runtime string switch on `action === '<id>'`). */
suite('Webview keyboard line-selection extension', () => {

    suite('action registration', () => {
        const ids = VIEWER_KEYBINDING_ACTION_IDS as readonly string[];
        const expected = [
            'extendSelectionUp',
            'extendSelectionDown',
            'extendSelectionPageUp',
            'extendSelectionPageDown',
            'extendSelectionTop',
            'extendSelectionBottom',
        ] as const;
        const map = getDefaultKeyToAction();
        const actionsWithDefaults = new Set(Object.values(map));

        for (const id of expected) {
            test(`${id} is a registered action ID`, () => {
                assert.ok(ids.includes(id), `${id} must be in VIEWER_KEYBINDING_ACTION_IDS`);
            });
            test(`${id} has a default key descriptor`, () => {
                /* Reading via getDefaultKeyToAction (key->action) and asserting the action
                   appears as a value is equivalent to having a default; the internal
                   DEFAULT_ACTION_TO_KEY table is not exported. */
                assert.ok(actionsWithDefaults.has(id), `${id} must have a default key descriptor`);
            });
            test(`${id} has a user-facing label`, () => {
                /* getViewerActionLabel returns the actionId itself as a fallback when no
                   label is registered, so a non-equal result confirms the entry exists. */
                const label = getViewerActionLabel(id);
                assert.notStrictEqual(label, id, `${id} must have a registered label`);
                assert.ok(label.length > 0, `${id} label must be non-empty`);
            });
        }

        test('defaults match VS Code conventions (shift+arrows, shift+page, ctrl+shift+home/end)', () => {
            assert.strictEqual(map['shift+arrowdown'], 'extendSelectionDown');
            assert.strictEqual(map['shift+arrowup'], 'extendSelectionUp');
            assert.strictEqual(map['shift+pagedown'], 'extendSelectionPageDown');
            assert.strictEqual(map['shift+pageup'], 'extendSelectionPageUp');
            assert.strictEqual(map['ctrl+shift+end'], 'extendSelectionBottom');
            assert.strictEqual(map['ctrl+shift+home'], 'extendSelectionTop');
        });
    });

    suite('script dispatch (viewer-script-keyboard.ts)', () => {
        const script = getKeyboardScriptWithDefaults();

        /* Slice a single action's branch out of the keyboard script by anchoring
           on the `if (action === '<id>')` line and reading to the closing `;`.
           Each handler is one statement on one line in this file, so this is
           bounded and stable. */
        function branch(actionId: string): string {
            const start = script.indexOf(`action === '${actionId}'`);
            assert.ok(start >= 0, `expected ${actionId} branch in keyboard script`);
            const end = script.indexOf('return;', start);
            assert.ok(end > start, `expected return; terminator for ${actionId} branch`);
            return script.slice(start, end + 'return;'.length);
        }

        test('extendSelectionDown calls extendLineSelection(1, 1)', () => {
            const b = branch('extendSelectionDown');
            assert.ok(b.includes('extendLineSelection(1, 1)'), 'down step is +1, count 1');
            assert.ok(b.includes("typeof extendLineSelection === 'function'"), 'guarded for separate-script scope');
            assert.ok(b.includes('e.preventDefault()'), 'must preventDefault so the browser does not scroll');
        });

        test('extendSelectionUp calls extendLineSelection(-1, 1)', () => {
            const b = branch('extendSelectionUp');
            assert.ok(b.includes('extendLineSelection(-1, 1)'), 'up step is -1, count 1');
            assert.ok(b.includes('e.preventDefault()'));
        });

        test('extendSelectionPageDown calls extendLineSelectionByPage(1)', () => {
            const b = branch('extendSelectionPageDown');
            assert.ok(b.includes('extendLineSelectionByPage(1)'), 'page step uses helper, direction +1');
        });

        test('extendSelectionPageUp calls extendLineSelectionByPage(-1)', () => {
            const b = branch('extendSelectionPageUp');
            assert.ok(b.includes('extendLineSelectionByPage(-1)'));
        });

        test('extendSelectionBottom calls extendLineSelectionToEdge(1)', () => {
            const b = branch('extendSelectionBottom');
            assert.ok(b.includes('extendLineSelectionToEdge(1)'), 'bottom = forward edge = +1');
        });

        test('extendSelectionTop calls extendLineSelectionToEdge(-1)', () => {
            const b = branch('extendSelectionTop');
            assert.ok(b.includes('extendLineSelectionToEdge(-1)'), 'top = back edge = -1');
        });
    });

    suite('helper definitions (viewer-selection-keyboard.ts)', () => {
        const script = getSelectionKeyboardScript();

        test('defines the three helpers referenced by the keyboard dispatcher', () => {
            assert.ok(/function extendLineSelection\(/.test(script), 'extendLineSelection must be defined');
            assert.ok(/function extendLineSelectionByPage\(/.test(script), 'extendLineSelectionByPage must be defined');
            assert.ok(/function extendLineSelectionToEdge\(/.test(script), 'extendLineSelectionToEdge must be defined');
        });

        test('tracks lastClickedIdx only on non-shift clicks (shift-clicks already managed by viewer-copy.ts)', () => {
            /* Why this matters: viewer-copy.ts's shift-click handler owns selectionStart/End.
               If we also wrote to lastClickedIdx on shift-clicks we'd race-update the anchor
               concept on the same event. The early-return on e.shiftKey is the guard. */
            assert.ok(script.includes('var lastClickedIdx = -1;'), 'caret tracker must default to -1');
            assert.ok(/addEventListener\('click'[\s\S]+?if \(e\.shiftKey\) return;/.test(script),
                'click handler must early-return on shift so we never race with viewer-copy.ts');
        });

        test('extendLineSelection clears native selection so two highlight systems do not co-exist', () => {
            /* Drag-select leaves a window.getSelection() range. The escape handler clears both
               systems; once the user switches to keyboard extension we must do the same so
               they do not see two different highlights at once. */
            assert.ok(/removeAllRanges\(\)/.test(script),
                'native selection must be cleared on first keyboard extension');
        });

        test('extendLineSelection initializes anchor from lastClickedIdx or first visible line', () => {
            /* No caret in the viewer, so the anchor for keyboard-only users is the implicit
               "last plain click" tracker, falling back to viewport top so Shift+Down before
               any click still works. */
            assert.ok(script.includes('lastClickedIdx'),
                'anchor initialization must consult lastClickedIdx');
            assert.ok(/function _selFirstVisibleIdx\(/.test(script),
                'fallback to first visible line must exist');
        });

        test('_selNextIdx skips filtered/hidden/zero-height rows so motion matches what the eye sees', () => {
            /* Lines with height === 0 are hidden by filters or never rendered (blank-line
               compression); excluded rows are filtered out; repeatHidden is the SQL-repeat
               anchor whose content is represented by its notification row. Stepping over any
               of these in keyboard motion would land the cursor on an invisible row. */
            assert.ok(/function _selNextIdx\(/.test(script));
            assert.ok(/it\.height > 0/.test(script), 'must skip zero-height rows');
            assert.ok(/!it\.excluded/.test(script), 'must skip excluded rows');
            assert.ok(/!it\.repeatHidden/.test(script), 'must skip SQL-repeat hidden anchors');
        });
    });
});
