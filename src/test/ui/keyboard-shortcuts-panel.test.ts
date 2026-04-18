import * as assert from 'assert';
import { getKeyboardShortcutsPanelStyles } from '../../ui/panels/keyboard-shortcuts-panel-styles';
import { getKeyboardShortcutsPanelScript } from '../../ui/panels/keyboard-shortcuts-panel-script';

suite('KeyboardShortcutsPanel', () => {

    suite('styles', () => {
        test('should return non-empty CSS string', () => {
            const css = getKeyboardShortcutsPanelStyles();
            assert.ok(css.length > 0, 'CSS must not be empty');
        });

        test('should use VS Code theme variables', () => {
            const css = getKeyboardShortcutsPanelStyles();
            assert.ok(css.includes('--vscode-foreground'), 'should reference foreground color');
            assert.ok(css.includes('--vscode-editor-background'), 'should reference editor background');
            assert.ok(css.includes('--vscode-keybindingLabel-background'), 'should reference kbd background');
        });

        test('should style kbd elements', () => {
            const css = getKeyboardShortcutsPanelStyles();
            assert.ok(css.includes('kbd'), 'should have kbd selector');
            assert.ok(css.includes('border-radius'), 'kbd should have rounded corners');
        });

        test('should define column width classes', () => {
            const css = getKeyboardShortcutsPanelStyles();
            assert.ok(css.includes('.key-col'), 'should have key column class');
            assert.ok(css.includes('.name-col'), 'should have name column class');
            assert.ok(css.includes('.desc-col'), 'should have description column class');
        });

        test('should include search bar styles', () => {
            const css = getKeyboardShortcutsPanelStyles();
            assert.ok(css.includes('.search-bar'), 'should have search bar class');
            assert.ok(css.includes('.match-count'), 'should have match count class');
            assert.ok(css.includes('sticky'), 'search bar should be sticky');
        });
    });

    suite('script', () => {
        test('should return non-empty JavaScript string', () => {
            const js = getKeyboardShortcutsPanelScript();
            assert.ok(js.length > 0, 'script must not be empty');
        });

        test('should reference the search input element', () => {
            const js = getKeyboardShortcutsPanelScript();
            assert.ok(js.includes('shortcut-search'), 'should get search input by ID');
        });

        test('should reference the clear button', () => {
            const js = getKeyboardShortcutsPanelScript();
            assert.ok(js.includes('shortcut-search-clear'), 'should get clear button by ID');
        });

        test('should reference the match count element', () => {
            const js = getKeyboardShortcutsPanelScript();
            assert.ok(js.includes('shortcut-match-count'), 'should get match count by ID');
        });

        test('should filter by text content', () => {
            const js = getKeyboardShortcutsPanelScript();
            /* The filter reads textContent from each row and checks indexOf */
            assert.ok(js.includes('textContent'), 'should read text from rows');
            assert.ok(js.includes('toLowerCase'), 'should do case-insensitive match');
        });

        test('should hide empty section headings', () => {
            const js = getKeyboardShortcutsPanelScript();
            /* Section headings (h2) are hidden when all their rows are filtered out */
            assert.ok(js.includes("querySelectorAll('h2')"), 'should query section headings');
        });
    });
});
