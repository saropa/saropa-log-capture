import * as assert from 'node:assert';
import { getSourceTagsScript } from '../../ui/viewer-stack-tags/viewer-source-tags';
import { getSourceTagUiScript } from '../../ui/viewer-stack-tags/viewer-source-tags-ui';
import { getHeadTagsParserScript } from '../../ui/viewer-bracket-head-tags/viewer-bracket-head-tags';

/**
 * Tests for the Message Tags panel always showing every tag (no "Show all (N)"
 * expander) and the tag search box that filters the chip list live (2026-07-10:
 * user reported the expander hid tags with no indication why, and asked for
 * search instead).
 */

interface Runtime {
    sourceTagCounts: Record<string, number>;
    sourceTagDisplayNames: Record<string, string>;
    sourceTagRawValues: Record<string, Record<string, boolean>>;
    hiddenSourceTags: Record<string, boolean>;
    sourceTagSearchQuery: string;
    rebuildTagChips: () => void;
    buildTagsJsonPayload: () => Record<string, string[]>;
    chipsHtml: () => string;
}

/** Create a Message Tags runtime with a chip-container DOM stub whose innerHTML is inspectable. */
function createRuntime(): Runtime {
    const headTags = getHeadTagsParserScript();
    const script = getSourceTagsScript();
    const ui = getSourceTagUiScript();
    let chipsHtml = '';
    const chipsEl = {
        set innerHTML(v: string) { chipsHtml = v; },
        get innerHTML() { return chipsHtml; },
        addEventListener: () => { /* no-op: click delegation not exercised here */ },
    };
    const summaryEl = { textContent: '' };
    const tabEl = { style: {} };
    const factory = new Function('chipsEl', 'summaryEl', 'tabEl', `
        var document = {
            getElementById: function(id) {
                if (id === 'source-tag-chips') return chipsEl;
                if (id === 'source-tag-summary') return summaryEl;
                if (id === 'filter-tab-log-tags') return tabEl;
                return null;
            }
        };
        var allLines = [];
        function recalcHeights() {}
        function renderViewport() {}
        function recalcAndRender() {}
        function markPresetDirty() {}
        function stripTags(s) { return String(s || ''); }
        function vt(key, arg) { return arg !== undefined ? key + ':' + arg : key; }
        function setAccordionSummary() {}
        ${headTags}
        ${script}
        ${ui}
        return {
            get sourceTagCounts() { return sourceTagCounts; },
            set sourceTagCounts(v) { sourceTagCounts = v; },
            get sourceTagDisplayNames() { return sourceTagDisplayNames; },
            set sourceTagDisplayNames(v) { sourceTagDisplayNames = v; },
            get sourceTagRawValues() { return sourceTagRawValues; },
            set sourceTagRawValues(v) { sourceTagRawValues = v; },
            get hiddenSourceTags() { return hiddenSourceTags; },
            set hiddenSourceTags(v) { hiddenSourceTags = v; },
            get sourceTagSearchQuery() { return sourceTagSearchQuery; },
            set sourceTagSearchQuery(v) { sourceTagSearchQuery = v; },
            rebuildTagChips: rebuildTagChips,
            buildTagsJsonPayload: buildTagsJsonPayload,
        };
    `) as (chipsEl: unknown, summaryEl: unknown, tabEl: unknown) => Omit<Runtime, 'chipsHtml'>;
    const built = factory(chipsEl, summaryEl, tabEl);
    // Object.assign (not object-spread) — built's sourceTagCounts/etc. are accessor
    // properties (get/set) closing over the eval'd script's live variables; spreading
    // them into a new object copies the CURRENT VALUE, silently severing that live
    // binding so later `rt.sourceTagCounts = ...` writes go nowhere.
    return Object.assign(built, { chipsHtml: () => chipsHtml });
}

suite('Message Tags panel — always show all, with search', () => {
    test('renders every chip-eligible tag with no top-N cap and no "Show all" button', () => {
        const rt = createRuntime();
        // 25 distinct tags, well past the old sourceTagMaxChips (20) cap.
        const counts: Record<string, number> = {};
        for (let i = 0; i < 25; i++) { counts['tag' + i] = 2; }
        rt.sourceTagCounts = counts;
        rt.hiddenSourceTags = {};

        rt.rebuildTagChips();
        const html = rt.chipsHtml();

        for (let i = 0; i < 25; i++) {
            assert.ok(html.includes('data-tag="tag' + i + '"'), `tag${i} chip is present`);
        }
        assert.ok(!html.includes('tag-show-all-btn'), 'no "Show all" expander button');
    });

    test('search query narrows the visible chips by formatted label, case-insensitively', () => {
        const rt = createRuntime();
        rt.sourceTagCounts = { activitymanager: 5, windowmanager: 3, flutter: 10 };
        rt.sourceTagDisplayNames = { activitymanager: 'ActivityManager', windowmanager: 'WindowManager', flutter: 'flutter' };
        rt.hiddenSourceTags = {};

        rt.sourceTagSearchQuery = 'manager';
        rt.rebuildTagChips();
        const html = rt.chipsHtml();

        assert.ok(html.includes('data-tag="activitymanager"'), 'Activity Manager matches "manager"');
        assert.ok(html.includes('data-tag="windowmanager"'), 'Window Manager matches "manager"');
        assert.ok(!html.includes('data-tag="flutter"'), 'flutter does not match "manager"');
    });

    test('a search query matching nothing shows a no-match message instead of chips', () => {
        const rt = createRuntime();
        rt.sourceTagCounts = { flutter: 10 };
        rt.sourceTagDisplayNames = { flutter: 'flutter' };
        rt.hiddenSourceTags = {};

        rt.sourceTagSearchQuery = 'zzz-nomatch';
        rt.rebuildTagChips();
        const html = rt.chipsHtml();

        assert.ok(!html.includes('data-tag="flutter"'));
        assert.ok(html.includes('source-tag-no-match'));
    });

    test('an empty search query shows every tag again', () => {
        const rt = createRuntime();
        rt.sourceTagCounts = { flutter: 10, activitymanager: 5 };
        rt.sourceTagDisplayNames = { flutter: 'flutter', activitymanager: 'ActivityManager' };
        rt.hiddenSourceTags = {};

        rt.sourceTagSearchQuery = '';
        rt.rebuildTagChips();
        const html = rt.chipsHtml();

        assert.ok(html.includes('data-tag="flutter"'));
        assert.ok(html.includes('data-tag="activitymanager"'));
    });
});

suite('Message Tags panel — copy tags as JSON', () => {
    test('groups by the formatted display label and lists the distinct raw tags under it', () => {
        const rt = createRuntime();
        rt.sourceTagCounts = { chatservice: 7 };
        rt.sourceTagDisplayNames = { chatservice: 'ChatService' };
        rt.sourceTagRawValues = {
            chatservice: {
                'com.google.android.libraries.foo.ChatService': true,
                'org.other.pkg.ChatService': true,
            },
        };

        const payload = rt.buildTagsJsonPayload();

        assert.deepStrictEqual(payload, {
            'Chat Service': [
                'com.google.android.libraries.foo.ChatService',
                'org.other.pkg.ChatService',
            ],
        });
    });

    test('falls back to the display name as the sole raw entry when no raw values were tracked', () => {
        const rt = createRuntime();
        rt.sourceTagCounts = { flutter: 3 };
        rt.sourceTagDisplayNames = { flutter: 'flutter' };
        rt.sourceTagRawValues = {};

        const payload = rt.buildTagsJsonPayload();

        assert.deepStrictEqual(payload, { Flutter: ['flutter'] });
    });

    test('excludes the "other" bucket and sorts keys alphabetically by display label', () => {
        const rt = createRuntime();
        rt.sourceTagCounts = { zzz: 2, aaa: 2, __other__: 999 };
        rt.sourceTagDisplayNames = { zzz: 'zzz', aaa: 'aaa' };
        rt.sourceTagRawValues = {};

        const payload = rt.buildTagsJsonPayload();

        assert.deepStrictEqual(Object.keys(payload), ['Aaa', 'Zzz']);
    });
});
