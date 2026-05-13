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
            // only when both the dot ::before AND the bar-up/bar-down ::after
            // are pulled in together. If a future tweak moves one but not the
            // other, the stub connector visibly offsets from the dot it joins.
            const css = getFlutterBannerStyles();
            // Dot ::before override applies to all three banner positions.
            assert.ok(
                /\.banner-group-start\[class\*="level-bar-"\]::before[\s\S]*?\.banner-group-mid\[class\*="level-bar-"\]::before[\s\S]*?\.banner-group-end\[class\*="level-bar-"\]::before[\s\S]*?left:\s*0\.15em/.test(css),
                'all three banner positions must pull the severity dot to left: 0.15em',
            );
            // Connector ::after must be re-centered under the pulled dot.
            assert.ok(
                /\.banner-group-(?:start|mid|end)\.bar-(?:up|down)::after[\s\S]*?left:\s*0\.30em/.test(css),
                'bar-up / bar-down connector must align under the pulled dot at left: 0.30em',
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

    suite('severity connector breaks at real content rows (no bridge through unrelated content)', () => {
        const viewport = getViewportRenderScript();

        test('bridge loop pre-checks for blocking content rows before painting', () => {
            // WHY a pre-check rather than skipping inline: bar-down/bar-up on
            // the dots themselves still needs to fire (anchors the chain so
            // dot pairs still read as related), but the level-bar-{lvl} stamp
            // on intermediate rows must NOT happen if any of them is a real
            // content row. The two decisions are independent — that's why
            // there's a "bridgeable" flag.
            assert.ok(
                viewport.includes('var bridgeable = true'),
                'connector loop must declare a bridgeable flag before painting bridge classes',
            );
            assert.ok(
                viewport.includes("ch[bj].classList.contains('line-blank')")
                    && viewport.includes("ch[bj].classList.contains('viewer-divider')"),
                'pre-check must allow blank lines and viewer-divider rows as bridgeable rows',
            );
            assert.ok(
                viewport.includes('bridgeable = false'),
                'pre-check must flip bridgeable to false on a real content row',
            );
            assert.ok(
                viewport.includes('if (bridgeable) {'),
                'bridge class assignment must be gated by the bridgeable flag',
            );
        });

        test('dot anchors (bar-down on ci, bar-up on ni) still fire when not bridgeable', () => {
            // The chain must still read as "almost connected" even when the
            // bridge is suppressed — these two classes paint the stub above
            // the trailing dot and below the leading dot.
            const loopStart = viewport.indexOf("ch[ci].classList.add('bar-down')");
            assert.ok(loopStart >= 0, 'bar-down anchor must be assigned to ci');
            assert.ok(
                viewport.indexOf("ch[ni].classList.add('bar-up')", loopStart) > loopStart,
                'bar-up anchor must be assigned to ni',
            );
            // Both anchors must come BEFORE the bridgeable gate so they
            // fire regardless of whether intermediate rows are bridgeable.
            const anchorIdx = viewport.indexOf("ch[ci].classList.add('bar-down')");
            const gateIdx = viewport.indexOf('if (bridgeable) {');
            assert.ok(
                anchorIdx >= 0 && gateIdx > anchorIdx,
                'dot anchors must be assigned before the bridgeable-gated paint loop',
            );
        });
    });

});
