/**
 * Client-side JavaScript for exclusion filtering in the log viewer.
 * Lines matching exclusion rules are hidden (height set to 0) without
 * removing them from the data array. Concatenated into viewer-script.ts scope.
 */
export function getExclusionScript(): string {
    return /* javascript */ `
var exclusionRules = [];
var exclusionsEnabled = false;
var hiddenCount = 0;
var exclusionCountEl = document.getElementById('exclusion-count');

function addExclusion(pattern) {
    if (!pattern || pattern.trim() === '') return;
    var rule = parseExclusionPattern(pattern.trim());
    if (!rule) return;
    exclusionRules.push(rule);
    applyExclusions();
    vscodeApi.postMessage({ type: 'exclusionAdded', pattern: pattern.trim() });
}

function removeExclusion(idx) {
    if (idx < 0 || idx >= exclusionRules.length) return;
    exclusionRules.splice(idx, 1);
    applyExclusions();
}

function parseExclusionPattern(pattern) {
    if (pattern.startsWith('/') && pattern.lastIndexOf('/') > 0) {
        var last = pattern.lastIndexOf('/');
        var body = pattern.substring(1, last);
        var flags = pattern.substring(last + 1);
        try {
            return { regex: new RegExp(body, flags), source: pattern };
        } catch (e) {
            return null;
        }
    }
    return { text: pattern.toLowerCase(), source: pattern };
}

function testExclusion(text) {
    if (!exclusionsEnabled || exclusionRules.length === 0) return false;
    var plain = stripTags(text).toLowerCase();
    for (var i = 0; i < exclusionRules.length; i++) {
        var rule = exclusionRules[i];
        if (rule.regex) {
            if (rule.regex.test(plain)) return true;
        } else if (plain.indexOf(rule.text) >= 0) {
            return true;
        }
    }
    return false;
}

/**
 * Set excluded flag on lines matching exclusion rules.
 * Delegates height recalculation to the shared recalcHeights() so that
 * category and level filters are also respected. Markers are never excluded.
 */
function applyExclusions() {
    hiddenCount = 0;
    for (var i = 0; i < allLines.length; i++) {
        var item = allLines[i];
        if (item.type === 'marker') continue;
        item.excluded = testExclusion(item.html);
        if (item.excluded) hiddenCount++;
    }
    updateExclusionDisplay();
    recalcHeights();
    renderViewport(true);
}

function toggleExclusions() {
    exclusionsEnabled = !exclusionsEnabled;
    applyExclusions();
}

/** Set exclusions enabled/disabled to a specific value. */
function setExclusionsEnabled(enabled) {
    exclusionsEnabled = !!enabled;
    applyExclusions();
}

function updateExclusionDisplay() {
    if (exclusionCountEl) {
        exclusionCountEl.textContent = hiddenCount > 0 ? '(' + hiddenCount + ' hidden)' : '';
    }
}

function handleSetExclusions(msg) {
    if (msg.patterns) {
        exclusionRules = [];
        for (var i = 0; i < msg.patterns.length; i++) {
            var rule = parseExclusionPattern(msg.patterns[i]);
            if (rule) exclusionRules.push(rule);
        }
        applyExclusions();
    }
}

`;
}
