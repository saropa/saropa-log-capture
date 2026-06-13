import * as assert from 'assert';
import * as vscode from 'vscode';
import { isWithinDir } from '../../../modules/export/slc-collection';

// Zip-Slip guard: importCollectionFromSlc builds the write target with vscode.Uri.joinPath(logDir,
// name), where `name` comes from the untrusted bundle manifest/entry. joinPath normalizes `..`, so a
// crafted entry can resolve outside logDir — an arbitrary file write reachable via the import deep
// link. isWithinDir is the boundary that must reject every such escape before any write.
suite('slc-collection — Zip-Slip containment (isWithinDir)', () => {
    const logDir = vscode.Uri.file('/work/reports');

    test('accepts a file directly inside the log directory', () => {
        assert.strictEqual(isWithinDir(logDir, vscode.Uri.joinPath(logDir, 'session.log')), true);
    });

    test('accepts a file in a nested subdirectory of the log directory', () => {
        assert.strictEqual(isWithinDir(logDir, vscode.Uri.joinPath(logDir, '20260613/session.log')), true);
    });

    test('rejects a parent-traversal escape (the Zip-Slip payload)', () => {
        // joinPath normalizes the `..`, landing the target outside logDir.
        assert.strictEqual(isWithinDir(logDir, vscode.Uri.joinPath(logDir, '../../../evil.txt')), false);
    });

    test('rejects the log directory itself (a file is never the dir)', () => {
        assert.strictEqual(isWithinDir(logDir, logDir), false);
    });

    test('rejects an unrelated sibling directory', () => {
        assert.strictEqual(isWithinDir(logDir, vscode.Uri.file('/work/reports-evil/x.log')), false);
    });
});
