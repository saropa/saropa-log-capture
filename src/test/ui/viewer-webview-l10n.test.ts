/**
 * Tests for the webview localization bridge (full-sweep infra).
 *
 * Behavioral: eval the injected script and exercise the client-side vt() helper
 * — template substitution and the fail-soft fallback. Wiring: the bridge is
 * injected into the assembled script tags so every render script can resolve a
 * localized template.
 */
import * as assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { getWebviewL10nScript } from '../../ui/provider/viewer-l10n-inject';
import { getViewerScriptTags } from '../../ui/provider/viewer-content-scripts';
import { getWebviewL10nMap } from '../../l10n';

/** Walk up from the compiled test dir to the repo root (has package.json AND src/ui). */
function findRepoRoot(): string {
    let dir = __dirname;
    for (let i = 0; i < 8; i++) {
        if (fs.existsSync(path.join(dir, 'package.json')) && fs.existsSync(path.join(dir, 'src', 'ui'))) {
            return dir;
        }
        dir = path.dirname(dir);
    }
    throw new Error('repo root not found from ' + __dirname);
}

/** All .ts files under a directory, recursively. */
function collectTsFiles(dir: string, out: string[] = []): string[] {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) { collectTsFiles(full, out); }
        else if (entry.isFile() && full.endsWith('.ts')) { out.push(full); }
    }
    return out;
}

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

    // Regression guard: vt() has no host fallback — `vt('x')` returns the literal key 'x' when 'x'
    // is absent from the __VT map (built only from strings-webview*.ts). Keys authored in HOST
    // strings files (strings-viewer-*.ts) are invisible to the client, so any vt() call referencing
    // one renders the raw key to users in every language. This shipped for the Crashlytics
    // "Repetitive"/"Regressed" badges and three Session Info actions; this test statically scans
    // every vt('key') call site so a misplaced key fails CI instead of reaching users.
    test('every static vt() key used in src/ui exists in the __VT map', () => {
        const map = getWebviewL10nMap();
        const uiDir = path.join(findRepoRoot(), 'src', 'ui');
        const keyRe = /\bvt\(\s*['"]([a-zA-Z0-9_.]+)['"]/g;
        const missing = new Set<string>();
        for (const file of collectTsFiles(uiDir)) {
            const text = fs.readFileSync(file, 'utf8');
            let m: RegExpExecArray | null;
            while ((m = keyRe.exec(text)) !== null) {
                if (!(m[1] in map)) { missing.add(m[1]); }
            }
        }
        assert.deepStrictEqual(
            [...missing].sort(),
            [],
            'vt() keys missing from the webview __VT map (they would render their raw key to users). '
            + 'Move each into a strings-webview*.ts file — host strings files are not in the webview map.',
        );
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
