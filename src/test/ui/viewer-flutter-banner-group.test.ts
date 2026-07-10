/**
 * Tests for Flutter exception banner grouping: detection patterns, state machine,
 * level override, lineItem tagging, and rendering class application.
 *
 * These are static-inspection tests against the embedded webview scripts, matching
 * the pattern used in viewer-ascii-art-block.test.ts — they verify the wiring is
 * present without standing up a full jsdom webview.
 */
import * as assert from 'node:assert';
import { getViewerDataAddScript } from '../../ui/viewer/viewer-data-add';
import { getFlutterBannerScript } from '../../ui/viewer/viewer-data-add-flutter-banner';
import { getViewerDataHelpersRender } from '../../ui/viewer/viewer-data-helpers-render';
import { getViewerDataHelpersCore } from '../../ui/viewer/viewer-data-helpers-core';
import { getViewportRenderScript } from '../../ui/viewer/viewer-data-viewport';
import { getFlutterBannerStyles } from '../../ui/viewer-styles/viewer-styles-flutter-banner';
import { getWebviewL10nMap } from '../../l10n';

suite('Flutter exception banner grouping', () => {

    suite('detection patterns', () => {
        test('script should define opening regex matching `════ Exception caught by`', () => {
            const script = getFlutterBannerScript();
            assert.ok(
                script.includes('flutterBannerOpenRe'),
                'expected flutterBannerOpenRe declaration',
            );
            // Regex must require 4+ heavy-horizontal chars followed by the phrase.
            assert.ok(
                script.includes('Exception caught by'),
                'opening pattern must reference the Flutter banner phrase',
            );
        });

        test('script should define closing regex requiring a pure heavy-rule line', () => {
            const script = getFlutterBannerScript();
            assert.ok(
                script.includes('flutterBannerCloseRe'),
                'expected flutterBannerCloseRe declaration',
            );
            // Closing pattern requires 20+ heavy-horizontal chars — lenient enough for truncation
            // but high enough to never match short dividers.
            assert.ok(
                /\\u2550\{20/.test(script),
                'closing pattern must require 20+ heavy-horizontal chars',
            );
        });
    });

    suite('detection — behavioral, all sink formats (plan 052)', () => {
        // The banner script is self-contained (no external globals), so we can
        // eval it and exercise classifyFlutterBannerLine directly — a real check
        // that every printed copy of an exception groups, not just a string match.
        // A static "includes" check could not catch the prior bug where only the
        // stderr shape matched: the regex was present, it just didn't fit console.
        function loadClassifier(): {
            classify: (s: string) => { groupId: number; role: string | null };
            reset: () => void;
        } {
            const factory = new Function(
                getFlutterBannerScript() +
                '\nreturn { classify: classifyFlutterBannerLine, reset: resetFlutterBannerDetector };',
            );
            return factory();
        }

        const headers = [
            '════════ Exception caught by rendering library ═════',
            '══╡ EXCEPTION CAUGHT BY RENDERING LIBRARY ╞══════════',
            'FlutterErrorDetails (══╡ EXCEPTION CAUGHT BY RENDERING LIBRARY ╞══',
            'Potential Null Check Operator Error Detected: ══╡ EXCEPTION CAUGHT BY RENDERING LIBRARY ╞══',
        ];

        headers.forEach((h, i) => {
            test(`format ${i + 1} opens a banner group: ${h.slice(0, 28)}…`, () => {
                const api = loadClassifier();
                api.reset();
                const r = api.classify(h);
                assert.strictEqual(r.role, 'header', 'header line must open a group');
                assert.ok(r.groupId >= 0, 'header must carry a real groupId');
            });
        });

        test('body lines stay in the group and the closing rule ends it', () => {
            const api = loadClassifier();
            api.reset();
            api.classify('══╡ EXCEPTION CAUGHT BY RENDERING LIBRARY ╞══════');
            const body = api.classify('The following assertion was thrown during performLayout():');
            assert.strictEqual(body.role, 'body', 'mid lines are body');
            const footer = api.classify(
                '═════════════════════════════════════════════════════════════════',
            );
            assert.strictEqual(footer.role, 'footer', 'pure heavy-rule line closes the group');
            const after = api.classify('I/flutter ( 4323): Background GC freed 5MB');
            assert.strictEqual(after.role, null, 'lines after the close are not grouped');
        });

        test('prose containing the phrase does not open a group', () => {
            const api = loadClassifier();
            api.reset();
            const r = api.classify('no exception caught by the error handler here');
            assert.strictEqual(r.role, null, 'no leading box-rule → not a banner header');
        });

        test('a banner with no closing rule auto-closes after the span cap instead of leaking forever (bug_012)', () => {
            const api = loadClassifier();
            api.reset();
            api.classify('══╡ EXCEPTION CAUGHT BY RENDERING LIBRARY ╞══════');
            // Simulate a truncated dump: 301 body lines, never reaching a closing rule.
            let lastRole: string | null = 'body';
            for (let i = 0; i < 301; i++) {
                lastRole = api.classify('body line ' + i).role;
            }
            assert.strictEqual(lastRole, null, 'line past the cap must fall out of the banner group');
            const after = api.classify('[log] [flowmap] action "Permission" some/file.dart:1');
            assert.strictEqual(after.role, null, 'unrelated lines after the cap must not be grouped');
            assert.strictEqual(after.groupId, -1, 'unrelated lines after the cap must not carry the stale groupId');
        });
    });

    suite('state machine', () => {
        test('should expose begin/end/current helpers consumed by addToData', () => {
            const script = getFlutterBannerScript();
            assert.ok(script.includes('function beginFlutterBanner('), 'begin helper must exist');
            assert.ok(script.includes('function endFlutterBanner('), 'end helper must exist');
            assert.ok(
                script.includes('function currentFlutterBannerGroupId('),
                'current helper must exist',
            );
            assert.ok(
                script.includes('function classifyFlutterBannerLine('),
                'entry point consumed by addToData must exist',
            );
        });

        test('classifyFlutterBannerLine should emit header/body/footer roles', () => {
            const script = getFlutterBannerScript();
            assert.ok(script.includes("role: 'header'"), 'header role must be emitted');
            assert.ok(script.includes("role: 'body'"), 'body role must be emitted');
            assert.ok(script.includes("role: 'footer'"), 'footer role must be emitted');
        });
    });

    suite('addToData wiring', () => {
        test('should call classifyFlutterBannerLine to get banner state per line', () => {
            const script = getViewerDataAddScript();
            assert.ok(
                script.includes('classifyFlutterBannerLine('),
                'addToData must invoke classifier each line for correct state transitions',
            );
        });

        test('should override lvl to error for every banner-tagged line', () => {
            const script = getViewerDataAddScript();
            // Override must run AFTER lvl is computed so separator close lines
            // (isSep → info) still get promoted.
            assert.ok(
                script.includes("if (bannerInfo.groupId !== -1) lvl = 'error'"),
                'banner membership must force lvl=error so filter keeps block visible',
            );
        });

        test('should attach bannerGroupId and bannerRole to the line item', () => {
            const script = getViewerDataAddScript();
            assert.ok(
                script.includes('lineItem.bannerGroupId = bannerInfo.groupId'),
                'lineItem must carry bannerGroupId for the renderer',
            );
            assert.ok(
                script.includes('lineItem.bannerRole = bannerInfo.role'),
                'lineItem must carry bannerRole for start/mid/end class selection',
            );
        });
    });

    suite('rendering', () => {
        test('render script should emit banner-group-start/mid/end classes', () => {
            const render = getViewerDataHelpersRender();
            assert.ok(
                render.includes('banner-group-start'),
                'header row must get banner-group-start class',
            );
            assert.ok(
                render.includes('banner-group-mid'),
                'body rows must get banner-group-mid class',
            );
            assert.ok(
                render.includes('banner-group-end'),
                'footer row must get banner-group-end class',
            );
        });

        test('banner CSS defines the three positional classes with a tint and NO left rail', () => {
            const css = getFlutterBannerStyles();
            assert.ok(css.includes('.banner-group-start'), 'start class must be styled');
            assert.ok(css.includes('.banner-group-mid'), 'mid class must be styled');
            assert.ok(css.includes('.banner-group-end'), 'end class must be styled');
            // The block now reads via a faint background wash, not a left rail.
            assert.ok(
                /\.banner-group-start[\s\S]*?background-color:/.test(css),
                'banner group must use a background tint to connect rows',
            );
            // The 3px left accent rail was removed: it shifted every banner row right
            // of the gutter grid (breaking column alignment) and duplicated the
            // per-row severity dots. It must NOT come back.
            assert.ok(
                !/border-left:\s*3px\s+solid/.test(css),
                'banner group must NOT use a left rail — it breaks the columnar layout',
            );
            // No padding-left either — without a rail to clear, padding would only
            // push banner text out of column with ordinary lines.
            assert.ok(
                !/padding-left/.test(css),
                'banner group must NOT add padding-left — it misaligns columns',
            );
        });

        test('banner CSS defines the collapse chevron affordance', () => {
            const css = getFlutterBannerStyles();
            assert.ok(
                /\.banner-chevron\s*\{[\s\S]*?cursor:\s*pointer/.test(css),
                'banner header must carry a clickable collapse chevron',
            );
        });

        test('error stack rows no longer carry the banner rail', () => {
            // The rail that used to continue through stack frames is gone with the
            // banner rail; the per-row severity dots/connectors already mark the spine.
            const css = getFlutterBannerStyles();
            assert.ok(
                !/\.stack-header\.level-bar-error/.test(css),
                'error stack rows must NOT carry a banner rail anymore',
            );
        });

        test('banner body and footer rows hide the line-decoration prefix', () => {
            // WHY visibility:hidden rather than display:none — the span must
            // continue to occupy its natural width so the .line:has(.line-decoration)
            // rule keeps applying (14.25em padding-left + hanging-indent), which
            // keeps the message text on body/footer rows column-aligned with
            // the header. display:none would collapse the prefix, drop the
            // hanging indent, and slam body text up against the banner rail.
            const css = getFlutterBannerStyles();
            assert.ok(
                /\.banner-group-mid\s*>\s*\.line-decoration[\s\S]*?\.banner-group-end\s*>\s*\.line-decoration[\s\S]*?visibility:\s*hidden/.test(css),
                'banner body + footer rows must hide their .line-decoration via visibility:hidden',
            );
            // Banner header must NOT be in the hide list — it's the one row
            // that should display the counter + timestamp for the whole block.
            assert.ok(
                !/\.banner-group-start\s*>\s*\.line-decoration[^}]*visibility:\s*hidden/.test(css),
                'banner header (start) must keep its visible counter + timestamp',
            );
        });
    });

    suite('collapse — collapsed by default, like stack/continuation groups', () => {
        test('banner script defines bannerHeaderMap and a toggle, resetting the map', () => {
            const script = getFlutterBannerScript();
            assert.ok(script.includes('var bannerHeaderMap'), 'header map must be declared');
            assert.ok(
                script.includes('function toggleFlutterBanner('),
                'toggle must exist so a header click can fold/unfold the block',
            );
            assert.ok(
                /resetFlutterBannerDetector[\s\S]*?bannerHeaderMap = \{\}/.test(script),
                'reset must clear bannerHeaderMap so a new session drops stale headers',
            );
        });

        test('addToData registers the header collapsed by default', () => {
            const script = getViewerDataAddScript();
            assert.ok(
                script.includes('lineItem.bannerCollapsed = true'),
                'banner header must start collapsed so the block folds to its title',
            );
            assert.ok(
                script.includes('bannerHeaderMap[bannerInfo.groupId] = lineItem'),
                'header must be registered so calcItemHeight can find its collapse state',
            );
        });

        test('calcItemHeight hides body/footer rows when the header is collapsed', () => {
            const core = getViewerDataHelpersCore();
            assert.ok(
                /item\.bannerRole !== 'header'[\s\S]*?bannerHeaderMap\[item\.bannerGroupId\][\s\S]*?bannerCollapsed[\s\S]*?return 0/.test(core),
                'non-header banner rows must collapse to height 0 when the header is collapsed',
            );
        });

        test('renderer emits the header chevron reflecting collapse state', () => {
            const render = getViewerDataHelpersRender();
            assert.ok(render.includes('banner-chevron'), 'header must render a disclosure chevron');
            assert.ok(
                render.includes('item.bannerCollapsed !== false'),
                'chevron glyph must reflect the collapsed state',
            );
        });

        test('addToData counts banner members for the hidden-line count', () => {
            const script = getViewerDataAddScript();
            assert.ok(
                /_bHdr\.bannerMemberCount = \(_bHdr\.bannerMemberCount \|\| 0\) \+ 1/.test(script),
                'body/footer rows must increment the header member count',
            );
        });

        test('collapsed header renders a localized hidden-line count', () => {
            const render = getViewerDataHelpersRender();
            assert.ok(render.includes('banner-count'), 'collapsed header must render a count pill');
            assert.ok(
                render.includes("vt('viewer.meta.lines'"),
                'count must use the localized viewer.meta.lines key, not a hardcoded string',
            );
        });

        test('banner header tooltip keys exist in the webview l10n map', () => {
            const map = getWebviewL10nMap();
            assert.ok(
                /\{0\}/.test(map['viewer.bannerHeader.collapsed']),
                'collapsed tooltip must carry a {0} placeholder for the line count',
            );
            assert.strictEqual(
                typeof map['viewer.bannerHeader.expanded'],
                'string',
                'expanded tooltip key must be registered',
            );
        });
    });

    suite('severity connector is pure CSS — JS chain machinery retired', () => {
        // The dot-to-dot connector that used to live as a JS loop in
        // renderViewport (findNextDotSibling + bar-up/bar-down/bar-bridge
        // class stamping + a bridgeable pre-check) is gone. The join is now
        // a single class-agnostic [class*="level-bar-"]::after full-height
        // stripe (2026-07-10, replacing the interim per-level :has(+) chain).
        // Declarative, no JS, no DOM bookkeeping. These tests pin that
        // retirement so the JS chain doesn't come back.
        const viewport = getViewportRenderScript();

        test('renderViewport no longer carries the chain helpers or class stamping', () => {
            assert.ok(
                !viewport.includes('function findNextDotSibling('),
                'findNextDotSibling was JS chain machinery — replaced by CSS :has() selectors',
            );
            assert.ok(
                !viewport.includes('function getBarLevel('),
                'getBarLevel was used only by the retired chain loop',
            );
            assert.ok(
                !/classList\.add\([^)]*['"]bar-up['"]/.test(viewport),
                'render loop must not stamp .bar-up — chain is CSS-only',
            );
            assert.ok(
                !/classList\.add\([^)]*['"]bar-down['"]/.test(viewport),
                'render loop must not stamp .bar-down — chain is CSS-only',
            );
            assert.ok(
                !/classList\.add\([^)]*['"]bar-bridge['"]/.test(viewport),
                'render loop must not stamp .bar-bridge — chain is CSS-only',
            );
            assert.ok(
                !viewport.includes('var bridgeable'),
                'bridgeable pre-check belonged to the retired bridge stamping — no longer needed',
            );
        });
    });

});
