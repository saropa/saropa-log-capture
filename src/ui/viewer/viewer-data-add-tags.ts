/**
 * Per-line tag normalization for addToData(): cleans a parsed tag (bracket-suffix
 * strip + qualified-name collapse, see viewer-bracket-head-tags.ts's
 * collapseQualifiedTag/stripTagBracketSuffix) and builds the unified item.tags set
 * from bracket head tags + the structured/logcat/source tag.
 *
 * Split out of viewer-data-add.ts to keep that file under the project's line-count
 * limit (2026-07-10) — purely a lift-and-shift, no behavior change.
 */
export function getViewerDataAddTagsScript(): string {
    return /* javascript */ `
/** Strip a per-line bracket counter suffix, then collapse a dotted package path to
    its last (class-name) segment. Applied to slp.tag/sTag/lTag right at the parse
    boundary so every downstream reader (item.parsedTag, the divider label, the
    tag-column chip, the Message Tags sidebar) sees the same short name. */
function cleanParsedTag(raw) {
    if (!raw) { return raw; }
    var cleaned = (typeof stripTagBracketSuffix === 'function') ? stripTagBracketSuffix(raw) : raw;
    return (typeof collapseQualifiedTag === 'function') ? collapseQualifiedTag(cleaned) : cleaned;
}

/* ONE tag set per line. Previously three parsers each owned a slice — bracket head
   tags (chips), the structured device tag (its own column), and the source/logcat
   tag (the Message Tags sidebar) — so the chips and the sidebar showed DIFFERENT
   tags and a chip had no matching filter. The returned array is the single union
   that now drives BOTH the chips (viewer-deco-content) AND the sidebar registry/
   filter (viewer-source-tags). Deduped by lowercase key (name before any :metadata);
   head tags come first so their real level wins over the neutral info level of a
   device/logcat/source tag with the same key.
   raw (per entry): the tag text as it appeared in the log BEFORE bracket-suffix-strip/
   dot-collapse cleanup (falls back to name when a caller has no distinct raw form,
   e.g. bracket head tags) — read by registerSourceTag so "Copy tags as JSON" can list
   every raw variant a cleaned display tag stands for. */
function buildUnifiedLineTags(headTags, slpTag, slpRawTag, lTag, lTagRaw, sTag, sTagRaw) {
    var tagSeen = {};
    var tags = [];
    function addLineTag(name, level, raw) {
        if (!name) { return; }
        var key = String(name).split(':')[0].trim().toLowerCase();
        if (!key || tagSeen[key]) { return; }
        tagSeen[key] = true;
        tags.push({ name: name, key: key, level: level || 'info', raw: (raw != null ? raw : name) });
    }
    for (var hi = 0; hi < headTags.length; hi++) { addLineTag(headTags[hi].name, headTags[hi].level); }
    if (slpTag) { addLineTag(slpTag, 'info', slpRawTag); }
    if (lTag) { addLineTag(lTag, 'info', lTagRaw); }
    if (sTag) { addLineTag(sTag, sTag === 'database' ? 'database' : 'info', sTagRaw); }
    return tags;
}
`;
}
