/**
 * Stack-header repeat detection and collapse for addToData.
 *
 * Mirrors the SQL fingerprint collapse pattern ([viewer-data-add-repeat-collapse.ts]) but
 * for consecutive stack-headers whose top-frame text repeats. Without this, a loop that
 * emits N identical 1-frame traces (e.g. `DriftDebugInterceptor._log` fired per SQL call)
 * produces N separate stack-header rows in the viewer while the surrounding SQL lines
 * collapse via `handleRepeatCollapse` — the visual inconsistency bug_003 fixes.
 *
 * **Walk-back match rule:** when a new stack-header is about to be created, walk backward
 * through `allLines` skipping items that are streak-neutral (markers, run-separators,
 * stack-frames belonging to another group, SQL repeat-notification chips). Stop at the
 * first non-skipped item. Match if it's a stack-header with identical plain-text hash
 * and within `repeatWindowMs`.
 *
 * **No frameCount gate:** earlier draft required `frameCount === 1` on the anchor. Dropped
 * because the motivating Drift case has 2-frame stacks (_log + runSelect) that repeat
 * identically — gating on frameCount would leave them unmerged, reproducing the bug.
 * Tradeoff: two genuinely different traces sharing a top frame within 3s would merge, but
 * the short window + streak-breaking on any real content between them bounds the risk.
 *
 * **Separate tracker:** `stackHdrRepeatTracker` is independent from the line-level
 * `repeatTracker` so SQL and stack-header streaks do not cross-pollute — they typically
 * interleave (SQL line → stack → SQL line → stack) and must count independently.
 */
export function getStackHeaderRepeatScript(): string {
    return /* javascript */ `
var stackHdrRepeatTracker = {
    /* allLines index of the anchor stack-header for the active streak. -1 when no streak. */
    anchorIdx: -1,
    count: 0,
    lastTimestamp: 0,
    /* allLines index of the repeat-notification row created for the active streak. -1
       until the streak reaches threshold and the notification is pushed. */
    lastRepeatNotificationIdx: -1
};

function resetStackHdrRepeatTracker() {
    stackHdrRepeatTracker.anchorIdx = -1;
    stackHdrRepeatTracker.count = 0;
    stackHdrRepeatTracker.lastTimestamp = 0;
    stackHdrRepeatTracker.lastRepeatNotificationIdx = -1;
}

/* Build the HTML for the "N × stack repeated" notification row. Mirrors the SQL variant
   shape (<span class="repeat-notification">) so existing CSS and copy-expansion styling
   apply without new selectors. */
function buildStackHdrRepeatNotificationHtml(count, preview) {
    var previewHtml = (typeof escapeHtml === 'function') ? escapeHtml(preview || '\\u2026') : (preview || '\\u2026');
    return '<span class="repeat-notification">' + count +
        ' \\u00d7 stack repeated: <span class="repeat-preview">' + previewHtml + '</span></span>';
}

/* Walk back from end of allLines to find the most recent stack-header that could be an
   anchor for the current (about-to-be-created) header. Returns its index or -1.

   Hard boundaries that STOP the walk and reject the match:
     - marker: session / save boundary — a post-marker repeat must not fold into the
       pre-marker streak even though cleanupTrailingRepeats already restored the anchor
       and the header text still hashes identically within repeatWindowMs.
     - run-separator: same reasoning — it's a session boundary visual.

   Skipped (streak-neutral) types:
     - stack-frame: belongs to an earlier group, not a peer we compare against.
     - repeat-notification: SQL chips between stack groups are routine and do not count
       as new content breaking the streak.

   Stopping at any other type (line, doc-item, stack-header) returns that index. Caller
   rejects if the stopped-at item is not a stack-header. */
function findPrevStackHeaderForRepeat() {
    for (var i = allLines.length - 1; i >= 0; i--) {
        var it = allLines[i];
        var t = it.type;
        if (t === 'marker' || t === 'run-separator') return -1;
        if (t === 'stack-frame' || t === 'repeat-notification') continue;
        return (t === 'stack-header') ? i : -1;
    }
    return -1;
}

/* Main entry: attempt to absorb a new stack-header into an active or emerging repeat
   streak. Returns true if absorbed (caller must skip its own stack-header push and
   leave activeGroupHeader pointing at the hidden anchor); false otherwise. */
function tryCollapseRepeatStackHeader(html, plainFrame, ts, rawText) {
    var now = ts || Date.now();
    var prevIdx = findPrevStackHeaderForRepeat();
    if (prevIdx < 0) return false;

    var prevHdr = allLines[prevIdx];
    /* Level for hashing: computed via previousLineLevel() — the same inheritance rule
       the stack-header creation path below uses. For a repeat match, the new header
       would inherit the same level as the previous header did (barring intervening
       content that would have broken the streak via resetStackHdrRepeatTracker).
       Hash on plain text (tag-stripped) so HTML color classes injected during rendering
       don't make semantically-identical frames hash differently. */
    var lvl = (typeof previousLineLevel === 'function') ? previousLineLevel() : 'info';
    var newKey = lvl + '::stackhdr::' + plainFrame.substring(0, 200).trim();
    var prevPlain = (typeof stripTags === 'function') ? stripTags(prevHdr.html || '') : String(prevHdr.html || '');
    var prevKey = (prevHdr.level || '') + '::stackhdr::' + prevPlain.substring(0, 200).trim();
    if (newKey !== prevKey) return false;

    /* Repeat window: use the anchor's timestamp for the first repeat, and the last observed
       timestamp on the tracker for subsequent repeats. This keeps long streaks alive as
       long as each call is within 3s of the previous, not of the original anchor. */
    var refTs = (stackHdrRepeatTracker.anchorIdx === prevIdx) ? stackHdrRepeatTracker.lastTimestamp : (prevHdr.timestamp || 0);
    if (!refTs || (now - refTs) >= repeatWindowMs) return false;

    if (stackHdrRepeatTracker.anchorIdx !== prevIdx) {
        /* First repeat for this anchor: hide it, its frames, and initialize the streak.
           Setting collapsed=true on the header makes calcItemHeight return 0 for all
           stack-frame items that point at it, so the anchor's frames also disappear. */
        if (prevHdr.height > 0) totalHeight -= prevHdr.height;
        prevHdr.height = 0;
        prevHdr.repeatHidden = true;
        prevHdr.collapsed = true;
        stackHdrRepeatTracker.anchorIdx = prevIdx;
        stackHdrRepeatTracker.count = 2;
        stackHdrRepeatTracker.lastRepeatNotificationIdx = -1;
    } else {
        stackHdrRepeatTracker.count++;
    }
    stackHdrRepeatTracker.lastTimestamp = now;

    var previewSrc = plainFrame || prevPlain;
    var preview = previewSrc.substring(0, repeatPreviewLength);
    if (previewSrc.length > repeatPreviewLength) preview += '...';
    var notifyHtml = buildStackHdrRepeatNotificationHtml(stackHdrRepeatTracker.count, preview);

    var existingIdx = stackHdrRepeatTracker.lastRepeatNotificationIdx;
    var existing = (existingIdx >= 0 && existingIdx < allLines.length) ? allLines[existingIdx] : null;
    if (existing && existing.type === 'repeat-notification' && existing.stackHdrRepeat) {
        existing.html = notifyHtml;
        existing.timestamp = ts;
    } else {
        /* Inherit filter/visibility state from the anchor so the chip honors the same
           category/level/tier/source filters as the hidden header — otherwise toggling
           filters would leave the chip visible while the anchor it represents is hidden. */
        var repeatLvlFilt = (typeof calcLevelFiltered === 'function') ? calcLevelFiltered(prevHdr.level) : false;
        var repeatTierHidden = (typeof isTierHidden === 'function') ? isTierHidden({ tier: prevHdr.tier, level: prevHdr.level, originalLevel: prevHdr.originalLevel }) : false;
        var visHidden = !!(prevHdr.filteredOut || prevHdr.autoHidden || repeatLvlFilt || repeatTierHidden || prevHdr.scopeFiltered);
        var repeatItem = {
            html: notifyHtml,
            rawText: null,
            type: 'repeat-notification',
            height: visHidden ? 0 : ROW_HEIGHT,
            category: prevHdr.category,
            groupId: -1,
            timestamp: ts,
            level: prevHdr.level,
            seq: nextSeq++,
            sourceTag: prevHdr.sourceTag,
            logcatTag: prevHdr.logcatTag,
            tier: prevHdr.tier,
            filteredOut: !!prevHdr.filteredOut,
            sourceFiltered: false,
            sqlPatternFiltered: false,
            classFiltered: false,
            classTags: prevHdr.classTags || [],
            isSeparator: false,
            sourcePath: prevHdr.sourcePath || null,
            scopeFiltered: !!prevHdr.scopeFiltered,
            isAnr: false,
            autoHidden: !!prevHdr.autoHidden,
            source: prevHdr.source,
            timeRangeFiltered: false,
            levelFiltered: repeatLvlFilt,
            /* Flag differentiates stack-header repeats from SQL fingerprint repeats.
               SQL repeats carry sqlRepeatDrilldown for copy-expansion and drilldown UI;
               stack-header repeats have neither, so existing SQL-specific code paths
               (isExpandableRepeatNotification, drilldown click handlers) naturally skip
               these rows. */
            stackHdrRepeat: true
        };
        if (prevHdr.originalLevel) repeatItem.originalLevel = prevHdr.originalLevel;
        allLines.push(repeatItem);
        stackHdrRepeatTracker.lastRepeatNotificationIdx = allLines.length - 1;
        totalHeight += repeatItem.height;
    }

    /* Point activeGroupHeader at the hidden anchor. Subsequent stack-frames for this
       call enter the inside-group branch and are pushed into the anchor's (hidden) group.
       Their calcItemHeight returns 0 via header.collapsed=true, so they don't render.
       Without this, activeGroupHeader would remain null and the next stack-frame would
       create yet another top-level stack-header, reintroducing the duplication. */
    activeGroupHeader = prevHdr;

    return true;
}
`;
}
