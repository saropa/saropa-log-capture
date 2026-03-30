import * as assert from 'node:assert';
import { getGotoLineScript } from '../../ui/viewer/viewer-goto-line';
import { getCopyScript } from '../../ui/viewer/viewer-copy';
import { getSearchScript } from '../../ui/viewer-search-filter/viewer-search';

suite('Webview script null guards – interaction', () => {

    suite('viewer-goto-line', () => {
        const script = getGotoLineScript();

        test('should guard logEl.scrollTop in openGotoLine', () => {
            const block = script.slice(
                script.indexOf('function openGotoLine'),
                script.indexOf('function openGotoLine') + 200,
            );
            assert.ok(
                block.includes('logEl ? logEl.scrollTop : 0'),
                'openGotoLine should guard logEl.scrollTop',
            );
        });

        test('should guard logEl in closeGotoLine', () => {
            const block = script.slice(
                script.indexOf('function closeGotoLine'),
                script.indexOf('function closeGotoLine') + 200,
            );
            assert.ok(
                block.includes('&& logEl'),
                'closeGotoLine should guard logEl',
            );
        });

        test('should guard logEl in scrollToLineNumber', () => {
            const block = script.slice(
                script.indexOf('function scrollToLineNumber'),
                script.indexOf('function scrollToLineNumber') + 300,
            );
            assert.ok(
                block.includes('if (!logEl) return'),
                'scrollToLineNumber should early-return when logEl is null',
            );
        });

        test('should guard jumpBtn.style in scrollToLineNumber', () => {
            const block = script.slice(
                script.indexOf('function scrollToLineNumber'),
                script.indexOf('function scrollToLineNumber') + 500,
            );
            assert.ok(
                block.includes('if (jumpBtn) jumpBtn.style'),
                'scrollToLineNumber should guard jumpBtn.style',
            );
        });
    });

    suite('viewer-copy', () => {
        const script = getCopyScript();

        test('should guard copyFloat/wrapperEl/logEl in showCopyFloat', () => {
            const block = script.slice(
                script.indexOf('function showCopyFloat'),
                script.indexOf('function showCopyFloat') + 200,
            );
            assert.ok(
                block.includes('if (!copyFloat || !wrapperEl || !logEl) return'),
                'showCopyFloat should guard all three elements',
            );
        });

        test('should guard copyFloat in hideCopyFloat', () => {
            const block = script.slice(
                script.indexOf('function hideCopyFloat'),
                script.indexOf('function hideCopyFloat') + 100,
            );
            assert.ok(
                block.includes('if (!copyFloat) return'),
                'hideCopyFloat should guard copyFloat',
            );
        });

        test('should guard viewportEl in updateSelectionHighlight', () => {
            const block = script.slice(
                script.indexOf('function updateSelectionHighlight'),
                script.indexOf('function updateSelectionHighlight') + 150,
            );
            assert.ok(
                block.includes('if (!viewportEl) return'),
                'updateSelectionHighlight should guard viewportEl',
            );
        });

        test('should guard viewportEl in clearSelection', () => {
            const block = script.slice(
                script.indexOf('function clearSelection'),
                script.indexOf('function clearSelection') + 150,
            );
            assert.ok(
                block.includes('if (!viewportEl) return'),
                'clearSelection should guard viewportEl',
            );
        });

        test('should guard viewportEl.addEventListener for mouseover', () => {
            assert.ok(
                script.includes("if (viewportEl) viewportEl.addEventListener('mouseover'"),
                'mouseover listener should guard viewportEl',
            );
        });

        test('should guard copyFloat.addEventListener for click', () => {
            assert.ok(
                script.includes("if (copyFloat) copyFloat.addEventListener('click'"),
                'click listener should guard copyFloat',
            );
        });

        test('should guard logEl.addEventListener for scroll', () => {
            assert.ok(
                script.includes("if (logEl) logEl.addEventListener('scroll'"),
                'scroll listener should guard logEl',
            );
        });
    });

    suite('viewer-search', () => {
        const script = getSearchScript();

        test('should guard searchInputEl in openSearch', () => {
            const block = script.slice(
                script.indexOf('function openSearch'),
                script.indexOf('function openSearch') + 150,
            );
            assert.ok(
                block.includes('if (!searchInputEl) return'),
                'openSearch should early-return when searchInputEl is null',
            );
        });

        test('should guard matchCountEl in clearSearchState', () => {
            const block = script.slice(
                script.indexOf('function clearSearchState'),
                script.indexOf('function clearSearchState') + 200,
            );
            assert.ok(
                block.includes("if (matchCountEl) matchCountEl.textContent"),
                'clearSearchState should guard matchCountEl',
            );
        });

        test('should guard searchInputEl.value in updateSearch', () => {
            const block = script.slice(
                script.indexOf('function updateSearch'),
                script.indexOf('function updateSearch') + 200,
            );
            assert.ok(
                block.includes("searchInputEl ? searchInputEl.value : ''"),
                'updateSearch should guard searchInputEl.value',
            );
        });

        test('should guard matchCountEl in updateMatchDisplay', () => {
            const block = script.slice(
                script.indexOf('function updateMatchDisplay'),
                script.indexOf('function updateMatchDisplay') + 300,
            );
            assert.ok(
                block.includes("if (matchCountEl) matchCountEl.textContent"),
                'updateMatchDisplay should guard matchCountEl',
            );
        });

        test('should guard logEl in scrollToMatch', () => {
            const block = script.slice(
                script.indexOf('function scrollToMatch'),
                script.indexOf('function scrollToMatch') + 600,
            );
            assert.ok(
                block.includes('if (!logEl) return'),
                'scrollToMatch should early-return when logEl is null',
            );
        });

        test('should guard searchInputEl.addEventListener for focus', () => {
            assert.ok(
                script.includes("if (searchInputEl) searchInputEl.addEventListener('focus'"),
                'focus listener should guard searchInputEl',
            );
        });

        test('should guard searchInputEl.addEventListener for keydown', () => {
            assert.ok(
                script.includes("if (searchInputEl) searchInputEl.addEventListener('keydown'"),
                'keydown listener should guard searchInputEl',
            );
        });

        test('should guard search-next/search-prev addEventListener', () => {
            assert.ok(
                script.includes('if (searchNextBtn) searchNextBtn.addEventListener'),
                'search-next listener should guard element',
            );
            assert.ok(
                script.includes('if (searchPrevBtn) searchPrevBtn.addEventListener'),
                'search-prev listener should guard element',
            );
        });
    });
});
