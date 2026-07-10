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

    /* Strip optional saved-log/logcat/threadtime/[log] shells to find app-emitted tags.
       Match zero or one occurrence of each: the saved-log "[HH:MM:SS.mmm] [source]"
       wrapper (log-session-helpers.ts's formatLine() always writes both brackets
       together when a captured line is saved to a .log file — source is an
       unrestricted string, so this is recognized by its fixed timestamp shape, then
       unconditionally consumes the very next bracket as the source label; without
       this, re-opening a saved log left every app-emitted tag unrecognized because
       the FIRST bracket seen was the timestamp, not the tag, 2026-07-10), then
       V/tag:, logcat threadtime, or [log] wrapper. */
    var stripped = plain
        .replace(/^\\[\\d{2}:\\d{2}:\\d{2}\\.\\d{3}\\]\\s*\\[[^\\]]+\\]\\s*/, '')
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
        var colonIdx = rawTag.indexOf(':');
        var tagName = (colonIdx === -1 ? rawTag : rawTag.slice(0, colonIdx)).trim().toLowerCase();

        var level = TAG_LEVEL_MAP[tagName] || null;
        if (level) {
            /* Display name excludes any :metadata suffix (case preserved for
               formatTagLabel's Title Case pass) — the metadata stays visible inline in
               the message text below the chip, so repeating it in the chip's own label
               produced a garbled "Perf:cold Start" once tags started running through
               formatTagLabel (2026-07-10). */
            var displayName = colonIdx === -1 ? rawTag : rawTag.slice(0, colonIdx).trim();
            tags.push({ name: displayName, level: level });
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

/* Strip one or more trailing "[...]" groups appended directly after a tag name, e.g.
   "TelecomRegistra[000:619][25918]" -> "TelecomRegistra". Some GmsCore/Clearcut
   components append a per-line sequence/thread-id tuple straight onto their own tag
   with no delimiter — that suffix increments on every line, so leaving it in would
   make the "collapse qualified tag" dedup below useless (every line would look like a
   distinct tag) and reads as noise, never a real name. Only trailing bracket groups are
   stripped — a bracket elsewhere in the name (there is none in practice) is left alone. */
function stripTagBracketSuffix(name) {
    return String(name == null ? '' : name).replace(/(?:\\[[^\\]]*\\])+$/, '');
}

/* Collapse a deeply-dotted, package-qualified tag (Java/Android reverse-domain class
   names like "com.google.android.libraries.foo.bar.ChatService", or log4j logger names)
   to its last segment. Two or more dots reliably means a fully-qualified class name,
   not a short hand-picked tag — the only known 1-dot tag in this codebase is
   "system.err" (parseSourceTag's genericTags), so a 2-dot threshold never touches it.
   Without this, every distinct class in one Java package produced its own
   near-unreadable chip sharing a 60+ char common prefix. Case is preserved so the
   result still flows through formatTagLabel's camelCase splitter correctly.
   Shared by viewer-data-add.ts (applied to slp.tag/sTag/lTag at parse time so the
   Message Tags sidebar, the row chips, and item.sourceTag/logcatTag all agree). */
function collapseQualifiedTag(name) {
    var s = String(name == null ? '' : name);
    var dotCount = (s.match(/\\./g) || []).length;
    if (dotCount < 2) return s;
    var segs = s.split('.');
    return segs[segs.length - 1] || s;
}

/* Convert a raw tag identifier (camelCase class name like "ActivityManager", a
   dotted/underscored/hyphenated token, or a plain lowercase word) into a
   "Title Case With Spaces" display label. Acronym runs (JNI, HWUI, SQL) are kept
   upper-case rather than title-cased — blindly capitalizing-first/lowercasing-rest
   would turn "HWUI" into "Hwui". Used for BOTH the row tag-column chips and the
   Message Tags sidebar chips so a tag reads identically in both places. */
function formatTagLabel(name) {
    if (!name) return '';
    var s = String(name);
    // camelCase boundaries: lower/digit -> Upper, and Acronym -> Capitalized (HTTPRequest -> HTTP Request).
    s = s.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
    s = s.replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
    // Normalize dot/underscore/hyphen separators to spaces.
    s = s.replace(/[._-]+/g, ' ').replace(/\\s+/g, ' ').trim();
    if (!s) return '';
    return s.split(' ').map(function(word) {
        if (!word) return word;
        if (word.length > 1 && word === word.toUpperCase() && /[A-Z]/.test(word)) return word;
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    }).join(' ');
}

/* Render one line tag as a chip. Tags are {name, key, level} — the unified set
   built in addToData (bracket head tags + device/logcat/source tags). data-tag-chip
   carries the filter key so a click opens the Message Tags sidebar for that tag
   (viewer-source-tags-ui); the chip is not itself an inline filter toggle. */
function renderHeadTagChip(tag) {
    if (!tag || !tag.name) return '';
    var levelCls = 'tag-level-' + (tag.level || 'info');
    var key = (tag.key || String(tag.name).split(':')[0].trim().toLowerCase());
    var body = escapeHeadTag(formatTagLabel(tag.name));
    return '<span class="tag-chip ' + levelCls + '" data-tag-chip="' + escapeHeadTag(key) + '">' + body + '</span>';
}

/* Render the line's PRIMARY tag — the first entry in tags[], already the
   highest-priority signal (buildUnifiedLineTags pushes bracket head tags before the
   structured/logcat/source tag, so an app-emitted [db]/[perf] wins over a generic
   device tag on the same line) — plus a neutral "+N" badge when the line carries
   more. Rendering every tag as its own chip cluttered the fixed-width tag column
   and, on lines carrying 2-3 tags, visibly squeezed the message text down to a
   sliver (user report 2026-07-10); showing +N with no count then hid that the
   extra tags existed at all. Every tag is still fully filterable from the Message
   Tags sidebar (item.tags is unchanged) and still listed in full on the cell's
   hover tooltip (headTagsTitle below). Revives the +N pattern from commit 7ff07c3b
   (renderHeadTagCell), simplified back into this function since the caller already
   applies headTagsTitle as the cell's own tooltip separately. */
function renderHeadTagChips(tags) {
    if (!tags || tags.length === 0) return '';
    var html = renderHeadTagChip(tags[0]);
    var extra = tags.length - 1;
    if (extra > 0) {
        html += '<span class="tag-chip tag-chip-more">+' + extra + '</span>';
    }
    return html;
}

/* Space-separated list of every tag name (not just the one rendered chip), escaped,
   for the tag cell's title tooltip — the only place a line's SECOND/THIRD tag is
   visible now that only the primary tag renders as a chip. escapeHeadTag guards the
   attacker-controlled tag text before the title attr. */
function headTagsTitle(tags) {
    if (!tags || tags.length === 0) return '';
    return tags.map(function(t) { return escapeHeadTag(formatTagLabel(t.name)); }).join(' ');
}
`;
}
