/**
 * Group-toggle click handling (stack headers, stack-owner rows, Flutter
 * banners, continuation badges, Trouble Mode row-open) for the log viewer
 * webview. Extracted from viewer-script-click-handlers.ts to keep both
 * files under the line limit — see viewer-script-click-handlers.ts for the
 * rest of the click dispatch chain this is called from.
 */

export function getViewerClickHandlerGroupsScript(): string {
    return /* javascript */ `
function handleGroupToggleClicks(e) {
    var header = e.target.closest('.stack-header');
    if (header && header.dataset.gid !== undefined) {
        /* If the click landed on the .deco-counter-row (line number + chevron)
           the dedicated handleCounterRowClick in viewer-peek-chevron.ts has
           ALREADY called toggleStackGroup for this event. Firing again here
           would re-toggle and the user would see no net change — exactly the
           "clicking the chevron does nothing" bug reported when stack-headers
           started rendering their own counter-row. The check uses closest()
           so a click on either the .deco-counter or .deco-chevron child still
           counts as a counter-row click. */
        if (e.target.closest('.deco-counter-row[data-affordance-kind]')) {
            return true;
        }
        var _gid = parseInt(header.dataset.gid);
        var _hdr = groupHeaderMap[_gid];
        /* 1-frame stacks (header only, no child frames) have nothing to
         * expand/collapse — skip toggle so clicks fall through harmlessly.
         * frameCount includes the header itself, so >1 means children exist. */
        if (_hdr && _hdr.frameCount > 1) {
            toggleStackGroup(_gid);
            return true;
        }
    }
    /* "The message IS the toggle": a log line promoted to its trace's stack owner
       (viewer-data-add-stack-ingest.ts, item._stackOwner) collapses/expands its
       frames on a whole-row click — same affordance as a .stack-header row, but
       the owner renders through the normal .line path so it has no data-gid attr;
       resolve it via data-idx → allLines. Skip when the click is on the counter
       chevron (the peek listener already toggled it) or on a source/url link
       (handled above), and guard on a collapsed selection so drag-to-select the
       message text is not hijacked into a toggle. */
    var ownerRow = e.target.closest('.line[data-idx]');
    if (ownerRow && !e.target.closest('.deco-counter-row[data-affordance-kind]')) {
        var _oidx = parseInt(ownerRow.dataset.idx, 10);
        var _oit = (!isNaN(_oidx) && allLines[_oidx]) ? allLines[_oidx] : null;
        if (_oit && _oit._stackOwner && _oit.frameCount > 1 && typeof toggleStackGroup === 'function') {
            var _osel = (typeof window !== 'undefined' && window.getSelection) ? window.getSelection() : null;
            if (!_osel || _osel.isCollapsed) {
                toggleStackGroup(_oit.groupId);
                return true;
            }
        }
    }
    /* Flutter exception banner header: whole-row click collapses/expands the block
       (same "the message IS the toggle" affordance as a stack owner). The header
       renders through the normal .line path with banner-group-start, so resolve the
       item via data-idx. Guard on a collapsed selection so drag-to-select the header
       text is not hijacked into a toggle. */
    var bannerRow = e.target.closest('.line[data-idx].banner-group-start');
    if (bannerRow && typeof toggleFlutterBanner === 'function') {
        var _bIdx = parseInt(bannerRow.dataset.idx, 10);
        var _bItem = (!isNaN(_bIdx) && allLines[_bIdx]) ? allLines[_bIdx] : null;
        if (_bItem && _bItem.bannerRole === 'header' && _bItem.bannerGroupId >= 0) {
            var _bSel = (typeof window !== 'undefined' && window.getSelection) ? window.getSelection() : null;
            if (!_bSel || _bSel.isCollapsed) {
                toggleFlutterBanner(_bItem.bannerGroupId);
                return true;
            }
        }
    }
    var contBadge = e.target.closest('.cont-badge');
    if (contBadge && contBadge.dataset.contGid !== undefined && typeof toggleContinuationGroup === 'function') {
        toggleContinuationGroup(parseInt(contBadge.dataset.contGid));
        return true;
    }
    /* Trouble Mode (Stage 4): a plain click on a feed row opens the detail pane.
       Runs LAST so every interactive sub-element above (links, badges, toggles)
       keeps its own behavior; guarded on a collapsed selection so drag-to-select
       is never hijacked, and only while the mode is active. */
    if (typeof troubleModeActive !== 'undefined' && troubleModeActive && typeof openTroubleDetailForItem === 'function') {
        var tRow = e.target.closest('.line[data-idx]');
        if (tRow) {
            var _tSel = (typeof window !== 'undefined' && window.getSelection) ? window.getSelection() : null;
            if (!_tSel || _tSel.isCollapsed) {
                var _tIdx = parseInt(tRow.dataset.idx, 10);
                var _tItem = (!isNaN(_tIdx) && allLines[_tIdx]) ? allLines[_tIdx] : null;
                if (_tItem && _tItem.type === 'line') {
                    openTroubleDetailForItem(_tItem);
                    return true;
                }
            }
        }
    }
    return false;
}
`;
}
