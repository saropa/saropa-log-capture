import * as assert from 'assert';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { findSidecarUris } from '../../../modules/context/context-loader';

/**
 * Integration test for findSidecarUris.
 *
 * Uses a real temp directory because findSidecarUris calls vscode.workspace.fs
 * directly (no dep injection) — mocking would require intercepting the VS Code
 * API. Each test mints a unique subdir so tests are isolated even if run in
 * parallel.
 */

/** Create a fresh, uniquely-named temp directory for one test. */
async function makeTempDir(): Promise<vscode.Uri> {
    const dir = vscode.Uri.file(path.join(os.tmpdir(), `slc-sidecar-${Date.now()}-${Math.random().toString(36).slice(2)}`));
    await vscode.workspace.fs.createDirectory(dir);
    return dir;
}

/** Write an empty file under `dir` with the given name. */
async function touch(dir: vscode.Uri, name: string): Promise<vscode.Uri> {
    const uri = vscode.Uri.joinPath(dir, name);
    await vscode.workspace.fs.writeFile(uri, new Uint8Array(0));
    return uri;
}

/** Extract the filename (basename) from a URI for assertions. */
function baseNameOf(uri: vscode.Uri): string {
    return uri.fsPath.split(/[\\/]/).pop() ?? '';
}

suite('findSidecarUris', () => {

    test('should NOT include the primary .log itself as a sidecar', async () => {
        // Reproduces the user-visible bug: findSidecarUris walked for files starting with
        // `<baseName>.` and ending with `.log`. The primary itself matched that pattern
        // (e.g. `20260421_160343_contacts.log` starts with `20260421_160343_contacts.`),
        // so the viewer re-loaded it through the external-sidecar path and showed duplicate
        // rows with the raw `[HH:MM:SS.mmm] [category]` prefix visible in the body.
        const dir = await makeTempDir();
        const primary = await touch(dir, '20260421_160343_contacts.log');
        await touch(dir, '20260421_160343_contacts.logcat.log');

        const sidecars = await findSidecarUris(primary);
        const names = sidecars.map(baseNameOf);

        assert.ok(
            !names.includes('20260421_160343_contacts.log'),
            `primary must not appear in sidecar list, got: ${names.join(', ')}`,
        );
    });

    test('should still discover genuine sidecar .log files', async () => {
        // Guard against over-correction: the fix must not drop legitimate sidecars.
        const dir = await makeTempDir();
        const primary = await touch(dir, 'session.log');
        await touch(dir, 'session.logcat.log');
        await touch(dir, 'session.drift-advisor.log');

        const sidecars = await findSidecarUris(primary);
        const names = sidecars.map(baseNameOf);

        assert.ok(names.includes('session.logcat.log'), `expected logcat sidecar, got: ${names.join(', ')}`);
        assert.ok(names.includes('session.drift-advisor.log'), `expected drift-advisor sidecar, got: ${names.join(', ')}`);
    });

    test('should include .terminal.log exactly once (no duplicate from dir scan)', async () => {
        // `.terminal.log` is a first-class SIDECAR_TYPES entry, so the fixed-suffix loop adds it.
        // The directory-scan pass then explicitly excludes it (via terminalSuffix) to prevent
        // a second push of the same URI. This test locks that single-entry guarantee in.
        const dir = await makeTempDir();
        const primary = await touch(dir, 'app.log');
        await touch(dir, 'app.terminal.log');

        const sidecars = await findSidecarUris(primary);
        const terminalMatches = sidecars.map(baseNameOf).filter((n) => n === 'app.terminal.log');

        assert.strictEqual(terminalMatches.length, 1, `terminal sidecar should appear exactly once, got ${terminalMatches.length}`);
    });
});
