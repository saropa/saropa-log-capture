/**
 * Tests for the head-tag chips that render in the tag decoration column.
 *
 * Only the line's PRIMARY tag (tags[0], the highest-priority signal) renders as a
 * chip in the tag cell (buildDecoParts) — rendering every tag cluttered the
 * fixed-width column and squeezed the message text on lines carrying 2-3 tags
 * (user report 2026-07-10). The full tag list still rides the cell title
 * (headTagsTitle) and is still fully filterable from the Message Tags sidebar.
 * This suite pins the single-chip rendering, the full-list title, and
 * HTML-escaping of hostile tag text.
 */
import * as assert from 'node:assert';
import * as vm from 'node:vm';
import { getHeadTagsParserScript } from '../../ui/viewer-bracket-head-tags/viewer-bracket-head-tags';
import { TAG_LEVEL_MAP } from '../../modules/analysis/tag-level-dictionary';

/** Run the head-tags webview script in a VM and return the named function's string result. */
function run(call: string): string {
    const ctx = vm.createContext({});
    vm.runInContext(getHeadTagsParserScript(), ctx);
    return vm.runInContext(call, ctx) as string;
}

/** Run parseHeadTags in a VM with a real TAG_LEVEL_MAP injected (mirrors how
    viewer-level-classify.ts bakes the map into the webview global scope). */
function runParseHeadTags(plain: string): Array<{ name: string; level: string }> {
    const ctx = vm.createContext({ TAG_LEVEL_MAP });
    vm.runInContext(getHeadTagsParserScript(), ctx);
    return vm.runInContext(`parseHeadTags(${JSON.stringify(plain)})`, ctx) as Array<{ name: string; level: string }>;
}

suite('parseHeadTags — saved-log [time] [source] wrapper tolerance', () => {
    test('recognizes an app tag behind a saved-log [time] [source] wrapper', () => {
        // Real device log line (2026-07-10 report): the wrapper's timestamp bracket used
        // to make the scan give up before ever reaching [IMPORTANT:...].
        const tags = runParseHeadTags(
            '[10:48:41.586] [logcat] 07-10 10:48:42.122 26735 26943 I flutter : '
            + '[IMPORTANT:flutter/shell/platform/android/android_context_vk_impeller.cc(62)] '
            + 'Using the Impeller rendering backend (Vulkan).',
        );
        assert.strictEqual(tags.length, 1);
        assert.strictEqual(tags[0].level, 'notice');
    });

    test('strips the :metadata suffix from the chip display name but keeps the level lookup', () => {
        const tags = runParseHeadTags('[16:13:49.489] [console] [perf:cold start] first frame 1840ms');
        assert.strictEqual(tags.length, 1);
        assert.strictEqual(tags[0].name, 'perf', 'metadata after the colon is not part of the display name');
        assert.strictEqual(tags[0].level, 'performance');
    });

    test('still returns nothing for an unrecognized tag behind the wrapper', () => {
        const tags = runParseHeadTags('[16:13:49.489] [console] [randomtag] hello');
        assert.strictEqual(tags.length, 0);
    });

    test('a line with no wrapper is unaffected', () => {
        const tags = runParseHeadTags('[db] bulkPreload wrote 185 rows');
        assert.strictEqual(tags.length, 1);
        assert.strictEqual(tags[0].level, 'database');
    });
});

suite('head-tag chips in the tag column', () => {
    test('renderHeadTagChips shows the PRIMARY (first) tag plus a "+N" badge for the rest', () => {
        // Chip bodies run through formatTagLabel — always "Title Case With Spaces",
        // never the raw lowercase/kebab-case tag name (user-reported inconsistency,
        // 2026-07-10: sidebar showed lowercase, tag column showed raw/no-space case).
        const html = run(
            'renderHeadTagChips([{name:"perf",level:"performance"},{name:"frame-stall",level:"performance"}])',
        );
        assert.ok(html.includes('>Perf<'), 'first (primary) tag chip renders, Title Case');
        assert.ok(!html.includes('Frame Stall'), 'second tag does NOT render as its own chip (2026-07-10: capped to 1 chip/row)');
        assert.ok(html.includes('tag-level-performance'), 'primary chip carries its level class');
        assert.ok(html.includes('tag-chip-more') && html.includes('>+1<'), 'a "+1" badge signals the hidden second tag');
    });

    test('renderHeadTagChips shows "+N" for the actual count of extra tags, not just +1', () => {
        const html = run(
            'renderHeadTagChips([{name:"db",level:"database"},{name:"perf",level:"performance"},{name:"log",level:"info"}])',
        );
        assert.ok(html.includes('>+2<'), 'two tags beyond the primary one');
    });

    test('renderHeadTagChips on a single-tag list renders that one chip with no "+N" badge', () => {
        const html = run('renderHeadTagChips([{name:"db",level:"database"}])');
        assert.ok(!html.includes('tag-chip-more'), 'no extra tags — no badge');
        assert.ok(html.includes('>Db<'));
        assert.ok(html.includes('tag-level-database'));
    });

    test('renderHeadTagChips on an empty list renders nothing', () => {
        assert.strictEqual(run('renderHeadTagChips([])'), '');
    });

    test('headTagsTitle lists every tag name, Title Cased, in emission order', () => {
        const title = run(
            'headTagsTitle([{name:"perf",level:"performance"},{name:"frame-stall",level:"performance"},{name:"db",level:"database"}])',
        );
        assert.strictEqual(title, 'Perf, Frame Stall, Db');
    });

    test('stripTagBracketSuffix drops a trailing per-line sequence/thread-id counter', () => {
        // "TelecomRegistra[000:619][25918]" -> "TelecomRegistra": some GmsCore/Clearcut
        // components append this directly onto their own tag with no delimiter; the
        // counter increments every line, so leaving it in defeats tag grouping entirely.
        assert.strictEqual(run('stripTagBracketSuffix("TelecomRegistra[000:619][25918]")'), 'TelecomRegistra');
        assert.strictEqual(run('stripTagBracketSuffix("CommonClearcutLogger[001:494][25914]")'), 'CommonClearcutLogger');
        assert.strictEqual(run('stripTagBracketSuffix("FlutterJNI")'), 'FlutterJNI', 'no bracket suffix, unchanged');
    });

    test('bracket-suffix strip + qualified-tag collapse together clean a real device tag', () => {
        // The full, real tag from the reported device log: strip the per-line counter
        // first, THEN collapse the dotted package path to its class name.
        const full = 'TY_com.google.android.libraries.communications.conference.service.impl.telecom.TelecomRegistra[000:619][25918]';
        const cleaned = run('collapseQualifiedTag(stripTagBracketSuffix("' + full + '"))');
        assert.strictEqual(cleaned, 'TelecomRegistra');
    });

    test('collapseQualifiedTag collapses fully-qualified package/class names to their last segment', () => {
        // 2+ dots reliably means a Java/Android reverse-domain class name, not a short
        // hand-picked tag — collapsing this stopped ~13 near-duplicate chips sharing a
        // 60-char common package prefix from cluttering the Message Tags sidebar.
        assert.strictEqual(
            run('collapseQualifiedTag("com.google.android.libraries.communications.conference.service.impl.ChatService")'),
            'ChatService',
        );
        assert.strictEqual(run('collapseQualifiedTag("system.err")'), 'system.err', 'single-dot tags stay whole');
        assert.strictEqual(run('collapseQualifiedTag("FlutterJNI")'), 'FlutterJNI', 'no-dot tags stay whole');
        assert.strictEqual(run('collapseQualifiedTag("")'), '');
    });

    test('formatTagLabel produces Title Case With Spaces from any raw tag shape', () => {
        assert.strictEqual(run('formatTagLabel("ActivityManager")'), 'Activity Manager', 'camelCase splits');
        assert.strictEqual(run('formatTagLabel("FlutterJNI")'), 'Flutter JNI', 'trailing acronym is preserved, not "Jni"');
        assert.strictEqual(run('formatTagLabel("flutter")'), 'Flutter', 'plain lowercase word is capitalized');
        assert.strictEqual(run('formatTagLabel("frame-stall")'), 'Frame Stall', 'hyphen becomes a space');
        assert.strictEqual(run('formatTagLabel("system.err")'), 'System Err', 'dot becomes a space');
        // Unbreakable all-lowercase token: heuristic splitter would yield "Lowmemorykiller";
        // the explicit override gives the readable multi-word label.
        assert.strictEqual(run('formatTagLabel("lowmemorykiller")'), 'Low Memory Killer', 'override wins');
        assert.strictEqual(run('formatTagLabel("LOWMEMORYKILLER")'), 'Low Memory Killer', 'override is case-insensitive');
        assert.strictEqual(run('formatTagLabel("dalvikvm")'), 'Dalvik VM', 'lowercase compound + acronym');
        assert.strictEqual(run('formatTagLabel("mediacodec")'), 'Media Codec', 'lowercase compound splits');
        // Acronym / proper-name casing the Title-Case pass would otherwise mangle.
        assert.strictEqual(run('formatTagLabel("wpa_supplicant")'), 'WPA Supplicant', 'acronym casing preserved');
        assert.strictEqual(run('formatTagLabel("libc")'), 'libc', 'proper-name lowercase preserved');
        // Override normalizes the all-lowercase logcat form; the camelCase form already
        // splits to the same label, so both spellings render identically.
        assert.strictEqual(run('formatTagLabel("surfaceflinger")'), 'Surface Flinger', 'lowercase form via override');
        assert.strictEqual(run('formatTagLabel("SurfaceFlinger")'), 'Surface Flinger', 'camelCase form via splitter');
        // A tag colliding with an Object.prototype member must NOT resolve to an inherited
        // property — the hasOwnProperty guard keeps these on the normal splitter path.
        assert.strictEqual(run('formatTagLabel("constructor")'), 'Constructor', 'prototype key is not an override');
        assert.strictEqual(run('formatTagLabel("__proto__")'), 'Proto', 'proto key falls through to the splitter');
        assert.strictEqual(run('formatTagLabel("")'), '');
    });

    test('tag names are HTML-escaped in both the chip body and the title', () => {
        // Head tag text is attacker-controlled log content; a raw & or < must never
        // reach the DOM (chip) or a title attribute unescaped. formatTagLabel title-cases
        // the single "word" ("a&b" -> "A&b") before escaping, so assert against that form.
        const html = run('renderHeadTagChips([{name:"a&b",level:"info"}])');
        assert.ok(html.includes('A&amp;b') && !html.includes('A&b'), 'chip body escapes &');
        const title = run('headTagsTitle([{name:"a&b",level:"info"},{name:"<x>",level:"info"}])');
        assert.ok(title.includes('A&amp;b') && title.includes('&lt;x&gt;'), 'title escapes both tags');
    });
});
