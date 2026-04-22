"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getErrorClassificationScript = getErrorClassificationScript;
/**
 * Client-side JavaScript for error classification and badges.
 *
 * Classifies error log lines into categories (transient, critical, bug)
 * and renders visual badges. Supports suppression of transient errors
 * and notifications for critical errors.
 *
 * Concatenated into the same script scope as viewer-script.ts.
 */
function getErrorClassificationScript() {
    return /* javascript */ `
/** Whether to suppress transient errors (hide via filtering). */
var suppressTransientErrors = false;

/** Whether to trigger notifications for critical errors. */
var breakOnCritical = false;

/**
 * Transient error patterns - expected, temporary failures.
 * Examples: network timeouts, connection refused, socket errors.
 */
var transientPatterns = [
    /TimeoutException/i,
    /SocketException(?=.*(?:Connection refused|timed?\s*out|reset|unreachable|ECONNREFUSED|ETIMEDOUT|ECONNRESET|EHOSTUNREACH|broken pipe))/i,
    /ECONNREFUSED/i,
    /ETIMEDOUT/i,
    /ENOTFOUND/i,
    /Connection refused/i,
    /Network error/i,
    /Request timeout/i,
    /Temporary failure/i,
    /EPIPE/i,
    /ECONNRESET/i
];

/**
 * Critical error patterns - severe failures requiring immediate attention.
 * Examples: null pointer, assertion failures, fatal errors.
 */
var criticalPatterns = [
    /NullPointerException/i,
    /NullReferenceException/i,
    /AssertionError/i,
    /\bFATAL\b/,
    /\bfatal\s+(?:error|exception|crash|signal|fault)/i,
    /Segmentation fault/i,
    /Stack overflow/i,
    /Out of memory/i,
    /OOM/i,
    /Panic/i,
    /Critical error/i,
    /Unhandled exception/i
];

/**
 * Bug error patterns - likely code defects.
 * Examples: undefined is not a function, cannot read property, syntax errors.
 */
var bugPatterns = [
    /undefined is not a function/i,
    /Cannot read property/i,
    /is not defined/i,
    /SyntaxError/i,
    /ReferenceError/i,
    /TypeError/i,
    /Uncaught/i,
    /Unexpected token/i,
    /Invalid argument/i
];

/**
 * Classify an error line into a category.
 * @param {string} plainText - Plain text of the log line
 * @returns {string|null} - 'transient', 'critical', 'bug', or null
 */
function classifyError(plainText) {
    if (!plainText) return null;

    // Check critical first (highest priority)
    for (var i = 0; i < criticalPatterns.length; i++) {
        if (criticalPatterns[i].test(plainText)) {
            return 'critical';
        }
    }

    // Check transient second
    for (var i = 0; i < transientPatterns.length; i++) {
        if (transientPatterns[i].test(plainText)) {
            return 'transient';
        }
    }

    // Check bug patterns last
    for (var i = 0; i < bugPatterns.length; i++) {
        if (bugPatterns[i].test(plainText)) {
            return 'bug';
        }
    }

    return null;
}

/**
 * Get a classification badge for an error type.
 * @param {string} classification - 'transient', 'critical', or 'bug'
 * @returns {string} - HTML for the badge
 */
function getErrorBadge(classification) {
    if (!classification) return '';

    if (classification === 'critical') {
        // Critical is rendered as a bare fire emoji positioned over the severity
        // dot (see .critical-fire-icon in viewer-styles-decoration-bars.ts).
        // WHY no "CRITICAL" text or red box: the inline badge previously
        // overlapped the log content and duplicated the gutter severity dot.
        // The fire icon alone replaces the dot; hover/click still opens the
        // analysis panel because .error-badge-interactive is retained.
        return '<span class="critical-fire-icon error-badge-interactive" title="Critical Error \\u2014 hover for details" aria-label="Critical Error">\\ud83d\\udd25</span>';
    }
    if (classification === 'transient') {
        return '<span class="error-badge error-badge-transient error-badge-interactive" title="Transient Error \\u2014 hover for details">\\u26a1 TRANSIENT</span> ';
    }
    if (classification === 'bug') {
        return '<span class="error-badge error-badge-bug error-badge-interactive" title="Likely Bug \\u2014 hover for details">\\ud83d\\udc1b BUG</span> ';
    }

    return '';
}

/**
 * Handle setting updates from the extension for error classification.
 */
function handleErrorClassificationSettings(msg) {
    if (msg.suppressTransientErrors !== undefined) {
        suppressTransientErrors = !!msg.suppressTransientErrors;
    }
    if (msg.breakOnCritical !== undefined) {
        breakOnCritical = !!msg.breakOnCritical;
    }
    if (msg.levelDetection !== undefined) {
        strictLevelDetection = msg.levelDetection === 'strict';
    }
    if (msg.stderrTreatAsError !== undefined) {
        stderrTreatAsError = !!msg.stderrTreatAsError;
    }
    if (msg.severityKeywords !== undefined) {
        if (typeof applySeverityKeywords === 'function') applySeverityKeywords(msg.severityKeywords);
        if (typeof currentSeverityKeywords !== 'undefined') currentSeverityKeywords = msg.severityKeywords || null;
        if (typeof renderSeverityKeywordsDisplay === 'function') renderSeverityKeywordsDisplay();
    }
    // Re-render when stderr policy, strict mode, or keywords change (levels recalc).
    if (msg.stderrTreatAsError !== undefined || msg.levelDetection !== undefined || msg.severityKeywords !== undefined) {
        if (typeof recalcAndRender === 'function') { recalcAndRender(); }
        else { recalcHeights(); renderViewport(true); }
    }

    // Refilter when suppression changes
    if (msg.suppressTransientErrors !== undefined) {
        applyErrorSuppression();
        if (typeof recalcAndRender === 'function') { recalcAndRender(); }
        else { recalcHeights(); renderViewport(true); }
    }
}

/**
 * Apply error suppression by setting errorSuppressed flag on lines.
 * Called when suppressTransientErrors changes or new lines arrive.
 */
function applyErrorSuppression() {
    for (var i = 0; i < allLines.length; i++) {
        var line = allLines[i];
        if (line.type === 'marker' || line.type === 'stack-frame') continue;
        if (line.tier === 'device-other') continue;

        var plain = stripTags(line.html || '');
        var classification = line.errorClass || classifyError(plain);
        line.errorClass = classification;

        // Suppress transient errors if setting is enabled
        line.errorSuppressed = suppressTransientErrors && classification === 'transient';
    }
}

/**
 * Check if a critical error just appeared and trigger notification.
 * Called from addToData when new lines arrive.
 */
function checkCriticalError(plainText) {
    if (!breakOnCritical) return;

    var classification = classifyError(plainText);
    if (classification === 'critical') {
        // Show VS Code notification
        if (typeof vscodeApi !== 'undefined') {
            vscodeApi.postMessage({
                type: 'showMessage',
                level: 'error',
                message: 'Critical error detected: ' + plainText.substring(0, 100)
            });
        }

        // Flash the viewer border
        if (typeof flashViewer === 'function') {
            flashViewer();
        }
    }
}
`;
}
//# sourceMappingURL=viewer-error-classification.js.map