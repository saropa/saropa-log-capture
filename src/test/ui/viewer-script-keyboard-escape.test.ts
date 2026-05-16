import * as assert from 'node:assert';
import { getKeyboardScriptWithDefaults } from '../../ui/viewer/viewer-script-keyboard';

/* The escape keybinding closes any open modal/panel AND must clear both
   selection mechanisms used by the viewer:
   - the click-selection model (selectionStart/End + .selected class) set
     by shift-click in viewer-copy.ts
   - the browser's native text selection from drag-select

   Each is set by a different interaction path, so escape must clear both
   unconditionally; a guard that only clears one would leave a "stuck"
   selection visible on screen depending on how the user originated it. */
suite('Webview keyboard escape clears selection', () => {
    const script = getKeyboardScriptWithDefaults();

    /* Slice from the start of the escape branch to its closing brace so
       assertions are bounded to the right code block. Cannot use the first
       `return;` as the end boundary: the inner closeContextModal early-return
       is the first `return;` in the branch, and the selection-clearing code
       lives AFTER it. Walk braces from the opening `{` of the if-block. */
    const escStart = script.indexOf("if (action === 'escape')");
    assert.ok(escStart >= 0, 'expected escape branch in keyboard script');
    const openBrace = script.indexOf('{', escStart);
    let depth = 1;
    let cursor = openBrace + 1;
    while (cursor < script.length && depth > 0) {
        const ch = script[cursor];
        if (ch === '{') depth++;
        else if (ch === '}') depth--;
        cursor++;
    }
    const escBlock = script.slice(escStart, cursor);

    test('escape branch invokes clearSelection (custom shift-click model)', () => {
        assert.ok(
            escBlock.includes('clearSelection()'),
            'escape must call clearSelection to drop selectionStart/End + .selected',
        );
    });

    test('escape branch invokes removeAllRanges (native drag-select)', () => {
        assert.ok(
            escBlock.includes('removeAllRanges()'),
            'escape must call window.getSelection().removeAllRanges() to drop native ranges',
        );
        assert.ok(
            /window\.getSelection\(\)/.test(escBlock),
            'escape must source ranges from window.getSelection()',
        );
    });

    test('escape branch guards clearSelection availability', () => {
        /* clearSelection lives in viewer-copy.ts; both scripts are concatenated
           into the same scope, but a typeof guard keeps the keyboard script
           safe if the copy script is ever loaded conditionally. */
        assert.ok(
            escBlock.includes("typeof clearSelection === 'function'"),
            'escape must guard clearSelection with typeof check',
        );
    });
});
