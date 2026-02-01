/**
 * Session Header for the log viewer webview.
 *
 * Displays a rich, collapsible info block at the top showing session metadata:
 * - Session start time
 * - Project name
 * - Debug adapter type
 * - Configuration name
 * - Platform and versions
 *
 * The header is parsed from the context header block in log files
 * (lines starting with "=== SAROPA LOG CAPTURE").
 */

/** Returns the HTML for the session header element. */
export function getSessionHeaderHtml(): string {
    return /* html */ `<div id="session-header" class="session-header collapsed" style="display:none">
    <div class="session-header-toggle">
        <span class="session-chevron">&#x25B6;</span>
        <span class="session-title">Session Info</span>
    </div>
    <div id="session-header-content" class="session-header-content">
        <div class="session-info-grid"></div>
    </div>
</div>`;
}

/** Returns the JavaScript for session header parsing and display. */
export function getSessionHeaderScript(): string {
    return /* javascript */ `
/** Whether the session header is expanded. */
var sessionHeaderExpanded = false;

/** Parsed session metadata object. */
var sessionInfo = null;

/**
 * Parse the session header from log file content.
 * Looks for lines between "=== SAROPA LOG CAPTURE" and "===...===".
 * @param {string[]} lines - Array of log lines
 * @returns {object|null} Parsed session metadata or null
 */
function parseSessionHeader(lines) {
    var inHeader = false;
    var headerLines = [];

    for (var i = 0; i < lines.length && i < 50; i++) {
        var line = lines[i];
        if (line.indexOf('=== SAROPA LOG CAPTURE') === 0) {
            inHeader = true;
            continue;
        }
        if (inHeader && line.indexOf('===') === 0 && line.indexOf('===') === line.length - 3) {
            break;
        }
        if (inHeader) {
            headerLines.push(line);
        }
    }

    if (headerLines.length === 0) return null;

    var info = {};
    for (var i = 0; i < headerLines.length; i++) {
        var line = headerLines[i].trim();
        if (!line) continue;
        var colonIdx = line.indexOf(':');
        if (colonIdx === -1) continue;
        var key = line.substring(0, colonIdx).trim();
        var value = line.substring(colonIdx + 1).trim();
        info[key] = value;
    }

    return Object.keys(info).length > 0 ? info : null;
}

/**
 * Display the session header with parsed metadata.
 */
function displaySessionHeader() {
    if (!sessionInfo) return;

    var headerEl = document.getElementById('session-header');
    var contentEl = document.querySelector('.session-info-grid');
    if (!headerEl || !contentEl) return;

    // Build grid of key-value pairs
    var html = '';
    var keys = Object.keys(sessionInfo);
    for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        var value = sessionInfo[key];
        html += '<div class="session-info-row">';
        html += '<span class="session-info-key">' + escapeHtml(key) + ':</span>';
        html += '<span class="session-info-value">' + escapeHtml(value) + '</span>';
        html += '</div>';
    }

    contentEl.innerHTML = html;
    headerEl.style.display = '';
}

/**
 * Toggle the session header expanded/collapsed state.
 */
function toggleSessionHeader() {
    sessionHeaderExpanded = !sessionHeaderExpanded;
    var headerEl = document.getElementById('session-header');
    if (!headerEl) return;

    if (sessionHeaderExpanded) {
        headerEl.classList.remove('collapsed');
        headerEl.classList.add('expanded');
    } else {
        headerEl.classList.add('collapsed');
        headerEl.classList.remove('expanded');
    }

    var chevron = headerEl.querySelector('.session-chevron');
    if (chevron) {
        chevron.innerHTML = sessionHeaderExpanded ? '&#x25BC;' : '&#x25B6;';
    }
}

/**
 * Handle setContent message and parse session header if present.
 */
var _origHandleSetContent = typeof handleSetContent === 'function' ? handleSetContent : null;
if (_origHandleSetContent) {
    handleSetContent = function(msg) {
        _origHandleSetContent(msg);

        // Parse session header from content
        if (msg.content && msg.content.length > 0) {
            var plainLines = [];
            for (var i = 0; i < Math.min(50, msg.content.length); i++) {
                plainLines.push(stripTags(msg.content[i]));
            }
            sessionInfo = parseSessionHeader(plainLines);
            if (sessionInfo) {
                displaySessionHeader();
            }
        }
    };
}

// Register click handler for header toggle
var sessionHeaderToggle = document.querySelector('.session-header-toggle');
if (sessionHeaderToggle) {
    sessionHeaderToggle.addEventListener('click', toggleSessionHeader);
}
`;
}
