import * as assert from 'node:assert';
import { getViewerScriptMessageHandler } from '../../ui/viewer/viewer-script-messages';
import { getViewerScript } from '../../ui/viewer/viewer-script';
import { getPerformancePanelScript } from '../../ui/panels/viewer-performance-panel';
import { getErrorHandlerScript } from '../../ui/viewer-decorations/viewer-error-handler';
import { getViewerScriptFooterChunk } from '../../ui/viewer/viewer-script-footer';
import { getGotoLineScript } from '../../ui/viewer/viewer-goto-line';
import { getCopyScript } from '../../ui/viewer/viewer-copy';
import { getSearchScript } from '../../ui/viewer-search-filter/viewer-search';
import { getHiddenLinesScript } from '../../ui/viewer/viewer-hidden-lines';
import { getAutoHideModalScript } from '../../ui/viewer/viewer-auto-hide-modal';
import { getViewportRenderScript } from '../../ui/viewer/viewer-data-viewport';
import { getReplayScript } from '../../ui/viewer/viewer-replay';
import { getSessionNavScript } from '../../ui/viewer-nav/viewer-session-nav';
import { getSplitNavScript } from '../../ui/viewer-nav/viewer-split-nav';

suite('Webview script null guards', () => {

    suite('viewer-script-messages', () => {
        const script = getViewerScriptMessageHandler();

        test('should guard footerEl.classList in clear handler', () => {
            const clearBlock = script.slice(
                script.indexOf("case 'clear':"),
                script.indexOf("case 'updateFooter':"),
            );
            assert.ok(
                clearBlock.includes('if (footerEl) footerEl.classList'),
                'clear handler should guard footerEl.classList',
            );
        });

        test('should guard footerEl.classList in setPaused handler', () => {
            const pausedBlock = script.slice(
                script.indexOf("case 'setPaused':"),
                script.indexOf("case 'setViewingMode':"),
            );
            assert.ok(
                pausedBlock.includes('if (footerEl) footerEl.classList'),
                'setPaused handler should guard footerEl.classList',
            );
        });

        test('should guard footerTextEl in clear handler', () => {
            const clearBlock = script.slice(
                script.indexOf("case 'clear':"),
                script.indexOf("case 'updateFooter':"),
            );
            assert.ok(
                clearBlock.includes("if (footerTextEl) footerTextEl.textContent"),
                'clear handler should guard footerTextEl.textContent',
            );
        });

        test('should guard footerTextEl in updateFooter handler', () => {
            const footerBlock = script.slice(
                script.indexOf("case 'updateFooter':"),
                script.indexOf("case 'setPaused':"),
            );
            assert.ok(
                footerBlock.includes("if (footerTextEl) footerTextEl.textContent"),
                'updateFooter handler should guard footerTextEl.textContent',
            );
        });

        test('should guard jumpBtn.style in loadComplete handler', () => {
            const loadBlock = script.slice(
                script.indexOf("case 'loadComplete':"),
                script.indexOf("case 'loadComplete':") + 400,
            );
            assert.ok(
                loadBlock.includes('if (jumpBtn) jumpBtn.style'),
                'loadComplete handler should guard jumpBtn.style',
            );
        });
    });

    suite('viewer-script', () => {
        const script = getViewerScript(100_000);

        test('should guard logEl.classList in toggleWrap', () => {
            const wrapBlock = script.slice(
                script.indexOf('function toggleWrap'),
                script.indexOf('function toggleWrap') + 200,
            );
            assert.ok(
                wrapBlock.includes('if (logEl) logEl.classList'),
                'toggleWrap should guard logEl.classList',
            );
        });

        test('should guard logEl in handleScroll', () => {
            const block = script.slice(
                script.indexOf('function handleScroll'),
                script.indexOf('function handleScroll') + 200,
            );
            assert.ok(
                block.includes('if (!logEl) return'),
                'handleScroll should early-return when logEl is null',
            );
        });

        test('should guard logEl.addEventListener for scroll', () => {
            assert.ok(
                script.includes("if (logEl) logEl.addEventListener('scroll'"),
                'scroll listener should guard logEl',
            );
        });

        test('should guard logEl.addEventListener for wheel', () => {
            assert.ok(
                script.includes("if (logEl) logEl.addEventListener('wheel'"),
                'wheel listener should guard logEl',
            );
        });

        test('should guard viewportEl.addEventListener for click', () => {
            assert.ok(
                script.includes("if (viewportEl) viewportEl.addEventListener('click'"),
                'click listener should guard viewportEl',
            );
        });

        test('should guard viewportEl.addEventListener for keydown', () => {
            assert.ok(
                script.includes("if (viewportEl) viewportEl.addEventListener('keydown'"),
                'keydown listener should guard viewportEl',
            );
        });

        test('should guard logEl in getCenterIdx', () => {
            const block = script.slice(
                script.indexOf('function getCenterIdx'),
                script.indexOf('function getCenterIdx') + 150,
            );
            assert.ok(
                block.includes('if (!logEl) return 0'),
                'getCenterIdx should early-return when logEl is null',
            );
        });

        test('should guard logEl in jumpToBottom', () => {
            const block = script.slice(
                script.indexOf('function jumpToBottom'),
                script.indexOf('function jumpToBottom') + 150,
            );
            assert.ok(
                block.includes('if (!logEl) return'),
                'jumpToBottom should early-return when logEl is null',
            );
        });

        test('should guard logEl in ResizeObserver', () => {
            assert.ok(
                script.includes('if (logEl) new ResizeObserver'),
                'ResizeObserver should guard logEl',
            );
        });

        test('should guard logEl in onLogOrWrapResize', () => {
            const block = script.slice(
                script.indexOf('function onLogOrWrapResize'),
                script.indexOf('function onLogOrWrapResize') + 300,
            );
            assert.ok(
                block.includes('if (logEl && allLines.length'),
                'onLogOrWrapResize should guard logEl',
            );
        });
    });

    suite('viewer-script-footer', () => {
        const script = getViewerScriptFooterChunk();

        test('should guard footerTextEl in updateFooterText', () => {
            const block = script.slice(
                script.indexOf('function updateFooterText'),
                script.indexOf('function updateFooterText') + 150,
            );
            assert.ok(
                block.includes('if (!footerTextEl) return'),
                'updateFooterText should early-return when footerTextEl is null',
            );
        });
    });

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
                script.indexOf('function scrollToMatch') + 400,
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

    suite('viewer-hidden-lines', () => {
        const script = getHiddenLinesScript();

        test('should guard querySelector for hidden-count-text', () => {
            const block = script.slice(
                script.indexOf('function updateHiddenDisplay'),
                script.indexOf('function updateHiddenDisplay') + 500,
            );
            assert.ok(
                block.includes("if (countTextEl) countTextEl.textContent"),
                'updateHiddenDisplay should guard querySelector result',
            );
        });
    });

    suite('viewer-auto-hide-modal', () => {
        const script = getAutoHideModalScript();

        test('should guard querySelector for backdrop in initAutoHideModal', () => {
            const block = script.slice(
                script.indexOf('function initAutoHideModal'),
                script.indexOf('function initAutoHideModal') + 400,
            );
            assert.ok(
                block.includes("if (backdropEl) backdropEl.addEventListener"),
                'backdrop listener should guard querySelector result',
            );
        });

        test('should guard querySelector for close btn in initAutoHideModal', () => {
            const block = script.slice(
                script.indexOf('function initAutoHideModal'),
                script.indexOf('function initAutoHideModal') + 600,
            );
            assert.ok(
                block.includes("if (closeEl) closeEl.addEventListener"),
                'close button listener should guard querySelector result',
            );
        });

        test('should guard querySelector for list in initAutoHideModal', () => {
            const block = script.slice(
                script.indexOf('function initAutoHideModal'),
                script.indexOf('function initAutoHideModal') + 600,
            );
            assert.ok(
                block.includes("if (listEl) listEl.addEventListener"),
                'list listener should guard querySelector result',
            );
        });

        test('should guard list.innerHTML in populateAutoHideModal', () => {
            const block = script.slice(
                script.indexOf('function populateAutoHideModal'),
                script.indexOf('function populateAutoHideModal') + 600,
            );
            assert.ok(
                block.includes("if (list) list.innerHTML"),
                'populateAutoHideModal should guard list.innerHTML',
            );
        });
    });

    suite('viewer-data-viewport', () => {
        const script = getViewportRenderScript();

        test('should guard logEl at top of renderViewport', () => {
            const block = script.slice(
                script.indexOf('function renderViewport'),
                script.indexOf('function renderViewport') + 150,
            );
            assert.ok(
                block.includes('if (!logEl || !logEl.clientHeight) return'),
                'renderViewport should guard logEl',
            );
        });

        test('should guard children[ni] in findNextDotSibling', () => {
            const block = script.slice(
                script.indexOf('function findNextDotSibling'),
                script.indexOf('function findNextDotSibling') + 300,
            );
            assert.ok(
                block.includes('if (!children[ni]) continue'),
                'findNextDotSibling should guard children[ni]',
            );
        });
    });

    suite('viewer-replay', () => {
        const script = getReplayScript();

        test('should guard footerActionsMenu in click handler', () => {
            assert.ok(
                script.includes('footerActionsMenu && footerActionsMenu.classList.contains'),
                'footerActionsBtn click should guard footerActionsMenu',
            );
        });
    });

    suite('viewer-session-nav', () => {
        const script = getSessionNavScript();

        test('should guard sessionNav.classList in updateSessionNav', () => {
            assert.ok(
                script.includes("if (sessionNav) sessionNav.classList"),
                'updateSessionNav should guard sessionNav',
            );
        });

        test('should guard sessionPrevBtn.addEventListener', () => {
            assert.ok(
                script.includes("if (sessionPrevBtn) sessionPrevBtn.addEventListener"),
                'sessionPrevBtn listener should be guarded',
            );
        });

        test('should guard sessionNextBtn.addEventListener', () => {
            assert.ok(
                script.includes("if (sessionNextBtn) sessionNextBtn.addEventListener"),
                'sessionNextBtn listener should be guarded',
            );
        });
    });

    suite('viewer-split-nav', () => {
        const script = getSplitNavScript();

        test('should guard splitBreadcrumb.classList in updateSplitInfo', () => {
            assert.ok(
                script.includes("if (splitBreadcrumb) splitBreadcrumb.classList"),
                'updateSplitInfo should guard splitBreadcrumb',
            );
        });

        test('should guard splitPrevBtn.addEventListener', () => {
            assert.ok(
                script.includes("if (splitPrevBtn) splitPrevBtn.addEventListener"),
                'splitPrevBtn listener should be guarded',
            );
        });

        test('should guard splitNextBtn.addEventListener', () => {
            assert.ok(
                script.includes("if (splitNextBtn) splitNextBtn.addEventListener"),
                'splitNextBtn listener should be guarded',
            );
        });
    });

    suite('viewer-performance-panel switchTab', () => {
        const script = getPerformancePanelScript('insight-');

        test('should guard ppTabCurrent.classList in switchTab', () => {
            const tabBlock = script.slice(
                script.indexOf('function switchTab'),
                script.indexOf('function switchTab') + 400,
            );
            assert.ok(
                tabBlock.includes('if (ppTabCurrent) ppTabCurrent.classList'),
                'switchTab should guard ppTabCurrent.classList',
            );
        });

        test('should guard ppTabTrends.classList in switchTab', () => {
            const tabBlock = script.slice(
                script.indexOf('function switchTab'),
                script.indexOf('function switchTab') + 400,
            );
            assert.ok(
                tabBlock.includes('if (ppTabTrends) ppTabTrends.classList'),
                'switchTab should guard ppTabTrends.classList',
            );
        });
    });

    suite('error handler banner', () => {
        const script = getErrorHandlerScript();

        test('should use addEventListener for error events', () => {
            assert.ok(
                script.includes("window.addEventListener('error'"),
                'should use addEventListener instead of window.onerror',
            );
        });

        test('should capture stack trace from error event', () => {
            assert.ok(
                script.includes('ev.error.stack'),
                'should extract stack from error event',
            );
        });

        test('should include line and col in error text', () => {
            assert.ok(
                script.includes("line + ', col ' + col"),
                'banner should show line and column numbers',
            );
        });

        test('should include a Copy button in the banner', () => {
            assert.ok(
                script.includes("copyBtn.textContent = 'Copy'"),
                'banner should have a copy button',
            );
        });

        test('should make error text selectable', () => {
            assert.ok(
                script.includes('user-select:text'),
                'banner text should be user-selectable',
            );
        });
    });
});
