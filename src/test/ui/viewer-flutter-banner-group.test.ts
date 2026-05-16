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
import { getViewportRenderScript } from '../../ui/viewer/viewer-data-viewport';
import { getFlutterBannerStyles } from '../../ui/viewer-styles/viewer-styles-flutter-banner';

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

        test('banner CSS must define the three positional classes', () => {
            const css = getFlutterBannerStyles();
            assert.ok(css.includes('.banner-group-start'), 'start class must be styled');
            assert.ok(css.includes('.banner-group-mid'), 'mid class must be styled');
            assert.ok(css.includes('.banner-group-end'), 'end class must be styled');
            // Left accent rail is the primary visual connector — required on all three.
            assert.ok(
                /border-left:\s*3px\s+solid/.test(css),
                'banner group must use a left accent rail to visually connect rows',
            );
        });

        test('severity dot is pulled into the banner rail (tight gap)', () => {
            // WHY pin both numbers: the rail visually "joins" the dot column
            // only when both the dot ::before AND the chain-connector ::after
            // are pulled in together. If a future tweak moves one but not the
            // other, the connector visibly offsets from the dot it joins.
            const css = getFlutterBannerStyles();
            // Dot ::before override applies to all three banner positions.
            assert.ok(
                /\.banner-group-start\[class\*="level-bar-"\]::before[\s\S]*?\.banner-group-mid\[class\*="level-bar-"\]::before[\s\S]*?\.banner-group-end\[class\*="level-bar-"\]::before[\s\S]*?left:\s*0\.15em/.test(css),
                'all three banner positions must pull the severity dot to left: 0.15em',
            );
            // Connector ::after on banner-group rows must be re-centered under
            // the pulled dot. The chain logic itself is now pure CSS in
            // viewer-styles-decoration-bars.ts via :has(+ .level-bar-X)::after;
            // banner-group rows just override the ::after's `left` position
            // so the chain stripe paints under the pulled-in dot rather than
            // at the default 0.89em.
            assert.ok(
                /\.banner-group-(?:start|mid|end)\[class\*="level-bar-"\]::after[\s\S]*?left:\s*0\.30em/.test(css),
                'banner-group ::after connector must align under the pulled dot at left: 0.30em',
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

    suite('severity connector is pure CSS — JS chain machinery retired', () => {
        // The dot-to-dot connector that used to live as a JS loop in
        // renderViewport (findNextDotSibling + bar-up/bar-down/bar-bridge
        // class stamping + a bridgeable pre-check) is gone. The chain is now
        // ten per-level CSS rules using :has(+ .level-bar-X)::after on each
        // row. Sibling-aware, declarative, no JS, no DOM bookkeeping. These
        // tests pin that retirement so the JS chain doesn't come back.
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
