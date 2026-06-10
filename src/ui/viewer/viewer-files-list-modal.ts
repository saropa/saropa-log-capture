/**
 * Files dialog for the cumulative cross-session live feed (plan 057).
 *
 * The live viewer accumulates lines from every debug session in the window's
 * lifetime under one footer label; each origin file gets a letter code (A, B, …,
 * see viewer-file-code-stamp.ts). This dialog lists those accumulated files —
 * letter, name, line count, time range — and is opened by clicking the `(n)`
 * counter the footer shows next to the filename.
 *
 * Clicking a row reuses the existing single-file actions modal
 * (viewer-log-file-modal.ts → window.openLogFileActionsModal) targeted at that
 * row's file, so copy-path / open-in-editor / reveal all work per file.
 */

import { t } from '../../l10n';

/** HTML shell for the files-list dialog (rows are built live from fileCodeList()). */
export function getFilesListModalHtml(): string {
    return /* html */ `
    <div id="files-list-modal" class="modal" role="dialog" aria-modal="true" aria-labelledby="files-list-modal-title">
    <div class="modal-content files-list-modal-content">
        <div class="modal-header">
            <span id="files-list-modal-title">${t('viewer.files.title')}</span>
            <button type="button" class="modal-close" title="${t('viewer.popover.close')}" aria-label="${t('viewer.popover.close')}">&times;</button>
        </div>
        <div class="modal-body files-list-modal-body">
            <div id="files-list-modal-list" class="files-list-modal-list" role="list"></div>
        </div>
    </div>
    </div>`;
}

/** Webview script: build rows, wire footer counter + row clicks. */
export function getFilesListModalScript(): string {
    return /* javascript */ `
(function initFilesListModal() {
    var modal = document.getElementById('files-list-modal');
    var vscodeApi = window._vscodeApi;
    if (!modal || !vscodeApi) return;

    var listEl = document.getElementById('files-list-modal-list');

    /** HH:MM:SS for an epoch-ms timestamp, or '' when unknown. */
    function fmtTime(ms) {
        if (!ms) return '';
        try { return new Date(ms).toLocaleTimeString(); } catch (e) { return ''; }
    }

    function buildRows() {
        if (!listEl) return;
        listEl.textContent = '';
        var files = (typeof fileCodeList === 'function') ? fileCodeList() : [];
        for (var i = 0; i < files.length; i++) {
            var f = files[i];
            var row = document.createElement('button');
            row.type = 'button';
            row.className = 'modal-btn files-list-modal-row';
            row.setAttribute('role', 'listitem');
            row.dataset.path = f.path;
            row.dataset.name = f.name;

            var letter = document.createElement('span');
            letter.className = 'files-list-letter';
            letter.textContent = f.letter;
            row.appendChild(letter);

            var name = document.createElement('span');
            name.className = 'files-list-name';
            name.textContent = f.name;
            row.appendChild(name);

            var range = fmtTime(f.firstTs);
            if (f.lastTs && f.lastTs !== f.firstTs) range += '\\u2013' + fmtTime(f.lastTs);
            var meta = document.createElement('span');
            meta.className = 'files-list-meta';
            /* Localized "N lines" + optional time range. Counts/times are data. */
            meta.textContent = (typeof vt === 'function')
                ? (vt('viewer.files.lineCount', f.lineCount) + (range ? ' \\u00b7 ' + range : ''))
                : (f.lineCount + ' lines' + (range ? ' \\u00b7 ' + range : ''));
            row.appendChild(meta);

            row.addEventListener('click', function() {
                var p = this.dataset.path, n = this.dataset.name;
                closeFilesListModal();
                /* Reuse the single-file actions modal targeted at this file. */
                if (typeof window.openLogFileActionsModal === 'function') {
                    window.openLogFileActionsModal({ path: p, name: n });
                }
            });
            listEl.appendChild(row);
        }
    }

    function openFilesListModal() {
        buildRows();
        modal.classList.add('visible');
    }
    function closeFilesListModal() {
        modal.classList.remove('visible');
    }
    window.openFilesListModal = openFilesListModal;

    var closeBtn = modal.querySelector('.modal-close');
    if (closeBtn) { closeBtn.addEventListener('click', closeFilesListModal); }
    modal.addEventListener('click', function(e) {
        if (e.target === modal) { closeFilesListModal(); }
    });
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && modal.classList.contains('visible')) {
            e.preventDefault();
            closeFilesListModal();
        }
    });

    /* Footer (n) counter opens this dialog. Delegated on footer-text so it keeps
       working after updateFooterText rebuilds the counter span. */
    var footerText = document.getElementById('footer-text');
    if (footerText) {
        footerText.addEventListener('click', function(e) {
            var cntEl = e.target && e.target.closest ? e.target.closest('.footer-file-count') : null;
            if (!cntEl) return;
            e.preventDefault();
            e.stopPropagation();
            openFilesListModal();
        });
    }
})();
`;
}
