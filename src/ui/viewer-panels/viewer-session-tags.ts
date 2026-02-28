/**
 * Inline correlation tag chips for the session panel.
 *
 * Collects correlation tags across all sessions and renders them as
 * toggleable chips. Active chips filter the session list to show only
 * sessions containing at least one selected tag.
 */

/** Return JS for the tag chips toggle and filtering logic. */
export function getSessionTagsScript(): string {
    return /* js */ `
(function() {
    var sessionTagSection = document.getElementById('session-tags-section');
    var sessionTagChips = document.getElementById('session-tag-chips');
    /** Tracks deactivated tags: key present and truthy = tag is excluded from filter. */
    var excludedTags = {};
    var tagsExpanded = false;
    var maxVisible = 8;

    /** Keep Tags section closed and button inactive (default when list is built). */
    function ensureTagsSectionClosed() {
        if (sessionTagSection) sessionTagSection.style.display = 'none';
        var btn = document.getElementById('session-filter-tags');
        if (btn) btn.classList.remove('active');
    }

    window.toggleSessionTagsSection = function() {
        if (!sessionTagSection) return;
        var vis = sessionTagSection.style.display !== 'none';
        sessionTagSection.style.display = vis ? 'none' : '';
        var btn = document.getElementById('session-filter-tags');
        if (btn) btn.classList.toggle('active', !vis);
    };

    function tagIcon(tag) {
        if (tag.indexOf('file:') === 0) return '<span class="codicon codicon-file"></span>';
        if (tag.indexOf('error:') === 0) return '<span class="codicon codicon-warning"></span>';
        return '';
    }

    function tagLabel(tag) {
        if (tag.indexOf('file:') === 0) return tag.substring(5);
        if (tag.indexOf('error:') === 0) return tag.substring(6);
        return tag;
    }

    /** Build HTML for a single tag chip button. */
    function buildChipHtml(tag, index, count) {
        var active = !excludedTags[tag] ? ' active' : '';
        var hide = index >= maxVisible && !tagsExpanded ? ' tag-overflow' : '';
        var cnt = '<span class="tag-count">' + count + '</span>';
        return '<button class="source-tag-chip' + active + hide
            + '" data-stag="' + tag + '">' + tagIcon(tag) + '<span class="tag-label">'
            + tagLabel(tag) + '</span>' + cnt + '</button>';
    }

    window.rebuildSessionTagChips = function(sessions) {
        if (!sessionTagChips) return;
        var counts = {};
        for (var i = 0; i < (sessions || []).length; i++) {
            var tags = sessions[i].correlationTags || [];
            for (var j = 0; j < tags.length; j++) {
                counts[tags[j]] = (counts[tags[j]] || 0) + 1;
            }
        }
        var keys = Object.keys(counts).sort(function(a, b) { return (counts[b] || 0) - (counts[a] || 0); });
        if (keys.length === 0) {
            ensureTagsSectionClosed();
            sessionTagChips.innerHTML = '';
            return;
        }
        var html = '<span class="source-tag-actions">'
            + '<button class="tag-action-btn" data-stag-action="all">All</button>'
            + '<button class="tag-action-btn" data-stag-action="none">None</button></span>';
        var max = 20;
        var shown = keys.slice(0, max);
        for (var k = 0; k < shown.length; k++) {
            html += buildChipHtml(shown[k], k, counts[shown[k]]);
        }
        if (shown.length > maxVisible) {
            var extra = shown.length - maxVisible;
            html += '<button class="tag-show-all-btn" data-stag-action="toggle-more">'
                + (tagsExpanded ? 'Show less' : '+' + extra + ' more') + '</button>';
        }
        if (keys.length > max) html += '<span class="tag-count">+' + (keys.length - max) + ' more</span>';
        sessionTagChips.innerHTML = html;
        ensureTagsSectionClosed();
    };

    window.filterSessionsByTags = function(sessions) {
        var anyExcluded = false;
        for (var key in excludedTags) { if (excludedTags[key]) { anyExcluded = true; break; } }
        if (!anyExcluded) return sessions;
        return sessions.filter(function(s) {
            var tags = s.correlationTags || [];
            for (var i = 0; i < tags.length; i++) { if (!excludedTags[tags[i]]) return true; }
            return false;
        });
    };

    if (sessionTagChips) sessionTagChips.addEventListener('click', function(e) {
        e.stopPropagation();
        var chip = e.target.closest('[data-stag]');
        if (chip) {
            var tag = chip.getAttribute('data-stag');
            excludedTags[tag] = !excludedTags[tag];
            if (typeof rerenderSessionList === 'function') rerenderSessionList();
            return;
        }
        var btn = e.target.closest('[data-stag-action]');
        if (!btn) return;
        var action = btn.getAttribute('data-stag-action');
        if (action === 'toggle-more') {
            tagsExpanded = !tagsExpanded;
            if (typeof rerenderSessionList === 'function') rerenderSessionList();
            return;
        }
        var chips = sessionTagChips.querySelectorAll('[data-stag]');
        for (var i = 0; i < chips.length; i++) {
            var t = chips[i].getAttribute('data-stag');
            excludedTags[t] = action === 'none';
        }
        if (typeof rerenderSessionList === 'function') rerenderSessionList();
    });
})();
`;
}
