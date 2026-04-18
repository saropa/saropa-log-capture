/**
 * JSON formatting for the viewer (plan 051).
 *
 * When fileMode === 'json' and formatEnabled === true, indents lines
 * by brace/bracket nesting depth, applies syntax coloring for keys,
 * string values, numbers, booleans, null, and provides collapsible
 * brace/bracket pairs.
 */

/** Returns the JSON formatting script chunk. */
export function getViewerFormatJsonScript(): string {
    return /* javascript */ `

/**
 * JSON brace-pair map: openerIndex → { closerIndex, collapsed, depth }.
 * Built once when formatting is toggled on, reused until file changes.
 */
var jsonBracePairs = {};
/** Per-line nesting depth (0-based), computed during brace-pair scan. */
var jsonLineDepths = [];

/**
 * Build the JSON brace-pair map and depth array from allLines.
 * Handles nested objects/arrays by tracking a depth stack.
 */
function buildJsonBracePairs() {
    jsonBracePairs = {};
    jsonLineDepths = [];
    if (fileMode !== 'json') return;
    var stack = [];
    var depth = 0;
    for (var i = 0; i < allLines.length; i++) {
        var plain = stripTags(allLines[i].html).trim();
        /* Closing brace/bracket decreases depth before recording this line's depth. */
        var closingFirst = /^[}\\]]/.test(plain);
        if (closingFirst && depth > 0) {
            depth--;
            if (stack.length > 0) {
                var opener = stack.pop();
                jsonBracePairs[opener] = { closerIndex: i, collapsed: false, depth: depth };
            }
        }
        jsonLineDepths[i] = depth;
        /* Opening brace/bracket at end of line increases depth. */
        var openMatch = /[{\\[]\\s*$/.test(plain);
        /* Self-closing on same line (e.g. {} or []) does not count. */
        var selfClose = /[{\\[]\\s*[}\\]]/.test(plain);
        if (openMatch && !selfClose) {
            stack.push(i);
            depth++;
        }
        /* Closing brace/bracket at end (not at start) also decreases depth. */
        if (!closingFirst && /[}\\]]\\s*,?\\s*$/.test(plain) && !/^\\s*[{\\[]/.test(plain)) {
            if (depth > 0) {
                depth--;
                if (stack.length > 0) {
                    var op2 = stack.pop();
                    jsonBracePairs[op2] = { closerIndex: i, collapsed: false, depth: depth };
                }
            }
        }
    }
}

/** Toggle a JSON brace-pair collapse. */
function toggleJsonSection(openerIdx) {
    var pair = jsonBracePairs[openerIdx];
    if (!pair) return;
    pair.collapsed = !pair.collapsed;
    for (var i = openerIdx + 1; i <= pair.closerIndex && i < allLines.length; i++) {
        allLines[i]._jsonSectionHidden = pair.collapsed;
    }
    if (typeof recalcHeights === 'function') recalcHeights();
    if (typeof buildPrefixSums === 'function') buildPrefixSums();
    if (typeof renderViewport === 'function') renderViewport(true);
}

/**
 * Format a single JSON line for display. Returns modified HTML.
 * Only called when fileMode === 'json' && formatEnabled.
 */
function formatJsonLine(item, idx) {
    var plain = stripTags(item.html);
    var depth = (idx < jsonLineDepths.length) ? jsonLineDepths[idx] : 0;
    var indent = '';
    for (var d = 0; d < depth; d++) indent += '  ';

    var pair = jsonBracePairs[idx];
    var chevron = '';
    var badge = '';
    if (pair) {
        chevron = pair.collapsed ? '\\u25b6 ' : '\\u25bc ';
        if (pair.collapsed) {
            var innerCount = pair.closerIndex - idx - 1;
            /* Show collapsed summary: { ... N keys } or [ ... N items ] */
            var opener = plain.trim();
            var bracket = opener.charAt(opener.length - 1);
            var closeBracket = bracket === '{' ? '}' : ']';
            var unit = bracket === '{' ? 'keys' : 'items';
            badge = ' <span class="json-collapse-badge">' + bracket + ' \\u2026 ' + innerCount + ' ' + unit + ' ' + closeBracket + '</span>';
        }
    }

    /* Syntax color the line content. */
    var colored = colorizeJsonLine(plain.trim());

    return '<span class="json-line" style="--json-depth:' + depth + '" ' +
        (pair ? 'data-json-section="' + idx + '"' : '') + '>' +
        indent + chevron + colored + badge + '</span>';
}

/** Apply syntax coloring to a JSON line. */
function colorizeJsonLine(text) {
    /* Key: "key": */
    text = text.replace(/"([^"]+)"\\s*:/g, '<span class="json-key">"$1"</span>:');
    /* String value: "value" (not followed by :, so not a key) */
    text = text.replace(/"([^"]*)"/g, function(match) {
        /* Skip if already wrapped (key) */
        if (match.indexOf('json-key') >= 0) return match;
        return '<span class="json-string">' + match + '</span>';
    });
    /* Number */
    text = text.replace(/\\b(-?\\d+\\.?\\d*(?:[eE][+-]?\\d+)?)\\b/g, '<span class="json-number">$1</span>');
    /* Boolean and null */
    text = text.replace(/\\b(true|false|null)\\b/g, '<span class="json-bool">$1</span>');
    /* Braces and brackets in muted color */
    text = text.replace(/([{}\\[\\]])/g, '<span class="json-brace">$1</span>');
    return text;
}
`;
}
