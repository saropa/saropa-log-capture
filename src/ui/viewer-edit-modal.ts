/**
 * Viewer Edit Modal Script
 *
 * Provides an inline modal to edit a log line and save changes back to the file.
 * Triggered by right-click context menu "Edit Line" action.
 * IMPORTANT: Editing is only allowed when the debug session is stopped to avoid
 * concurrent write conflicts with the active capture process.
 *
 * Integration points:
 * - viewer-context-menu.ts registers the edit action
 * - Extension handles 'editLine' message and writes to file
 * - Modal shows warning if session is active
 */

/**
 * Returns the JavaScript code for the edit modal in the webview.
 */
export function getEditModalScript(): string {
    return /* javascript */ `
/** Index of the currently edited line, or -1 if none. */
var editTargetIdx = -1;

/** Whether the debug session is currently active. */
var isSessionActive = false;

/**
 * Open the edit modal for a specific line index.
 * Shows a warning if the session is active.
 *
 * @param {number} lineIdx - Index into allLines[] of the target line
 */
function openEditModal(lineIdx) {
    if (lineIdx < 0 || lineIdx >= allLines.length) { return; }

    var item = allLines[lineIdx];
    if (item.type === 'marker') { return; } // Can't edit markers

    closeEditModal(); // Close any existing modal
    editTargetIdx = lineIdx;

    var plainText = stripTags(item.html);
    var warning = isSessionActive
        ? '<div class="edit-warning">⚠️ Warning: Debug session is active. Saving may conflict with ongoing writes.</div>'
        : '';

    var html = '<div class="edit-modal-overlay" id="edit-modal-overlay">' +
        '<div class="edit-modal-content">' +
        '<div class="edit-modal-header">' +
        'Edit Line ' + (lineIdx + 1) +
        '<button class="edit-modal-close">&#x2715;</button>' +
        '</div>' +
        warning +
        '<textarea id="edit-modal-textarea" rows="5">' +
        plainText.replace(/</g, '&lt;').replace(/>/g, '&gt;') +
        '</textarea>' +
        '<div class="edit-modal-footer">' +
        '<button id="edit-modal-save" class="edit-modal-btn edit-modal-save">Save</button>' +
        '<button id="edit-modal-cancel" class="edit-modal-btn edit-modal-cancel">Cancel</button>' +
        '</div>' +
        '</div>' +
        '</div>';

    var modalEl = document.createElement('div');
    modalEl.innerHTML = html;
    document.body.appendChild(modalEl.firstChild);

    // Attach event handlers
    var overlay = document.getElementById('edit-modal-overlay');
    var closeBtn = overlay.querySelector('.edit-modal-close');
    var saveBtn = document.getElementById('edit-modal-save');
    var cancelBtn = document.getElementById('edit-modal-cancel');
    var textarea = document.getElementById('edit-modal-textarea');

    if (closeBtn) {
        closeBtn.addEventListener('click', closeEditModal);
    }
    if (cancelBtn) {
        cancelBtn.addEventListener('click', closeEditModal);
    }
    if (saveBtn) {
        saveBtn.addEventListener('click', function() {
            var newText = textarea.value;
            saveEditedLine(lineIdx, newText);
        });
    }
    if (overlay) {
        overlay.addEventListener('click', function(e) {
            if (e.target === overlay) {
                closeEditModal();
            }
        });
    }

    // Focus and select the textarea
    if (textarea) {
        textarea.focus();
        textarea.select();
    }
}

/**
 * Close the edit modal and remove it from the DOM.
 */
function closeEditModal() {
    editTargetIdx = -1;
    var overlay = document.getElementById('edit-modal-overlay');
    if (overlay) { overlay.remove(); }
}

/**
 * Save the edited line by sending a message to the extension.
 *
 * @param {number} lineIdx - Index of the edited line
 * @param {string} newText - New text content
 */
function saveEditedLine(lineIdx, newText) {
    vscodeApi.postMessage({
        type: 'editLine',
        lineIndex: lineIdx,
        newText: newText,
        timestamp: allLines[lineIdx].timestamp
    });

    // Update the local line display immediately for responsiveness
    allLines[lineIdx].html = escapeHtml(newText);
    renderViewport(true);

    closeEditModal();
}

/**
 * Handle session state changes from extension.
 */
function handleSessionState(msg) {
    isSessionActive = msg.active || false;
}

// Register message handler
window.addEventListener('message', function(event) {
    var msg = event.data;
    if (msg.type === 'sessionState') {
        handleSessionState(msg);
    }
});
`;
}

/**
 * Returns the HTML for the edit modal styles.
 */
export function getEditModalHtml(): string {
    return ''; // Modal is created dynamically via JavaScript
}
