/**
 * Bookmark panel HTML and script for the webview.
 *
 * Displays bookmarked log lines grouped by file with search filtering.
 * Follows the same slide-out pattern as the session and find panels.
 */

/** Generate the bookmark panel HTML. */
export function getBookmarkPanelHtml(): string {
    return /* html */ `
<div id="bookmark-panel" class="bookmark-panel">
    <div class="bookmark-panel-header">
        <span>Bookmarks</span>
        <div class="bookmark-panel-actions">
            <button id="bookmark-delete-all" class="bookmark-panel-action" title="Delete All Bookmarks">
                <span class="codicon codicon-clear-all"></span>
            </button>
            <button id="bookmark-panel-close" class="bookmark-panel-close" title="Close">&times;</button>
        </div>
    </div>
    <div class="bookmark-panel-content" style="display:flex;flex-direction:column;flex:1;min-height:0;">
        <div class="bookmark-input-wrapper">
            <input id="bookmark-filter-input" type="text" placeholder="Filter bookmarks..." />
        </div>
        <div id="bookmark-list" class="bookmark-list"></div>
        <div id="bookmark-empty" class="bookmark-empty">No bookmarks yet.\nRight-click a line to bookmark it.</div>
    </div>
</div>`;
}

/** Generate the bookmark panel script. */
export function getBookmarkPanelScript(): string {
    return /* js */ `
(function() {
    var bookmarkPanelEl = document.getElementById('bookmark-panel');
    var bookmarkFilterEl = document.getElementById('bookmark-filter-input');
    var bookmarkListEl = document.getElementById('bookmark-list');
    var bookmarkEmptyEl = document.getElementById('bookmark-empty');
    var bookmarkPanelOpen = false;
    var cachedData = null;

    window.openBookmarkPanel = function() {
        if (!bookmarkPanelEl) return;
        bookmarkPanelOpen = true;
        bookmarkPanelEl.classList.add('visible');
        vscodeApi.postMessage({ type: 'requestBookmarks' });
        if (bookmarkFilterEl) bookmarkFilterEl.focus();
    };

    window.closeBookmarkPanel = function() {
        if (!bookmarkPanelEl) return;
        bookmarkPanelEl.classList.remove('visible');
        bookmarkPanelOpen = false;
        if (typeof clearActivePanel === 'function') clearActivePanel('bookmarks');
    };

    function renderBookmarks(data) {
        cachedData = data;
        if (!bookmarkListEl) return;
        var filter = (bookmarkFilterEl ? bookmarkFilterEl.value : '').toLowerCase();
        var keys = Object.keys(data || {});
        if (keys.length === 0) {
            bookmarkListEl.innerHTML = '';
            if (bookmarkEmptyEl) bookmarkEmptyEl.style.display = '';
            return;
        }
        if (bookmarkEmptyEl) bookmarkEmptyEl.style.display = 'none';
        var html = '';
        var hasVisible = false;
        for (var i = 0; i < keys.length; i++) {
            var entry = data[keys[i]];
            var filtered = filterBookmarks(entry.bookmarks, filter);
            if (filtered.length === 0) continue;
            hasVisible = true;
            html += '<div class="bookmark-file-group">'
                + '<div class="bookmark-file-header">'
                + '<span class="codicon codicon-file"></span>'
                + '<span class="bookmark-file-name">' + escapeHtml(entry.filename) + '</span>'
                + '<span class="bookmark-count-badge">' + filtered.length + '</span>'
                + '<button class="bookmark-file-delete" data-file-uri="' + escapeAttr(entry.fileUri)
                + '" data-filename="' + escapeAttr(entry.filename) + '" title="Delete all for this file">'
                + '<span class="codicon codicon-trash"></span></button>'
                + '</div>';
            for (var j = 0; j < filtered.length; j++) {
                var b = filtered[j];
                var label = 'L' + (b.lineIndex + 1) + ': ' + truncate(b.lineText, 60);
                html += '<div class="bookmark-item" data-file-uri="' + escapeAttr(entry.fileUri)
                    + '" data-line="' + b.lineIndex + '" data-id="' + escapeAttr(b.id) + '">'
                    + '<div class="bookmark-item-main">'
                    + '<span class="codicon codicon-' + (b.note ? 'comment' : 'bookmark') + '"></span>'
                    + '<span class="bookmark-item-label">' + escapeHtml(label) + '</span>'
                    + '</div>'
                    + (b.note ? '<div class="bookmark-item-note">' + escapeHtml(b.note) + '</div>' : '')
                    + '<div class="bookmark-item-actions">'
                    + '<button class="bookmark-action-btn bookmark-edit" title="Edit Note">'
                    + '<span class="codicon codicon-edit"></span></button>'
                    + '<button class="bookmark-action-btn bookmark-delete" title="Delete">'
                    + '<span class="codicon codicon-trash"></span></button>'
                    + '</div></div>';
            }
            html += '</div>';
        }
        bookmarkListEl.innerHTML = html;
        if (!hasVisible && bookmarkEmptyEl) {
            bookmarkEmptyEl.style.display = '';
            bookmarkEmptyEl.textContent = filter ? 'No matching bookmarks' : 'No bookmarks yet.';
        }
    }

    function filterBookmarks(bookmarks, filter) {
        if (!filter) return bookmarks;
        var result = [];
        for (var i = 0; i < bookmarks.length; i++) {
            var b = bookmarks[i];
            if (b.lineText.toLowerCase().indexOf(filter) >= 0 || b.note.toLowerCase().indexOf(filter) >= 0) {
                result.push(b);
            }
        }
        return result;
    }

    function truncate(str, max) {
        return str.length > max ? str.slice(0, max) + '...' : str;
    }

    /* --- Click handlers --- */

    if (bookmarkListEl) {
        bookmarkListEl.addEventListener('click', function(e) {
            var deleteFileBtn = e.target.closest('.bookmark-file-delete');
            if (deleteFileBtn) {
                vscodeApi.postMessage({
                    type: 'deleteFileBookmarks',
                    fileUri: deleteFileBtn.getAttribute('data-file-uri'),
                    filename: deleteFileBtn.getAttribute('data-filename'),
                });
                return;
            }
            var editBtn = e.target.closest('.bookmark-edit');
            if (editBtn) {
                var item = editBtn.closest('.bookmark-item');
                if (item) {
                    var noteEl = item.querySelector('.bookmark-item-note');
                    vscodeApi.postMessage({
                        type: 'editBookmarkNote',
                        fileUri: item.getAttribute('data-file-uri'),
                        bookmarkId: item.getAttribute('data-id'),
                        currentNote: noteEl ? noteEl.textContent : '',
                    });
                }
                return;
            }
            var deleteBtn = e.target.closest('.bookmark-delete');
            if (deleteBtn) {
                var delItem = deleteBtn.closest('.bookmark-item');
                if (delItem) {
                    vscodeApi.postMessage({
                        type: 'deleteBookmark',
                        fileUri: delItem.getAttribute('data-file-uri'),
                        bookmarkId: delItem.getAttribute('data-id'),
                    });
                }
                return;
            }
            var bmItem = e.target.closest('.bookmark-item');
            if (bmItem) {
                vscodeApi.postMessage({
                    type: 'openBookmark',
                    fileUri: bmItem.getAttribute('data-file-uri'),
                    lineIndex: parseInt(bmItem.getAttribute('data-line') || '0', 10),
                });
            }
        });
    }

    /* --- Delete all --- */

    var deleteAllBtn = document.getElementById('bookmark-delete-all');
    if (deleteAllBtn) deleteAllBtn.addEventListener('click', function() {
        vscodeApi.postMessage({ type: 'deleteAllBookmarks' });
    });

    /* --- Filter input --- */

    if (bookmarkFilterEl) {
        bookmarkFilterEl.addEventListener('input', function() { if (cachedData) renderBookmarks(cachedData); });
        bookmarkFilterEl.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') { e.preventDefault(); closeBookmarkPanel(); }
        });
    }

    /* --- Close / outside click --- */

    var closeBtn = document.getElementById('bookmark-panel-close');
    if (closeBtn) closeBtn.addEventListener('click', closeBookmarkPanel);

    bookmarkPanelEl.addEventListener('click', function(e) { e.stopPropagation(); });

    document.addEventListener('click', function(e) {
        if (!bookmarkPanelOpen) return;
        if (bookmarkPanelEl && bookmarkPanelEl.contains(e.target)) return;
        var ibBtn = document.getElementById('ib-bookmarks');
        if (ibBtn && (ibBtn === e.target || ibBtn.contains(e.target))) return;
        closeBookmarkPanel();
    });

    /* --- Message listener --- */

    window.addEventListener('message', function(e) {
        if (!e.data) return;
        if (e.data.type === 'bookmarkList') {
            renderBookmarks(e.data.files);
        }
    });

    /* --- Helpers --- */

    function escapeAttr(str) { return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;'); }
    function escapeHtml(str) { return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
})();
`;
}
