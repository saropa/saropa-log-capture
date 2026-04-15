import * as assert from 'node:assert';
import { getHiddenLinesScript } from '../../ui/viewer/viewer-hidden-lines';
import { getAutoHideModalScript } from '../../ui/viewer/viewer-auto-hide-modal';
import { getReplayScript } from '../../ui/viewer/viewer-replay';
import { getSessionNavScript } from '../../ui/viewer-nav/viewer-session-nav';
import { getSplitNavScript } from '../../ui/viewer-nav/viewer-split-nav';
import { getPerformancePanelScript } from '../../ui/panels/viewer-performance-panel';
import { getErrorHandlerScript } from '../../ui/viewer-decorations/viewer-error-handler';

suite('Webview script null guards – panels & nav', () => {

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
        const script = getPerformancePanelScript('signal-');

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
