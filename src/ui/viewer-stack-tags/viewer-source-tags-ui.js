"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSourceTagUiScript = getSourceTagUiScript;
/**
 * Source tag UI rendering: chips, tag links, color palette, and solo behavior.
 *
 * Solo (double-click) behavior:
 * - Double-click a chip to solo it (hide all other tags). The previous hidden
 *   state is saved so a second double-click on the same chip restores it.
 * - Single-click chip toggles are delayed 250ms to distinguish from double-click;
 *   any manual filter change (toggle, All, None, reset) clears the saved solo state.
 * - Inline tag links in the viewport call soloSourceTag directly (single click).
 */
function getSourceTagUiScript() {
    return /* javascript */ `
function escapeTagHtml(text) {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function rebuildTagChips() {
    var container = document.getElementById('source-tag-chips');
    if (!container) { return; }
    var chipKeys = (typeof getSourceTagChipKeys === 'function')
        ? getSourceTagChipKeys()
        : Object.keys(sourceTagCounts);
    chipKeys.sort(function(a, b) { return sourceTagCounts[b] - sourceTagCounts[a]; });
    var limit = sourceTagShowAll ? chipKeys.length : Math.min(chipKeys.length, sourceTagMaxChips);
    var parts = [
        '<span class="source-tag-actions">'
        + '<button class="tag-action-btn" data-action="all">All</button>'
        + '<button class="tag-action-btn" data-action="none">None</button>'
        + '</span>'
    ];
    for (var i = 0; i < limit; i++) {
        var key = chipKeys[i];
        var label = escapeTagHtml(key);
        var active = !hiddenSourceTags[key];
        var cls = 'source-tag-chip' + (active ? ' active' : '');
        parts.push(
            '<button class="' + cls + '" data-tag="' + escapeTagHtml(key) + '">'
            + '<span class="tag-label">' + label + '</span>'
            + '<span class="tag-count">' + sourceTagCounts[key] + '</span></button>'
        );
    }
    if (chipKeys.length > sourceTagMaxChips) {
        var showLabel = sourceTagShowAll ? 'Show less' : 'Show all (' + chipKeys.length + ')';
        parts.push('<button class="tag-show-all-btn" data-action="toggle-all">' + showLabel + '</button>');
    }
    container.innerHTML = parts.join('');
    updateTagSummary();
}

/* Event delegation for chip clicks — avoids inline onclick escaping issues.
 * Chip clicks are delayed 250ms so a double-click can cancel the pending
 * toggle and run soloSourceTag instead — avoids the race where two toggles
 * fire before dblclick and corrupt saved solo state. Action buttons (All,
 * None, Show all) fire immediately since they have no double-click meaning. */
(function() {
    var chipsEl = document.getElementById('source-tag-chips');
    if (!chipsEl) { return; }
    var chipClickTimer = null;
    chipsEl.addEventListener('click', function(e) {
        var chip = e.target.closest('.source-tag-chip');
        if (chip && chip.dataset.tag) {
            var tag = chip.dataset.tag;
            clearTimeout(chipClickTimer);
            chipClickTimer = setTimeout(function() {
                chipClickTimer = null;
                toggleSourceTag(tag);
            }, 250);
            return;
        }
        var btn = e.target.closest('[data-action]');
        if (!btn) return;
        if (btn.dataset.action === 'all') { selectAllTags(); }
        else if (btn.dataset.action === 'none') { deselectAllTags(); }
        else if (btn.dataset.action === 'toggle-all') { sourceTagShowAll = !sourceTagShowAll; rebuildTagChips(); }
    });
    chipsEl.addEventListener('dblclick', function(e) {
        var chip = e.target.closest('.source-tag-chip');
        if (chip && chip.dataset.tag) {
            /* Cancel the pending single-click toggle — this is a solo action. */
            clearTimeout(chipClickTimer);
            chipClickTimer = null;
            soloSourceTag(chip.dataset.tag);
        }
    });
})();

/** Reset all source tag state. Called on clear. */
function resetSourceTags() {
    sourceTagCounts = {};
    hiddenSourceTags = {};
    savedHiddenSourceTags = null;
    soloedSourceTag = null;
    /* Hide the tab button when tags are cleared */
    var tab = document.getElementById('filter-tab-log-tags');
    if (tab) { tab.style.display = 'none'; }
    var container = document.getElementById('source-tag-chips');
    if (container) { container.innerHTML = ''; }
    updateTagSummary();
    if (typeof updateSqlToolbarButton === 'function') updateSqlToolbarButton();
}

/**
 * Solo a source tag: show only lines with this tag, hiding everything else.
 * Double-tap the same tag again to restore the filter state from before the solo.
 */
function soloSourceTag(tag) {
    if (soloedSourceTag === tag && savedHiddenSourceTags !== null) {
        /* Already solo'd on this tag — restore the previous filter state. */
        hiddenSourceTags = savedHiddenSourceTags;
        savedHiddenSourceTags = null;
        soloedSourceTag = null;
    } else {
        /* Save current state so a second double-tap can restore it. */
        savedHiddenSourceTags = Object.assign({}, hiddenSourceTags);
        soloedSourceTag = tag;
        hiddenSourceTags = {};
        var keys = Object.keys(sourceTagCounts);
        for (var i = 0; i < keys.length; i++) {
            if (keys[i] !== tag) hiddenSourceTags[keys[i]] = true;
        }
    }
    applySourceTagFilter();
    rebuildTagChips();
    if (typeof markPresetDirty === 'function') { markPresetDirty(); }
}

var tagPalette = ['#4ec9b0','#ce9178','#e0a370','#9cdcfe','#c586c0','#d7ba7d','#b5cea8','#569cd6'];
function tagColor(tag) {
    var h = 0;
    for (var i = 0; i < tag.length; i++) h = ((h << 5) - h + tag.charCodeAt(i)) | 0;
    return tagPalette[Math.abs(h) % tagPalette.length];
}

/** Wrap the first occurrence of the source tag in HTML with a clickable span. */
function wrapTagLink(html, sourceTag) {
    if (!sourceTag || sourceTag === otherKey) return html;
    var color = tagColor(sourceTag);
    var wrapped = false;
    return html.replace(/(<[^>]*>)|([^<]+)/g, function(m, tag, text) {
        if (tag || wrapped) return m;
        var lower = text.toLowerCase();
        var idx = lower.indexOf(sourceTag);
        if (idx < 0) return text;
        wrapped = true;
        var orig = text.substring(idx, idx + sourceTag.length);
        var safe = orig.replace(/"/g, '&quot;');
        return text.substring(0, idx)
            + '<span class="tag-link" data-tag="' + sourceTag + '" title="Click to filter: ' + safe + '" style="--tag-clr:' + color + '">' + orig + '</span>'
            + text.substring(idx + sourceTag.length);
    });
}

/* Click handler for inline tag links in rendered log lines. */
(function() {
    var vp = document.getElementById('viewport');
    if (!vp) return;
    vp.addEventListener('click', function(e) {
        var tagEl = e.target.closest('.tag-link');
        if (tagEl && tagEl.dataset.tag) {
            e.preventDefault();
            e.stopPropagation();
            soloSourceTag(tagEl.dataset.tag);
        }
    });
})();
`;
}
//# sourceMappingURL=viewer-source-tags-ui.js.map