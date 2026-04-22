import * as assert from 'node:assert';
import { getSourceTagsScript } from '../../ui/viewer-stack-tags/viewer-source-tags';
import { getSourceTagUiScript } from '../../ui/viewer-stack-tags/viewer-source-tags-ui';

function createSourceTagRuntime() {
    const script = getSourceTagsScript();
    const factory = new Function(`
        var document = { getElementById: function() { return null; } };
        var window = {};
        var allLines = [];
        var vscodeApi = { postMessage: function() {} };
        function stripTags(s) { var t = String(s || '').replace(/<[^>]*>/g, ''); return t.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&'); }
        ${script}
        return { parseSourceTag, isNoisySourceTag, getSourceTagChipKeys, sourceTagCounts, otherKey };
    `) as () => {
        parseSourceTag: (plain: string) => string | null;
        isNoisySourceTag: (tag: string) => boolean;
        getSourceTagChipKeys: () => string[];
        sourceTagCounts: Record<string, number>;
        otherKey: string;
    };
    return factory();
}

suite('Viewer Source Tags Noise Guard', () => {
    test('parseSourceTag rejects noisy tags and preserves useful tags', () => {
        const runtime = createSourceTagRuntime();
        assert.strictEqual(runtime.parseSourceTag('I/flutter (123): [08:45:23.606] tick'), null);
        assert.strictEqual(runtime.parseSourceTag('I/flutter (123): [isamigrationcompleted] done'), 'isamigrationcompleted');
        assert.strictEqual(runtime.parseSourceTag('I/flutter (123): Drift: Sent SELECT * FROM users'), 'database');
        assert.strictEqual(runtime.isNoisySourceTag('08:45:23.606'), true);
        assert.strictEqual(runtime.isNoisySourceTag('wm-greedyscheduler'), false);
    });

    // Lines prefixed with a timestamp bracket (SDA/console/debug output) must still register
    // the meaningful secondary tag. Without the noisy-bracket fall-through these showed no chip.
    test('parseSourceTag falls through noisy timestamp bracket to inline tag', () => {
        const runtime = createSourceTagRuntime();
        assert.strictEqual(
            runtime.parseSourceTag('[16:07:58.532] [console] [log] [32mSDA] All package root resolution strategies failed'),
            'console',
        );
        assert.strictEqual(
            runtime.parseSourceTag('[16:07:58.533] [console] [2m  [32m » ServerContext.log package:foo/bar.dart:209:35'),
            'console',
        );
        // Drift SQL wrapped in a timestamp-prefixed line still wins the database classification
        // (driftStatementPattern runs on the body, so a Drift-tagged line maps to 'database'
        // even when the leading bracket is a noisy timestamp and the secondary tag is [console]).
        // Note: ANSI codes must already be HTML-stripped by the caller — if literal "[32m" sits
        // between "[log]" and "Drift", the word-boundary before Drift fails and the line falls
        // back to the secondary 'console' tag. That is a separate ANSI-conversion concern.
        assert.strictEqual(
            runtime.parseSourceTag('[16:13:49.489] [console] [log] Drift INSERT: INSERT INTO "contacts" (x) VALUES (?)'),
            'database',
        );
    });

    test('shared chip-eligibility helper excludes low-frequency and other tags', () => {
        const runtime = createSourceTagRuntime();
        runtime.sourceTagCounts[runtime.otherKey] = 999;
        runtime.sourceTagCounts.flutter = 10;
        runtime.sourceTagCounts.android = 1;
        runtime.sourceTagCounts.facebook = 2;
        const keys = runtime.getSourceTagChipKeys().sort((a, b) => a.localeCompare(b));
        assert.deepStrictEqual(keys, ['facebook', 'flutter']);
    });

    test('source tag UI uses shared chip-eligibility helper', () => {
        const uiScript = getSourceTagUiScript();
        assert.ok(uiScript.includes('getSourceTagChipKeys'));
        assert.ok(uiScript.includes('Show all ('));
    });
});

