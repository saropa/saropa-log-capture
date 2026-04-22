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
    });

});
