/**
 * Modal showing structured session-header details from the SAROPA LOG CAPTURE
 * banner at the top of every captured `.log`. Opens from the (i) icon next to
 * the filename in the toolbar; only appears when a header was actually parsed.
 *
 * Why this exists: the flat Record<string, string> behind setSessionInfo loses
 * the original groupings, the launch.json sub-key nesting, and the hyperlink
 * affordances that make a 30-key header skimmable. The modal restores those
 * by reading the raw header lines (sent as setSessionHeaderLines) and
 * re-grouping them into sections with expanders, indenting, hotlinks, and
 * long-press-to-copy on any row.
 *
 * Render/parse helpers live in viewer-session-info-modal-render.ts so this
 * shell can stay under the 300-LOC file limit.
 */

import { t } from '../../l10n';
import { getSessionInfoRenderScript } from './viewer-session-info-modal-render';

/** HTML for the session-info modal (uses shared `.modal` styles). */
export function getSessionInfoModalHtml(): string {
    return /* html */ `
    <div id="session-info-modal" class="modal" role="dialog" aria-modal="true" aria-labelledby="session-info-modal-title">
    <div class="modal-content session-info-modal-content">
        <div class="modal-header">
            <span id="session-info-modal-title">${t('viewer.sessionInfo.title')}</span>
            <button type="button" class="modal-close" title="${t('viewer.popover.close')}" aria-label="${t('viewer.popover.close')}">&times;</button>
        </div>
        <div class="modal-body session-info-modal-body">
            <div id="session-info-modal-content-root" class="session-info-content"></div>
            <div class="session-info-hint">${t('viewer.sessionInfo.copyHint')}</div>
        </div>
    </div>
    </div>`;
}

/** Webview script: wire open/close, button visibility, long-press copy, hotlinks. */
export function getSessionInfoModalScript(): string {
    return getSessionInfoRenderScript() + /* javascript */ `
(function initSessionInfoModal() {
    var modal = document.getElementById('session-info-modal');
    var vscodeApi = window._vscodeApi;
    if (!modal || !vscodeApi) return;

    var contentRoot = document.getElementById('session-info-modal-content-root');
    var infoBtn = document.getElementById('session-info-btn');

    /* Raw header lines arrive after the load is parsed. Hold the latest copy
       on window so reopening the modal does not race the message pipe. */
    window.__sessionHeaderLines = window.__sessionHeaderLines || [];

    function setInfoBtnVisible(visible) {
        if (!infoBtn) return;
        infoBtn.style.display = visible ? '' : 'none';
    }

    /* Called by the message handler when 'setSessionHeaderLines' arrives. */
    window.__applySessionHeaderLines = function(headerLines) {
        var arr = Array.isArray(headerLines) ? headerLines.slice() : [];
        window.__sessionHeaderLines = arr;
        setInfoBtnVisible(arr.length > 0);
    };
    setInfoBtnVisible((window.__sessionHeaderLines || []).length > 0);

    function openSessionInfoModal() {
        if (typeof window.__renderSessionInfo === 'function') {
            window.__renderSessionInfo(contentRoot, window.__sessionHeaderLines || []);
        }
        modal.classList.add('visible');
    }
    function closeSessionInfoModal() { modal.classList.remove('visible'); }
    window.openSessionInfoModal = openSessionInfoModal;

    var closeBtn = modal.querySelector('.modal-close');
    if (closeBtn) closeBtn.addEventListener('click', closeSessionInfoModal);
    modal.addEventListener('click', function(e) {
        if (e.target === modal) closeSessionInfoModal();
    });
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && modal.classList.contains('visible')) {
            e.preventDefault();
            closeSessionInfoModal();
        }
    });

    if (infoBtn) {
        infoBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            openSessionInfoModal();
        });
    }

    /* ---------- Long-press to copy a row ---------- */
    var longPressTimer = null;
    var LONG_PRESS_MS = 500;
    var pressedRow = null;
    var pressMoved = false;

    function cancelLongPress() {
        if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
        pressedRow = null;
        pressMoved = false;
    }

    function startLongPress(row) {
        cancelLongPress();
        pressedRow = row;
        longPressTimer = setTimeout(function() {
            if (pressMoved || !pressedRow) return;
            var text = pressedRow.getAttribute('data-copytext') || '';
            if (!text) return;
            vscodeApi.postMessage({ type: 'copyToClipboard', text: text });
            if (typeof showCopyToast === 'function') showCopyToast();
            longPressTimer = null;
        }, LONG_PRESS_MS);
    }

    function onMouseDown(e) {
        if (e.button !== 0) return;
        var row = e.target && e.target.closest ? e.target.closest('[data-copyable="1"]') : null;
        if (row) startLongPress(row);
    }
    function onTouchStart(e) {
        var row = e.target && e.target.closest ? e.target.closest('[data-copyable="1"]') : null;
        if (row) startLongPress(row);
    }
    function onMouseMove() { pressMoved = true; }

    if (contentRoot) {
        contentRoot.addEventListener('mousedown', onMouseDown);
        contentRoot.addEventListener('mousemove', onMouseMove);
        contentRoot.addEventListener('mouseup', cancelLongPress);
        contentRoot.addEventListener('mouseleave', cancelLongPress);
        contentRoot.addEventListener('touchstart', onTouchStart, { passive: true });
        contentRoot.addEventListener('touchend', cancelLongPress);
        contentRoot.addEventListener('touchmove', function() { pressMoved = true; cancelLongPress(); });
        contentRoot.addEventListener('touchcancel', cancelLongPress);

        /* ---------- Hotlink clicks ---------- */
        contentRoot.addEventListener('click', function(e) {
            var a = e.target && e.target.closest ? e.target.closest('a.session-info-link') : null;
            if (!a) return;
            e.preventDefault();
            e.stopPropagation();
            var action = a.getAttribute('data-action');
            if (action === 'open-url') {
                var url = a.getAttribute('data-url') || '';
                if (url) vscodeApi.postMessage({ type: 'openUrl', url: url });
            } else if (action === 'reveal-path') {
                var pth = a.getAttribute('data-path') || '';
                if (pth) vscodeApi.postMessage({ type: 'revealPath', path: pth });
            }
            /* The click would also fire the long-press's mousedown sibling;
               cancel any pending timer so the link click doesn't also copy. */
            cancelLongPress();
        });
    }
})();
`;
}
