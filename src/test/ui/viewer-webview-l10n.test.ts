/**
 * Tests for the webview localization bridge (full-sweep infra).
 *
 * Behavioral: eval the injected script and exercise the client-side vt() helper
 * — template substitution and the fail-soft fallback. Wiring: the bridge is
 * injected into the assembled script tags so every render script can resolve a
 * localized template.
 */
import * as assert from 'node:assert';
import { getWebviewL10nScript } from '../../ui/provider/viewer-l10n-inject';
import { getViewerScriptTags } from '../../ui/provider/viewer-content-scripts';
import { getWebviewL10nMap } from '../../l10n';

suite('Webview localization bridge', () => {

    function loadVt(): (key: string, ...args: (string | number)[]) => string {
        const factory = new Function(getWebviewL10nScript() + '\nreturn vt;');
        return factory();
    }

    test('script ships the __VT map and a vt() helper', () => {
        const s = getWebviewL10nScript();
        assert.ok(s.includes('var __VT ='), 'must define the __VT translation map');
        assert.ok(s.includes('function vt('), 'must define the vt() lookup helper');
    });

    test('map carries the registered webview keys', () => {
        const map = getWebviewL10nMap();
        assert.strictEqual(map['viewer.treeHeader.single'], 'Render tree');
        // Placeholders are left intact for client-side substitution.
        assert.ok(/\{0\}/.test(map['viewer.stackHeader.collapsed']), '{0} placeholder must survive into the map');
    });

    test('vt() substitutes positional args and falls back to the key', () => {
        const vt = loadVt();
        assert.strictEqual(vt('viewer.treeHeader.single'), 'Render tree');
        assert.strictEqual(
            vt('viewer.stackHeader.collapsed', 5),
            'Stack trace collapsed · 5 frames · click to expand',
        );
        // Fail-soft: an unknown key returns itself, never blank or a thrown error.
        assert.strictEqual(vt('no.such.key'), 'no.such.key');
    });

    test('bridge is injected ahead of the render scripts', () => {
        const tags = getViewerScriptTags({ nonce: 'test-nonce', viewerMaxLines: 1000 });
        const vtAt = tags.indexOf('function vt(');
        const renderAt = tags.indexOf('renderStackHeader');
        assert.ok(vtAt >= 0, 'vt() must be present in the assembled scripts');
        assert.ok(renderAt >= 0, 'render scripts must be present');
        assert.ok(vtAt < renderAt, 'vt() must be defined before the render scripts that call it');
    });

});
