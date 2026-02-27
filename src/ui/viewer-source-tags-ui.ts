/** Returns the JavaScript for source tag UI rendering: chips, tag links, and palette. */
export function getSourceTagUiScript(): string {
    return /* javascript */ `
function escapeTagHtml(text) {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function rebuildTagChips() {
    var container = document.getElementById('source-tag-chips');
    if (!container) { return; }
    var keys = Object.keys(sourceTagCounts);
    keys.sort(function(a, b) { return sourceTagCounts[b] - sourceTagCounts[a]; });
    var limit = sourceTagShowAll ? keys.length : Math.min(keys.length, sourceTagMaxChips);
    var parts = [
        '<span class="source-tag-actions">'
        + '<button class="tag-action-btn" data-action="all">All</button>'
        + '<button class="tag-action-btn" data-action="none">None</button>'
        + '</span>'
    ];
    for (var i = 0; i < limit; i++) {
        var key = keys[i];
        var label = key === otherKey ? '(Other)' : escapeTagHtml(key);
        var active = !hiddenSourceTags[key];
        var cls = 'source-tag-chip' + (active ? ' active' : '');
        parts.push(
            '<button class="' + cls + '" data-tag="' + escapeTagHtml(key) + '">'
            + '<span class="tag-label">' + label + '</span>'
            + '<span class="tag-count">' + sourceTagCounts[key] + '</span></button>'
        );
    }
    if (keys.length > sourceTagMaxChips) {
        var showLabel = sourceTagShowAll ? 'Show less' : 'Show all (' + keys.length + ')';
        parts.push('<button class="tag-show-all-btn" data-action="toggle-all">' + showLabel + '</button>');
    }
    container.innerHTML = parts.join('');
    updateTagSummary();
}

/* Event delegation for chip clicks — avoids inline onclick escaping issues. */
(function() {
    var chipsEl = document.getElementById('source-tag-chips');
    if (!chipsEl) { return; }
    chipsEl.addEventListener('click', function(e) {
        var chip = e.target.closest('.source-tag-chip');
        if (chip && chip.dataset.tag) { toggleSourceTag(chip.dataset.tag); return; }
        var btn = e.target.closest('[data-action]');
        if (!btn) return;
        if (btn.dataset.action === 'all') { selectAllTags(); }
        else if (btn.dataset.action === 'none') { deselectAllTags(); }
        else if (btn.dataset.action === 'toggle-all') { sourceTagShowAll = !sourceTagShowAll; rebuildTagChips(); }
    });
})();

/** Reset all source tag state. Called on clear. */
function resetSourceTags() {
    sourceTagCounts = {};
    hiddenSourceTags = {};
    var section = document.getElementById('log-tags-section');
    if (section) { section.style.display = 'none'; }
    var container = document.getElementById('source-tag-chips');
    if (container) { container.innerHTML = ''; }
    updateTagSummary();
}

/** Solo a tag: show only lines with this tag. Click again to clear. */
function soloSourceTag(tag) {
    var keys = Object.keys(sourceTagCounts);
    var hiddenCount = Object.keys(hiddenSourceTags).length;
    var isSolo = hiddenCount === keys.length - 1 && !hiddenSourceTags[tag];
    if (isSolo) {
        hiddenSourceTags = {};
    } else {
        hiddenSourceTags = {};
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
