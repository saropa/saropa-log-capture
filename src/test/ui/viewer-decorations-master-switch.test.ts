import * as assert from 'node:assert';
import { getDecorationsScript } from '../../ui/viewer-decorations/viewer-decorations';
import { getDecoSettingsScript } from '../../ui/viewer-decorations/viewer-deco-settings';
import { getQualityBadgeScript } from '../../ui/viewer-decorations/viewer-quality-badge';
import { getLintBadgeScript } from '../../ui/viewer-decorations/viewer-lint-badge';

suite('Decoration master switch removal', () => {
    const decoScript = getDecorationsScript();
    const settingsScript = getDecoSettingsScript();
    const qualityScript = getQualityBadgeScript();
    const lintScript = getLintBadgeScript();

    suite('areDecorationsOn() replaces showDecorations variable', () => {

        test('should define areDecorationsOn function', () => {
            assert.ok(decoScript.includes('function areDecorationsOn()'));
        });

        test('should not declare a showDecorations variable', () => {
            assert.ok(
                !decoScript.includes('var showDecorations'),
                'master switch variable should be removed',
            );
        });

        test('should not define toggleDecorations function', () => {
            assert.ok(
                !decoScript.includes('function toggleDecorations'),
                'master toggle function should be removed',
            );
        });

        test('should not define handleSetShowDecorations function', () => {
            assert.ok(
                !decoScript.includes('function handleSetShowDecorations'),
                'extension message handler should be removed',
            );
        });

        test('should use areDecorationsOn in getDecorationPrefix', () => {
            assert.ok(decoScript.includes('areDecorationsOn()'));
        });
    });

    suite('deco-settings has no master switch references', () => {

        test('should not reference showDecorations variable', () => {
            assert.ok(
                !settingsScript.includes('showDecorations'),
                'settings script should not reference removed master switch',
            );
        });

        test('should not call toggleDecorations', () => {
            assert.ok(
                !settingsScript.includes('toggleDecorations'),
                'settings should not call removed toggle function',
            );
        });

        test('should call updateDecoButton from onDecoOptionChange', () => {
            assert.ok(settingsScript.includes('updateDecoButton'));
        });
    });

    suite('badge scripts have no master switch gate', () => {

        test('quality badge should not check showDecorations', () => {
            assert.ok(
                !qualityScript.includes('showDecorations'),
                'quality badge should only check its own toggle',
            );
        });

        test('lint badge should not check showDecorations', () => {
            assert.ok(
                !lintScript.includes('showDecorations'),
                'lint badge should only check its own toggle',
            );
        });

        test('quality badge should check decoShowQuality', () => {
            assert.ok(qualityScript.includes('decoShowQuality'));
        });

        test('lint badge should check decoShowLintBadges', () => {
            assert.ok(lintScript.includes('decoShowLintBadges'));
        });
    });

    suite('script load order: settings before decorations', () => {

        test('should declare decoShowDot before areDecorationsOn references it', () => {
            // Simulate the concatenated webview scope: deco-settings must
            // come first so its variable declarations exist when
            // areDecorationsOn() is defined and executed.
            const combined = settingsScript + '\n' + decoScript;
            const declPos = combined.indexOf('var decoShowDot');
            const usePos = combined.indexOf('function areDecorationsOn');
            assert.ok(
                declPos < usePos,
                `decoShowDot declaration (${declPos}) must precede areDecorationsOn (${usePos})`,
            );
        });

        test('should declare all toggle vars before areDecorationsOn', () => {
            const combined = settingsScript + '\n' + decoScript;
            const usePos = combined.indexOf('function areDecorationsOn');
            const vars = [
                'decoShowDot', 'decoShowCounter', 'decoShowCounterOnBlank',
                'decoShowTimestamp', 'showElapsed', 'decoShowSessionElapsed',
                'decoShowBar', 'decoLineColorMode',
            ];
            for (const v of vars) {
                const declPos = combined.indexOf(`var ${v}`);
                assert.ok(
                    declPos !== -1 && declPos < usePos,
                    `${v} must be declared before areDecorationsOn`,
                );
            }
        });
    });

    suite('footer Deco button opens settings panel directly', () => {

        test('should call toggleDecoSettings on click', () => {
            assert.ok(decoScript.includes('toggleDecoSettings'));
        });

        test('should not register toggleDecorations as click handler', () => {
            assert.ok(
                !decoScript.includes("addEventListener('click', toggleDecorations"),
                'button should not use removed toggle function',
            );
        });
    });
});
