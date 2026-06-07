/**
 * Column-visibility persistence tests.
 *
 * The four Columns toggles (line numbers, timestamp, session elapsed, tag) must
 * survive a viewer reload / VS Code restart. They persist to webview state via
 * vscodeApi.getState()/setState() — the same view-local mechanism used by the
 * icon-bar and filter-tab label prefs — rather than a workspace setting, because
 * they are per-view display choices, not project config.
 *
 * The persist/restore helpers live in viewer-deco-column-prefs.ts; the toggle
 * functions that call them live in viewer-deco-settings.ts. These tests pin both
 * halves: the helpers exist and use webview state, restore runs at init (so the
 * opening paint reflects the saved choice), and every path that flips a Columns
 * toggle persists afterwards.
 */
import * as assert from 'node:assert';
import { getDecoSettingsScript } from '../../ui/viewer-decorations/viewer-deco-settings';
import { getColumnPrefsScript } from '../../ui/viewer-decorations/viewer-deco-column-prefs';
import { getDecoSettingsSyncScript } from '../../ui/viewer-decorations/viewer-deco-settings-sync';

suite('ViewerColumnPrefsPersistence', () => {
    const settings = getDecoSettingsScript();
    const prefs = getColumnPrefsScript();
    const sync = getDecoSettingsSyncScript();

    test('defines persistColumnPrefs and restoreColumnPrefs using webview state', () => {
        assert.ok(prefs.includes('function persistColumnPrefs()'), 'persist helper must exist');
        assert.ok(prefs.includes('function restoreColumnPrefs()'), 'restore helper must exist');
        assert.ok(/persistColumnPrefs[\s\S]*?api\.setState/.test(prefs), 'persist must write to setState');
        assert.ok(/restoreColumnPrefs[\s\S]*?api\.getState/.test(prefs), 'restore must read from getState');
    });

    test('persists all four Columns toggles under columnPrefs', () => {
        const block = prefs.slice(
            prefs.indexOf('function persistColumnPrefs()'),
            prefs.indexOf('function restoreColumnPrefs()'),
        );
        assert.ok(block.includes('st.columnPrefs'), 'must store under columnPrefs key');
        for (const field of ['decoShowCounter', 'decoShowTimestamp', 'decoShowSessionElapsed', 'decoShowParsedTag']) {
            assert.ok(block.includes(field), `persist must include ${field}`);
        }
    });

    test('restore runs once at init, before any render', () => {
        // The bare call (not inside a function body) makes restore execute during the
        // initial synchronous script eval, ahead of the first renderViewport.
        assert.ok(/\nrestoreColumnPrefs\(\);/.test(prefs), 'restoreColumnPrefs() must be called at top level');
    });

    test('every Columns toggle persists after flipping its variable', () => {
        for (const fn of ['toggleLineNumbers', 'toggleTimestamp', 'toggleSessionElapsed', 'toggleParsedTag']) {
            const start = settings.indexOf(`function ${fn}()`);
            assert.ok(start >= 0, `${fn} must exist`);
            const body = settings.slice(start, settings.indexOf('}', start));
            assert.ok(body.includes('persistColumnPrefs()'), `${fn} must call persistColumnPrefs()`);
        }
    });

    test('onDecoOptionChange persists (panel checkboxes drive the same toggles)', () => {
        // onDecoOptionChange lives in the extracted sync module, not the main settings script.
        const start = sync.indexOf('function onDecoOptionChange()');
        assert.ok(start >= 0, 'onDecoOptionChange must exist');
        const body = sync.slice(start);
        assert.ok(body.includes('persistColumnPrefs()'), 'onDecoOptionChange must call persistColumnPrefs()');
    });
});
