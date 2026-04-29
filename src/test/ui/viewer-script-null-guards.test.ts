import * as assert from 'node:assert';
import { getViewerScriptMessageHandler } from '../../ui/viewer/viewer-script-messages';
import { getViewerScript } from '../../ui/viewer/viewer-script';
import { getLogFileModalScript } from '../../ui/viewer/viewer-log-file-modal';
import { getViewerScriptFooterChunk } from '../../ui/viewer/viewer-script-footer';
import { getViewportRenderScript } from '../../ui/viewer/viewer-data-viewport';

suite('Webview script null guards – core viewer', () => {

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

    suite('viewer-log-file-modal', () => {
        const script = getLogFileModalScript();

        test('filename click should use closest for target detection', () => {
            assert.ok(
                script.includes("e.target.closest('.footer-filename')"),
                'click handler should use closest for .footer-filename',
            );
        });

        test('filename click should preventDefault and stopPropagation', () => {
            const start = script.indexOf("footerText.addEventListener('click'");
            assert.ok(start >= 0, 'footer filename click listener should exist');
            const clickBlock = script.slice(start, start + 400);
            assert.ok(clickBlock.includes('e.preventDefault()'), 'click should preventDefault');
            assert.ok(clickBlock.includes('e.stopPropagation()'), 'click should stopPropagation');
        });

        test('should prevent dragstart on footer text element', () => {
            assert.ok(
                script.includes("addEventListener('dragstart'"),
                'footer should have a dragstart listener',
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
});
