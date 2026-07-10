/**
 * Tests for the head-tag chips that render in the tag decoration column.
 *
 * App head tags ([db]/[perf]/[frame-stall]) render as chips in the same tag cell
 * as the structured device tag (buildDecoParts). Every tag is shown — no +N
 * collapse — and the full list rides the cell title (headTagsTitle) so a chip
 * clipped by the fixed column width is recoverable on hover. This suite pins the
 * all-chips rendering, the title list, and HTML-escaping of hostile tag text.
 */
import * as assert from 'node:assert';
import * as vm from 'node:vm';
import { getHeadTagsParserScript } from '../../ui/viewer-bracket-head-tags/viewer-bracket-head-tags';

/** Run the head-tags webview script in a VM and return the named function's string result. */
function run(call: string): string {
    const ctx = vm.createContext({});
    vm.runInContext(getHeadTagsParserScript(), ctx);
    return vm.runInContext(call, ctx) as string;
}

suite('head-tag chips in the tag column', () => {
    test('renderHeadTagChips shows every tag as a level-colored, Title Case chip (no +N)', () => {
        // Chip bodies run through formatTagLabel — always "Title Case With Spaces",
        // never the raw lowercase/kebab-case tag name (user-reported inconsistency,
        // 2026-07-10: sidebar showed lowercase, tag column showed raw/no-space case).
        const html = run(
            'renderHeadTagChips([{name:"perf",level:"performance"},{name:"frame-stall",level:"performance"}])',
        );
        assert.ok(html.includes('>Perf<'), 'first tag chip is Title Case');
        assert.ok(html.includes('>Frame Stall<'), 'second tag chip splits the hyphen into a space — nothing collapsed');
        assert.ok(html.includes('tag-level-performance'), 'chips carry their level class');
        assert.ok(!html.includes('+1') && !html.includes('tag-chip-more'), 'no +N overflow badge');
    });

    test('renderHeadTagChips on an empty list renders nothing', () => {
        assert.strictEqual(run('renderHeadTagChips([])'), '');
    });

    test('headTagsTitle lists every tag name, Title Cased, in emission order', () => {
        const title = run(
            'headTagsTitle([{name:"perf",level:"performance"},{name:"frame-stall",level:"performance"},{name:"db",level:"database"}])',
        );
        assert.strictEqual(title, 'Perf Frame Stall Db');
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
