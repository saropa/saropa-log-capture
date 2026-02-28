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
    if (typeof recalcAndRender === 'function') { recalcAndRender(); }
    else { recalcHeights(); renderViewport(true); }
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
    rebuildExclusionChips();
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

/** Escape HTML entities in pattern text for safe innerHTML. */
function escapeExclHtml(text) {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Rebuild exclusion pattern chips in the options panel. */
function rebuildExclusionChips() {
    var container = document.getElementById('exclusion-chips');
    var label = document.getElementById('exclusion-label');
    if (!container) return;

    var count = exclusionRules.length;
    if (label) {
        label.textContent = count > 0 ? 'Exclusions (' + count + ')' : 'Exclusions';
    }
    if (count === 0) { container.innerHTML = ''; container.className = 'exclusion-chips'; return; }

    container.className = 'exclusion-chips' + (exclusionsEnabled ? '' : ' exclusion-chips-disabled');
    var parts = [];
    for (var i = 0; i < exclusionRules.length; i++) {
        var src = escapeExclHtml(exclusionRules[i].source);
        parts.push(
            '<span class="exclusion-chip" data-idx="' + i + '">'
            + '<span class="exclusion-chip-text">' + src + '</span>'
            + '<button class="exclusion-chip-remove" data-idx="' + i + '" title="Remove">&times;</button>'
            + '</span>'
        );
    }
    container.innerHTML = parts.join('');
}

/* Wire exclusion chip removal and settings link via event delegation. */
(function() {
    var chipsEl = document.getElementById('exclusion-chips');
    if (chipsEl) {
        chipsEl.addEventListener('click', function(e) {
            var btn = e.target.closest ? e.target.closest('.exclusion-chip-remove') : null;
            if (!btn || btn.dataset.idx === undefined) return;
            var idx = parseInt(btn.dataset.idx, 10);
            var rule = exclusionRules[idx];
            if (rule) {
                vscodeApi.postMessage({ type: 'exclusionRemoved', pattern: rule.source });
            }
            removeExclusion(idx);
        });
    }
    var exclInput = document.getElementById('exclusion-add-input');
    var exclAddBtn = document.getElementById('exclusion-add-btn');
    if (exclInput) {
        exclInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                addExclusion(exclInput.value);
                exclInput.value = '';
                e.preventDefault();
            }
        });
    }
    if (exclAddBtn && exclInput) {
        exclAddBtn.addEventListener('click', function() {
            addExclusion(exclInput.value);
            exclInput.value = '';
            exclInput.focus();
        });
    }
})();

`;
}
