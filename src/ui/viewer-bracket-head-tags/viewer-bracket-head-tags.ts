/**
 * Bracket head-tag parsing for generic tag rendering (all tags in TAG_LEVEL_MAP).
 *
 * Parses any [bracket] tags from a log line (e.g. [db], [perf], [frame-stall], [retry])
 * and stores them for rendering as chips in the tag column. Unlike sourceTag (single),
 * headTags is an array that captures all bracket tags found at line start.
 */

export function getHeadTagsParserScript(): string {
    return /* javascript */ `
/* Parse all bracket head tags from a log line, returning array of { name, level }.
   Handles optional logcat/threadtime/[log] shells before the first app-emitted tag.
   TAG_LEVEL_MAP is injected by viewer-level-classify.ts. Returns empty array if none found. */
function parseHeadTags(plain) {
    if (!plain || typeof TAG_LEVEL_MAP === 'undefined') return [];

    /* Strip optional logcat/threadtime/[log] shells to find app-emitted tags.
       Match zero or one occurrence of: V/tag:, logcat threadtime, or [log] wrapper. */
    var stripped = plain
        .replace(/^[VDIWEFA]\\/[^:]*:\\s*/, '')
        .replace(/^\\d{2}-\\d{2}\\s+\\d{2}:\\d{2}:\\d{2}\\.\\d{3}\\s+\\d+\\s+\\d+\\s+[VDIWEFA]\\s+[^:]*:\\s*/, '')
        .replace(/^\\[log\\]\\s*/, '');

    var tags = [];
    var remaining = stripped;
    var maxTags = 10; // safety limit to avoid runaway parsing

    while (remaining && maxTags > 0) {
        var m = /^\\[([^\\]]+)\\]\\s*/.exec(remaining);
        if (!m) break;

        var rawTag = m[1];
        var tagName = rawTag.indexOf(':') === -1 ? rawTag : rawTag.slice(0, rawTag.indexOf(':'));
        tagName = tagName.trim().toLowerCase();

        var level = TAG_LEVEL_MAP[tagName] || null;
        if (level) {
            tags.push({ name: rawTag, level: level });
        } else {
            /* Unrecognized tag — stop here so we don't consume random [brackets] in the message. */
            break;
        }

        remaining = remaining.slice(m[0].length);
        maxTags--;
    }

    return tags;
}

/* HTML escaper for tag names. */
function escapeHeadTag(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* Render one head tag as a chip. Reuses tag column styling from sourceTag chips. */
function renderHeadTagChip(tag) {
    if (!tag || !tag.name) return '';
    var levelCls = 'tag-level-' + (tag.level || 'info');
    var body = escapeHeadTag(tag.name);
    return '<span class="tag-chip ' + levelCls + '">' + body + '</span>';
}

/* Render all head tags as a sequence of chips (spacing via CSS margin-right). */
function renderHeadTagChips(tags) {
    if (!tags || tags.length === 0) return '';
    return tags.map(function(t) { return renderHeadTagChip(t); }).join('');
}

/* Build the fixed-width head-tag CELL for the decoration grid: the first tag as
   a chip, then a +N badge when more tags follow. The column is a shared fixed
   width (viewer-styles-columns.ts) so it cannot stretch per row — collapsing the
   overflow to +N is what keeps the message aligned. Returns { html, title }; the
   title lists every tag in full so +N (and any ellipsis-clipped name) is always
   recoverable on hover, applied to the whole cell by getDecorationCells. */
function renderHeadTagCell(tags) {
    if (!tags || tags.length === 0) return { html: '', title: '' };
    var html = renderHeadTagChip(tags[0]);
    var extra = tags.length - 1;
    if (extra > 0) {
        /* Neutral +N badge (tag-chip-more) — it counts, it is not itself a level. */
        html += '<span class="tag-chip tag-chip-more">+' + extra + '</span>';
    }
    /* Full list for the cell tooltip, in emission order. escapeHeadTag guards
       the attacker-controlled tag text before it lands in a title attribute. */
    var names = tags.map(function(t) { return escapeHeadTag(t.name); }).join(' ');
    return { html: html, title: names };
}
`;
}
