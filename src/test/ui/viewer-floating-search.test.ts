import * as assert from 'node:assert';
import { getSearchFlyoutHtml }
    from '../../ui/viewer-toolbar/viewer-toolbar-search-html';
import { getSearchScript }
    from '../../ui/viewer-search-filter/viewer-search';
import { getViewerScriptMessageHandler }
    from '../../ui/viewer/viewer-script-messages';

suite('Floating search overlay', () => {

    suite('search flyout HTML', () => {
        const html = getSearchFlyoutHtml();

        test('should have floating flyout container with search-flyout class', () => {
            assert.ok(
                html.includes('class="search-flyout u-hidden"'),
                'flyout must start hidden with search-flyout class',
            );
        });

        test('should include clear button with codicon-close', () => {
            assert.ok(
                html.includes('id="search-clear-btn"'),
                'flyout must contain a clear button element',
            );
            assert.ok(
                html.includes('codicon-close'),
                'clear button must use codicon-close icon',
            );
        });

        test('clear button should be initially hidden', () => {
            assert.ok(
                html.includes('style="display:none"'),
                'clear button must be hidden by default (no text in input)',
            );
        });

        test('should include case, word, and regex toggle buttons', () => {
            assert.ok(html.includes('id="search-case-toggle"'), 'must have case toggle');
            assert.ok(html.includes('id="search-word-toggle"'), 'must have word toggle');
            assert.ok(html.includes('id="search-regex-toggle"'), 'must have regex toggle');
        });

        test('should include match navigation buttons', () => {
            assert.ok(html.includes('id="search-prev"'), 'must have previous match button');
            assert.ok(html.includes('id="search-next"'), 'must have next match button');
        });
    });

    suite('search script — clear button', () => {
        const script = getSearchScript();

        test('should implement updateClearButton with display toggle', () => {
            assert.ok(
                script.includes('function updateClearButton()'),
                'script must define updateClearButton',
            );
            /* Verify the function actually toggles display, not a no-op */
            const fnBlock = script.slice(
                script.indexOf('function updateClearButton()'),
                script.indexOf('function updateClearButton()') + 200,
            );
            assert.ok(
                fnBlock.includes("btn.style.display"),
                'updateClearButton must toggle btn.style.display',
            );
        });

        test('should register click handler on search-clear-btn', () => {
            assert.ok(
                script.includes("getElementById('search-clear-btn')"),
                'script must look up search-clear-btn element',
            );
        });

        test('clear button handler should empty input and refocus', () => {
            const handlerBlock = script.slice(
                script.indexOf("searchClearBtn.addEventListener('click'"),
                script.indexOf("searchClearBtn.addEventListener('click'") + 300,
            );
            assert.ok(
                handlerBlock.includes("searchInputEl.value = ''"),
                'clear handler must empty the input value',
            );
            assert.ok(
                handlerBlock.includes('searchInputEl.focus()'),
                'clear handler must refocus the input after clearing',
            );
        });

        test('clear button handler should reset search state', () => {
            const handlerBlock = script.slice(
                script.indexOf("searchClearBtn.addEventListener('click'"),
                script.indexOf("searchClearBtn.addEventListener('click'") + 300,
            );
            assert.ok(
                handlerBlock.includes('clearSearchState()'),
                'clear handler must call clearSearchState',
            );
            assert.ok(
                handlerBlock.includes('clearSearchFilteredFlags()'),
                'clear handler must call clearSearchFilteredFlags',
            );
        });
    });

    suite('message handler dispatch', () => {
        const handler = getViewerScriptMessageHandler();

        test('should dispatch triggerToggleSearch to toggleSearchPanel', () => {
            assert.ok(
                handler.includes("case 'triggerToggleSearch'"),
                'message handler must handle triggerToggleSearch',
            );
            assert.ok(
                handler.includes('toggleSearchPanel()'),
                'triggerToggleSearch must call toggleSearchPanel()',
            );
        });
    });
});
