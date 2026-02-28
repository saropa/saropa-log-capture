/**
 * Error Breakpoint Script
 *
 * Provides visual and audio alerts when errors appear in the log:
 * - Flash red border around viewer
 * - Play alert sound
 * - Increment error counter badge
 * - Optional modal popup
 *
 * Can be toggled on/off via options panel.
 */

/** Returns the JavaScript code for error breakpoint handling. */
export function getErrorBreakpointScript(): string {
    return /* javascript */ `
/** Whether error breakpoints are enabled. */
var errorBreakpointsEnabled = false;

/** Count of new errors since last acknowledgment. */
var newErrorCount = 0;

/** Whether to flash on errors. */
var errorFlashEnabled = true;

/** Whether to play sound on errors. */
var errorSoundEnabled = true;

/** Whether to show modal on errors. */
var errorModalEnabled = false;

/**
 * Called when a new error line is added to the viewer.
 */
function onErrorDetected() {
    if (!errorBreakpointsEnabled) return;

    newErrorCount++;
    updateErrorBadge();

    if (errorFlashEnabled) {
        flashErrorIndicator();
    }

    if (errorSoundEnabled && typeof playAudioForLevel === 'function') {
        playAudioForLevel('error');
    }

    if (errorModalEnabled) {
        showErrorModal();
    }
}

/**
 * Flash red border around the viewer.
 */
function flashErrorIndicator() {
    var logEl = document.getElementById('log-content');
    if (!logEl) return;

    logEl.classList.add('error-flash');
    setTimeout(function() {
        logEl.classList.remove('error-flash');
    }, 300);
}

/**
 * Update the error counter badge in the footer.
 */
function updateErrorBadge() {
    var badge = document.getElementById('error-badge');
    if (!badge) return;

    if (newErrorCount > 0) {
        badge.textContent = newErrorCount + ' error' + (newErrorCount === 1 ? '' : 's');
        badge.style.display = 'inline-block';
    } else {
        badge.style.display = 'none';
    }
}

/**
 * Show a modal alert about the error.
 */
function showErrorModal() {
    // Simple alert for now - could be enhanced with a custom modal
    if (newErrorCount === 1) {
        // Only show modal for first error to avoid spam
        var modal = document.getElementById('error-modal');
        if (modal) {
            modal.classList.add('visible');
        }
    }
}

/**
 * Clear/acknowledge the error count.
 */
function clearErrorCount() {
    newErrorCount = 0;
    updateErrorBadge();
    var modal = document.getElementById('error-modal');
    if (modal) {
        modal.classList.remove('visible');
    }
}

/**
 * Toggle error breakpoints on/off.
 */
function toggleErrorBreakpoints() {
    errorBreakpointsEnabled = !errorBreakpointsEnabled;
    var btn = document.getElementById('error-breakpoint-toggle');
    if (btn) {
        btn.textContent = 'Errors: ' + (errorBreakpointsEnabled ? 'ON' : 'OFF');
        btn.style.fontWeight = errorBreakpointsEnabled ? 'bold' : 'normal';
    }
    if (!errorBreakpointsEnabled) {
        clearErrorCount();
    }
}

// Register error badge click to clear count
var errorBadge = document.getElementById('error-badge');
if (errorBadge) {
    errorBadge.addEventListener('click', clearErrorCount);
}

// Register modal close button
var errorModalClose = document.getElementById('error-modal-close');
if (errorModalClose) {
    errorModalClose.addEventListener('click', clearErrorCount);
}

// Hook into message handler to detect errors
window.addEventListener('message', function(event) {
    var msg = event.data;
    if (msg.type === 'addLines' && errorBreakpointsEnabled) {
        // Check if any new lines are errors
        for (var i = 0; i < msg.lines.length; i++) {
            var ln = msg.lines[i];
            // Check if line contains error keywords or has error category
            if (ln.category === 'stderr' ||
                /\\b(error|exception|fail(ed|ure)?|fatal|panic|critical)\\b/i.test(ln.text)) {
                onErrorDetected();
                break; // Only trigger once per batch
            }
        }
    }
});
`;
}

/** Returns the HTML for error breakpoint UI elements. */
export function getErrorBreakpointHtml(): string {
    return `<span id="error-badge"></span>
<div id="error-modal" class="error-modal">
    <div class="error-modal-content">
        <h3>⚠️ Error Detected</h3>
        <p>New errors have appeared in the log.</p>
        <button id="error-modal-close" class="error-modal-btn">OK</button>
    </div>
</div>`;
}
