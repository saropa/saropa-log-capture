/**
 * Client-side JavaScript for JSON detection and collapsible rendering.
 */
export function getJsonScript(): string {
    return /* javascript */ `
// JSON detection and collapsible rendering

/**
 * Check if a string contains parseable JSON.
 * Tries each potential JSON start until valid JSON is found.
 */
function detectJsonInLine(text) {
    if (!text || (!text.includes('{') && !text.includes('['))) {
        return null;
    }

    // Find all potential JSON start positions
    var candidates = [];
    for (var i = 0; i < text.length; i++) {
        if (text[i] === '{') {
            candidates.push({ start: i, closer: '}' });
        } else if (text[i] === '[') {
            candidates.push({ start: i, closer: ']' });
        }
    }

    // Try each candidate until we find valid JSON
    for (var c = 0; c < candidates.length; c++) {
        var start = candidates[c].start;
        var closer = candidates[c].closer;
        var end = findMatchingBracket(text, start, closer);
        if (end < 0) continue;

        var jsonStr = text.slice(start, end + 1);
        try {
            var parsed = JSON.parse(jsonStr);
            if (typeof parsed !== 'object' || parsed === null) continue;
            return {
                start: start,
                end: end + 1,
                prefix: text.slice(0, start),
                json: jsonStr,
                suffix: text.slice(end + 1),
                parsed: parsed
            };
        } catch (e) {
            // Not valid JSON, try next candidate
        }
    }

    return null;
}

function findMatchingBracket(str, start, closer) {
    var opener = str[start];
    var depth = 0;
    var inString = false;
    var escape = false;

    for (var i = start; i < str.length; i++) {
        var ch = str[i];
        if (escape) { escape = false; continue; }
        if (ch === '\\\\') { escape = true; continue; }
        if (ch === '"') { inString = !inString; continue; }
        if (inString) continue;
        if (ch === opener) depth++;
        else if (ch === closer) {
            depth--;
            if (depth === 0) return i;
        }
    }
    return -1;
}

/**
 * Create a collapsible JSON element.
 */
function createJsonCollapsible(detection, lineIdx) {
    var container = document.createElement('span');
    container.className = 'json-collapsible';

    // Prefix (text before JSON)
    if (detection.prefix) {
        var prefixSpan = document.createElement('span');
        prefixSpan.textContent = detection.prefix;
        container.appendChild(prefixSpan);
    }

    // Collapsible toggle
    var toggle = document.createElement('span');
    toggle.className = 'json-toggle collapsed';
    toggle.setAttribute('data-line', lineIdx);
    toggle.textContent = '▶';
    toggle.title = 'Click to expand JSON';
    container.appendChild(toggle);

    // Preview (collapsed view)
    var preview = document.createElement('span');
    preview.className = 'json-preview';
    var previewText = detection.json;
    if (previewText.length > 60) {
        previewText = previewText.slice(0, 57) + '...';
    }
    preview.textContent = previewText;
    container.appendChild(preview);

    // Expanded content (hidden by default)
    var expanded = document.createElement('pre');
    expanded.className = 'json-expanded hidden';
    try {
        expanded.textContent = JSON.stringify(detection.parsed, null, 2);
    } catch (e) {
        expanded.textContent = detection.json;
    }
    container.appendChild(expanded);

    // Suffix (text after JSON)
    if (detection.suffix) {
        var suffixSpan = document.createElement('span');
        suffixSpan.textContent = detection.suffix;
        container.appendChild(suffixSpan);
    }

    // Toggle click handler
    toggle.addEventListener('click', function(e) {
        e.stopPropagation();
        var isCollapsed = toggle.classList.contains('collapsed');
        toggle.classList.toggle('collapsed');
        toggle.textContent = isCollapsed ? '▼' : '▶';
        toggle.title = isCollapsed ? 'Click to collapse JSON' : 'Click to expand JSON';
        preview.classList.toggle('hidden', !isCollapsed);
        expanded.classList.toggle('hidden', isCollapsed);
    });

    return container;
}

/**
 * Process a line element to detect and render JSON.
 */
function processLineForJson(lineEl, text, lineIdx) {
    var detection = detectJsonInLine(text);
    if (!detection) return false;

    // Replace the text content with collapsible JSON
    var jsonEl = createJsonCollapsible(detection, lineIdx);

    // Find the text node or span containing the text
    var textContainer = lineEl.querySelector('.line-text');
    if (textContainer) {
        textContainer.innerHTML = '';
        textContainer.appendChild(jsonEl);
        return true;
    }
    return false;
}

/**
 * Scan visible lines and add JSON collapsibles where needed.
 * Called after rendering lines.
 */
function processVisibleLinesForJson() {
    var viewport = document.getElementById('viewport');
    if (!viewport) return;

    var lines = viewport.querySelectorAll('.log-line:not(.json-processed)');
    for (var i = 0; i < lines.length; i++) {
        var lineEl = lines[i];
        var textEl = lineEl.querySelector('.line-text');
        if (!textEl) continue;

        var text = textEl.textContent || '';
        var lineIdx = parseInt(lineEl.getAttribute('data-idx'), 10);

        if (processLineForJson(lineEl, text, lineIdx)) {
            lineEl.classList.add('json-processed');
        }
    }
}
`;
}
