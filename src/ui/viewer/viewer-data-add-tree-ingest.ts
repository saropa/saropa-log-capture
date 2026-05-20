/**
 * Embedded JavaScript for collapsing Flutter's render-tree descendant dumps.
 *
 * When a layout exception fires, Flutter appends a verbose indented tree:
 *
 *     This RenderObject had the following descendants (showing up to depth 5):
 *         child: RenderShrinkWrappingViewport#d51de relayoutBoundary=up14 …
 *           child 0: RenderSliverToBoxAdapter#81055 …
 *             child: RenderConstrainedBox#961aa …
 *           child 1: RenderMultiSliver#d4f50 …
 *         child 2: RenderSliverPadding#2bb8f …
 *
 * That block is 20-40 rows of low-signal detail repeated for every frame the
 * broken layout retries — it buries the actual error. There was no handling for
 * it: the rows rendered as plain lines, uncollapsible.
 *
 * This module recognizes the dump header and folds the indented `child…` rows
 * beneath it into a collapsible group, REUSING the stack-group machinery
 * (`stack-header` + `stack-frame` item types) so the existing chevron, toggle
 * (toggleStackGroup), preview mode, and height/visibility calc all apply with
 * zero new render code. The `treeGroup` flag only re-words the header tooltip
 * (renderStackHeader) so it reads "Render tree" not "Stack trace".
 *
 * WHY a separate state var (`activeTreeHeader`) instead of the shared
 * `activeGroupHeader`: stack dedup (finalizeStackGroup) hides identical groups —
 * desirable for traces, surprising for a tree the user expanded. Owning the
 * lifecycle here means the tree is collapse-only, never silently deduped, and
 * the stack async-gap / trace-tail logic can never absorb a tree row.
 *
 * Ordering: tryIngestTreeLine() runs AFTER tryIngestStackLine() and consumes
 * tree rows before the Flutter-banner classifier, so — exactly like stack
 * frames inside a banner — tree rows form their own group and are not tagged
 * with bannerGroupId. They inherit level 'error' from the preceding banner line
 * (previousLineLevel) so the Errors filter keeps them with their incident.
 */

/** Get the embedded JavaScript for render-tree descendant folding. */
export function getTreeIngestScript(): string {
    return /* javascript */ `
/* ── Flutter render-tree descendant folding ──────────────────────── */

/* Active descendant-tree group, or null. Separate from activeGroupHeader so
   stack dedup / async-gap logic never touches a tree (see module doc). */
var activeTreeHeader = null;

/* Header: 'This RenderObject had the following descendants (showing up to depth N):'.
   The phrase is unique to Flutter render-tree dumps, so it needs no box-rule guard. */
var treeHeaderRe = /following descendants\\b/i;
/* Child node: leading indent + 'child' (optionally ' N' / ' with index N') + ':'.
   Every row of the dump is a child at some depth; the first non-child row
   (the banner's closing ═ rule) ends the group. The optional leading group
   tolerates a logcat prefix ('I/flutter ( 4323): ') because this detector runs
   before the structured-prefix strip — without it the I/flutter copy of the
   tree (stdout) would slip through while the console copy grouped. The required
   whitespace before 'child' is what separates a real tree row from prose that
   merely contains the word. */
var treeChildRe = /^(?:[a-z]\\/\\S+\\s*\\(\\s*\\d+\\)\\s*:)?\\s+child\\b/i;

/** True if plain text opens a descendant-tree dump. */
function isTreeHeaderText(plainText) { return treeHeaderRe.test(plainText); }
/** True if plain text is an indented child node of a descendant tree. */
function isTreeChildText(plainText) { return treeChildRe.test(plainText); }

/** Start a new tree group; push its clickable header row. Returns the header. */
function beginTreeGroup(html, rawText, category, ts, qualityPercent, lineSource, lineTier, catFiltered) {
    var gid = nextGroupId++;
    var lvl = (typeof previousLineLevel === 'function') ? previousLineLevel() : 'error';
    var lvlFiltered = (typeof calcLevelFiltered === 'function') ? calcLevelFiltered(lvl) : false;
    var hdrH = (catFiltered || lvlFiltered) ? 0 : ROW_HEIGHT;
    var sds = (typeof stackDefaultState !== 'undefined') ? stackDefaultState : true;
    var spc = (typeof stackPreviewCount !== 'undefined') ? stackPreviewCount : 3;
    /* treeGroup re-words the header tooltip; fw:false so the rows count as app
       content (preview-mode appIdx ignores fw:true rows) and stay visible under
       the Flutter DAP source radio. _appFrameCount starts at 1: the header is
       app-row 0, the first child becomes appIdx 1 — same convention as stacks.
       category MUST be carried: applyFilter() recomputes filteredOut from
       item.category on every category toggle, so an undefined category would
       hide the whole tree the moment any category filter is touched. */
    var hdr = { html: html, rawText: rawText || null, type: 'stack-header', treeGroup: true, height: hdrH, category: category, groupId: gid, frameCount: 1, collapsed: sds, previewCount: spc, timestamp: ts, fw: false, tier: lineTier, level: lvl, seq: nextSeq++, sourceTag: null, logcatTag: null, filteredOut: catFiltered, sourceFiltered: false, classFiltered: false, classTags: [], _appFrameCount: 1, scopeFiltered: false, autoHidden: false, qualityPercent: qualityPercent, source: lineSource, levelFiltered: lvlFiltered };
    allLines.push(hdr);
    groupHeaderMap[gid] = hdr;
    totalHeight += hdrH;
    activeTreeHeader = hdr;
    return hdr;
}

/** Append an indented child row to the active tree group as a stack-frame. */
function appendTreeChild(html, rawText, category, ts, qualityPercent, lineSource, lineTier, catFiltered) {
    var h = activeTreeHeader;
    var appIdx = h._appFrameCount;
    h._appFrameCount++;
    /* Indent is NOT stripped (unlike stack frames): the leading whitespace IS
       the tree hierarchy. .line white-space:pre-wrap preserves it on render.
       height:0 — recalcHeights computes the real height from header.collapsed.
       category carried for the same reason as the header (applyFilter reapply). */
    var child = { html: html, rawText: rawText || null, type: 'stack-frame', height: 0, category: category, groupId: h.groupId, timestamp: ts, fw: false, tier: lineTier, level: h.level, sourceTag: null, logcatTag: null, filteredOut: catFiltered, sourceFiltered: false, classFiltered: false, classTags: [], _appFrameIdx: appIdx, scopeFiltered: false, autoHidden: false, qualityPercent: qualityPercent, source: lineSource, levelFiltered: h.levelFiltered };
    allLines.push(child);
    h.frameCount++;
}

/** Try to ingest \`html\` as a render-tree header or child. Returns true if consumed.
    Signature mirrors tryIngestStackLine so addToData calls both identically. */
function tryIngestTreeLine(html, rawText, category, ts, fw, sp, elapsedMs, qualityPercent, lineSource, lineTier, catFiltered) {
    var plain = stripTags(html);
    if (activeTreeHeader && isTreeChildText(plain)) {
        appendTreeChild(html, rawText, category, ts, qualityPercent, lineSource, lineTier, catFiltered);
        return true;
    }
    if (isTreeHeaderText(plain)) {
        beginTreeGroup(html, rawText, category, ts, qualityPercent, lineSource, lineTier, catFiltered);
        return true;
    }
    /* Any other line ends the dump — release the group and let addToData handle
       this line normally (e.g. the banner's closing ═ rule → footer role). */
    activeTreeHeader = null;
    return false;
}

/** Reset tree state (called on clear / new session / trim / marker boundary). */
function resetTreeDetector() { activeTreeHeader = null; }
`;
}
