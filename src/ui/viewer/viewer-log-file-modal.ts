/**
 * Modal for log file path actions. Layout:
 *   header (title • close)
 *   filename display (monospace, dimmed)
 *   copy actions: Copy filename, Copy relative path, Copy full path
 *   divider (dimmed)
 *   open actions: editor, beside, containing folder, Explorer view, terminal
 *
 * Filename click in the footer opens this; keyboard shortcut can call
 * window.openLogFileActionsModal. The current filename is read live from
 * the footer DOM at open time so a stale value can't be displayed.
 */

import { t } from '../../l10n';

/** HTML for the log file actions modal (uses shared `.modal` styles). */
export function getLogFileModalHtml(): string {
    return /* html */ `
    <div id="log-file-modal" class="modal" role="dialog" aria-modal="true" aria-labelledby="log-file-modal-title">
    <div class="modal-content log-file-modal-content">
        <div class="modal-header">
            <span id="log-file-modal-title">${t('viewer.logFile.title')}</span>
            <button type="button" class="modal-close" title="${t('viewer.popover.close')}" aria-label="${t('viewer.popover.close')}">&times;</button>
        </div>
        <div class="modal-body log-file-modal-body">
            <div id="log-file-modal-filename" class="log-file-modal-filename" aria-live="polite"></div>
            <button type="button" id="log-file-btn-copy-name" class="modal-btn log-file-modal-btn">${t('viewer.logFile.copyFilename')}</button>
            <button type="button" id="log-file-btn-copy-rel" class="modal-btn log-file-modal-btn">${t('viewer.logFile.copyRelativePath')}</button>
            <button type="button" id="log-file-btn-copy-path" class="modal-btn log-file-modal-btn">${t('viewer.logFile.copyFullPath')}</button>
            <hr class="log-file-modal-divider" />
            <button type="button" id="log-file-btn-open-editor" class="modal-btn modal-btn-primary log-file-modal-btn">${t('viewer.logFile.openEditor')}</button>
            <button type="button" id="log-file-btn-open-beside" class="modal-btn log-file-modal-btn">${t('viewer.logFile.openBeside')}</button>
            <button type="button" id="log-file-btn-open-folder" class="modal-btn log-file-modal-btn">${t('viewer.logFile.openFolder')}</button>
            <button type="button" id="log-file-btn-reveal-explorer" class="modal-btn log-file-modal-btn">${t('viewer.logFile.revealInExplorer')}</button>
            <button type="button" id="log-file-btn-open-terminal" class="modal-btn log-file-modal-btn">${t('viewer.logFile.openInTerminal')}</button>
        </div>
    </div>
    </div>`;
}

/** Map of button id → outbound message type. Kept in one table so the dispatch list is auditable. */
const BUTTON_MESSAGE_PAIRS: ReadonlyArray<readonly [string, string]> = [
    ['log-file-btn-copy-name', 'copyCurrentFileName'],
    ['log-file-btn-copy-rel', 'copyCurrentFileRelativePath'],
    ['log-file-btn-copy-path', 'copyCurrentFilePath'],
    ['log-file-btn-open-editor', 'openLogFileInEditor'],
    ['log-file-btn-open-beside', 'openLogFileBeside'],
    ['log-file-btn-open-folder', 'openCurrentFileFolder'],
    ['log-file-btn-reveal-explorer', 'revealLogFileInExplorer'],
    ['log-file-btn-open-terminal', 'openLogFileFolderInTerminal'],
];

/** Webview script: wire modal, footer click, and global openLogFileActionsModal for keybindings. */
export function getLogFileModalScript(): string {
    return /* javascript */ `
(function initLogFileModal() {
    var modal = document.getElementById('log-file-modal');
    var vscodeApi = window._vscodeApi;
    if (!modal || !vscodeApi) return;

    var filenameEl = document.getElementById('log-file-modal-filename');
    /* Plan 057: when opened for a specific accumulated file (a letter from the files
       dialog) this holds that file's absolute path so the action buttons target it via
       a path field. Null = act on the tailed file (original single-file behavior). */
    var currentModalPath = null;

    function refreshFilename() {
        if (!filenameEl) return;
        var footerText = document.getElementById('footer-text');
        var fnEl = footerText ? footerText.querySelector('.footer-filename') : null;
        /* Strip whitespace; the footer renders the filename as text content. */
        var name = fnEl && fnEl.textContent ? fnEl.textContent.trim() : '';
        filenameEl.textContent = name;
        filenameEl.style.display = name ? '' : 'none';
    }

    function openLogFileActionsModal(target) {
        if (target && target.path) {
            currentModalPath = target.path;
            if (filenameEl) {
                filenameEl.textContent = target.name || target.path;
                filenameEl.style.display = '';
            }
        } else {
            currentModalPath = null;
            refreshFilename();
        }
        modal.classList.add('visible');
    }
    function closeLogFileModal() {
        modal.classList.remove('visible');
    }
    window.openLogFileActionsModal = openLogFileActionsModal;

    var closeBtn = modal.querySelector('.modal-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', closeLogFileModal);
    }
    modal.addEventListener('click', function(e) {
        if (e.target === modal) { closeLogFileModal(); }
    });
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && modal.classList.contains('visible')) {
            e.preventDefault();
            closeLogFileModal();
        }
    });

    var pairs = ${JSON.stringify(BUTTON_MESSAGE_PAIRS)};
    pairs.forEach(function(pair) {
        var btn = document.getElementById(pair[0]);
        if (!btn) return;
        btn.addEventListener('click', function() {
            closeLogFileModal();
            /* Carry the target path when opened for a specific file (plan 057);
               omit it for the tailed file so the host uses currentFileUri. */
            vscodeApi.postMessage(currentModalPath ? { type: pair[1], path: currentModalPath } : { type: pair[1] });
        });
    });

    var footerText = document.getElementById('footer-text');
    if (footerText) {
        footerText.addEventListener('dragstart', function(e) { e.preventDefault(); });
        footerText.addEventListener('click', function(e) {
            var fnEl = e.target && e.target.closest ? e.target.closest('.footer-filename') : null;
            if (!fnEl) return;
            e.preventDefault();
            e.stopPropagation();
            /* Plan 109: the filename click now opens the inline log banner (current-file actions +
               kebab), not this modal. The modal stays for the keyboard shortcut and the files-list
               dialog (per-file actions on an accumulated file). Fall back to the modal if the banner
               script is unavailable for any reason. */
            if (typeof window.openLogActionsBanner === 'function') { window.openLogActionsBanner(); }
            else { openLogFileActionsModal(); }
        });
    }
})();
`;
}
