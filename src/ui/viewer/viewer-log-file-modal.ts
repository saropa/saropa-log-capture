/**
 * Modal for log file path actions: open in editor, open containing folder, copy path.
 * Footer filename click opens this; keyboard shortcut can call window.openLogFileActionsModal.
 */

/** HTML for the log file actions modal (uses shared `.modal` styles). */
export function getLogFileModalHtml(): string {
    return /* html */ `
    <div id="log-file-modal" class="modal" role="dialog" aria-modal="true" aria-labelledby="log-file-modal-title">
    <div class="modal-content log-file-modal-content">
        <div class="modal-header">
            <span id="log-file-modal-title">Log file</span>
            <button type="button" class="modal-close" title="Close" aria-label="Close">&times;</button>
        </div>
        <div class="modal-body log-file-modal-body">
            <button type="button" id="log-file-btn-open-editor" class="modal-btn modal-btn-primary log-file-modal-btn">Open in editor</button>
            <button type="button" id="log-file-btn-open-folder" class="modal-btn log-file-modal-btn">Open containing folder</button>
            <button type="button" id="log-file-btn-copy-path" class="modal-btn log-file-modal-btn">Copy path</button>
        </div>
    </div>
    </div>`;
}

/** Webview script: wire modal, footer click, and global openLogFileActionsModal for keybindings. */
export function getLogFileModalScript(): string {
    return /* javascript */ `
(function initLogFileModal() {
    var modal = document.getElementById('log-file-modal');
    var vscodeApi = window._vscodeApi;
    if (!modal || !vscodeApi) return;

    function openLogFileActionsModal() {
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

    var openEditor = document.getElementById('log-file-btn-open-editor');
    var openFolder = document.getElementById('log-file-btn-open-folder');
    var copyPath = document.getElementById('log-file-btn-copy-path');
    if (openEditor) {
        openEditor.addEventListener('click', function() {
            closeLogFileModal();
            vscodeApi.postMessage({ type: 'openLogFileInEditor' });
        });
    }
    if (openFolder) {
        openFolder.addEventListener('click', function() {
            closeLogFileModal();
            vscodeApi.postMessage({ type: 'openCurrentFileFolder' });
        });
    }
    if (copyPath) {
        copyPath.addEventListener('click', function() {
            closeLogFileModal();
            vscodeApi.postMessage({ type: 'copyCurrentFilePath' });
        });
    }

    var footerText = document.getElementById('footer-text');
    if (footerText) {
        footerText.addEventListener('dragstart', function(e) { e.preventDefault(); });
        footerText.addEventListener('click', function(e) {
            var fnEl = e.target && e.target.closest ? e.target.closest('.footer-filename') : null;
            if (!fnEl) return;
            e.preventDefault();
            e.stopPropagation();
            openLogFileActionsModal();
        });
    }
})();
`;
}
