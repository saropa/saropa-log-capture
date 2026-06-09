/**
 * Column-visibility persistence tests.
 *
 * The four Columns toggles (line numbers, timestamp, session elapsed, tag) are backed by
 * user settings (`saropaLogCapture.viewerColumn*`): their initial state is baked into each
 * freshly-built viewer from config, and toggling a column writes the setting back at User
 * (Global) scope so newly opened logs default to the chosen layout.
 *
 * These tests pin both halves: the baked defaults (script init reads injected values) and
 * the write path (each toggle + the deco panel post the matching setViewerColumn* message),
 * plus the host map that routes those messages to Global-scope config keys.
 */
import * as assert from 'node:assert';
import { getDecoSettingsScript } from '../../ui/viewer-decorations/viewer-deco-settings';
import { getDecoSettingsSyncScript } from '../../ui/viewer-decorations/viewer-deco-settings-sync';
import { SAROPA_GLOBAL_BOOL_SETTING_BY_MSG_TYPE } from '../../ui/provider/viewer-workspace-bool-message-map';

suite('ViewerColumnPrefsPersistence', () => {
    test('column defaults are baked into the script from injected config', () => {
        // Non-default values must appear verbatim in the var initializers.
        const script = getDecoSettingsScript({
            lineNumbers: false,
            timestamp: false,
            sessionElapsed: true,
            parsedTag: false,
        });
        assert.ok(/var decoShowCounter = false;/.test(script), 'lineNumbers default baked');
        assert.ok(/var decoShowTimestamp = false;/.test(script), 'timestamp default baked');
        assert.ok(/var decoShowSessionElapsed = true;/.test(script), 'sessionElapsed default baked');
        assert.ok(/var decoShowParsedTag = false;/.test(script), 'parsedTag default baked');
    });

    test('omitting columns falls back to historical hardcoded defaults', () => {
        const script = getDecoSettingsScript();
        assert.ok(/var decoShowCounter = true;/.test(script));
        assert.ok(/var decoShowTimestamp = true;/.test(script));
        assert.ok(/var decoShowSessionElapsed = false;/.test(script));
        assert.ok(/var decoShowParsedTag = true;/.test(script));
    });

    test('every Columns toggle posts its setViewerColumn* setting', () => {
        const script = getDecoSettingsScript();
        const cases: Array<[string, string]> = [
            ['toggleLineNumbers', 'setViewerColumnLineNumbers'],
            ['toggleTimestamp', 'setViewerColumnTimestamp'],
            ['toggleSessionElapsed', 'setViewerColumnSessionElapsed'],
            ['toggleParsedTag', 'setViewerColumnParsedTag'],
        ];
        for (const [fn, msg] of cases) {
            const start = script.indexOf(`function ${fn}()`);
            assert.ok(start >= 0, `${fn} must exist`);
            const body = script.slice(start, script.indexOf('}', start));
            assert.ok(body.includes(`postColumnPref('${msg}'`), `${fn} must post ${msg}`);
        }
    });

    test('deco panel (onDecoOptionChange) posts the three columns it controls', () => {
        const sync = getDecoSettingsSyncScript();
        const start = sync.indexOf('function onDecoOptionChange()');
        const body = sync.slice(start);
        assert.ok(body.includes("postColumnPref('setViewerColumnLineNumbers'"));
        assert.ok(body.includes("postColumnPref('setViewerColumnTimestamp'"));
        assert.ok(body.includes("postColumnPref('setViewerColumnSessionElapsed'"));
    });

    test('host map routes all four messages to Global-scope config keys', () => {
        assert.strictEqual(SAROPA_GLOBAL_BOOL_SETTING_BY_MSG_TYPE.setViewerColumnLineNumbers, 'viewerColumnLineNumbers');
        assert.strictEqual(SAROPA_GLOBAL_BOOL_SETTING_BY_MSG_TYPE.setViewerColumnTimestamp, 'viewerColumnTimestamp');
        assert.strictEqual(SAROPA_GLOBAL_BOOL_SETTING_BY_MSG_TYPE.setViewerColumnSessionElapsed, 'viewerColumnSessionElapsed');
        assert.strictEqual(SAROPA_GLOBAL_BOOL_SETTING_BY_MSG_TYPE.setViewerColumnParsedTag, 'viewerColumnParsedTag');
    });
});
