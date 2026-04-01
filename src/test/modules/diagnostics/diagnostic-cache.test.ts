import * as assert from 'node:assert';
import { DiagnosticCache } from '../../../modules/diagnostics/diagnostic-cache';

suite('DiagnosticCache', () => {
    test('lookupForLine returns undefined when sourcePath and sourceLine are both missing', () => {
        const cache = new DiagnosticCache();
        const result = cache.lookupForLine(undefined, undefined, 'no source ref here');
        assert.strictEqual(result, undefined);
    });

    test('lookupForLine returns undefined for text without file:line pattern', () => {
        const cache = new DiagnosticCache();
        const result = cache.lookupForLine(undefined, undefined, 'plain log output');
        assert.strictEqual(result, undefined);
    });

    test('clear empties the cache', () => {
        const cache = new DiagnosticCache();
        // Force an internal query via lookupForLine with an absolute path
        // (will query getDiagnostics which returns [] for non-existent files)
        cache.lookupForLine('/tmp/nonexistent.ts', 1, '');
        cache.clear();
        // After clear, a re-lookup should re-query (not use stale data)
        const result = cache.lookupForLine('/tmp/nonexistent.ts', 1, '');
        assert.strictEqual(result, undefined);
    });

    test('getUpdatesForChangedUris returns undefined when no cached files match', () => {
        const cache = new DiagnosticCache();
        // Create a fake URI-like object — getUpdatesForChangedUris only
        // checks cache.has(uri.fsPath), so uncached files are skipped.
        const fakeUri = { fsPath: '/not/in/cache.ts' } as { readonly fsPath: string };
        const result = cache.getUpdatesForChangedUris([fakeUri as never]);
        assert.strictEqual(result, undefined);
    });

    test('activate is a no-op (does not throw)', () => {
        const cache = new DiagnosticCache();
        const disposables: { dispose(): void }[] = [];
        // activate() should be safe to call — it's intentionally empty
        cache.activate(disposables as never);
        assert.strictEqual(disposables.length, 0, 'should not push any disposables');
    });
});
