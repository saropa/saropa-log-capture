import * as assert from 'node:assert';
import { isUntouched } from '../../../modules/screenshot/screenshot-dedup-default-notice';

/**
 * `isUntouched` is what makes the one-time default-change notice fire ONLY for someone the flip
 * actually changed behavior for — it has to tell "resolved to the schema default" apart from
 * "explicitly chose the value the schema default happens to match", which a plain `get()` cannot
 * do. These pin that distinction directly against the plain shape `inspect()` returns, no Extension
 * Host required.
 */
suite('skipNearDuplicates default-change notice', () => {

    test('should stay silent (NOT untouched) when inspect() itself returns undefined', () => {
        // Not expected for a real registered setting, but if VS Code ever can't inspect this key at
        // all, "cannot determine whether it was touched" must fail toward silence, not a notice that
        // might be wrong — the opposite of every other branch in this function.
        assert.strictEqual(isUntouched(undefined), false);
    });

    test('should read as untouched when every scope is undefined', () => {
        assert.strictEqual(isUntouched({}), true);
        assert.strictEqual(isUntouched({
            globalValue: undefined, workspaceValue: undefined, workspaceFolderValue: undefined,
        }), true);
    });

    test('should read as TOUCHED when the user set it at the user (global) scope', () => {
        // The case that must never re-fire the notice: a user who chose `false` before the flip.
        assert.strictEqual(isUntouched({ globalValue: false }), false);
        // And a user who happened to explicitly choose the same value the new default is.
        assert.strictEqual(isUntouched({ globalValue: true }), false);
    });

    test('should read as TOUCHED when set at workspace scope', () => {
        assert.strictEqual(isUntouched({ workspaceValue: true }), false);
    });

    test('should read as TOUCHED when set at workspace-folder scope', () => {
        assert.strictEqual(isUntouched({ workspaceFolderValue: false }), false);
    });

    test('should read as TOUCHED when ANY scope is set, even alongside untouched ones', () => {
        // Only one scope needs to carry an explicit value for this to count as touched — the reader
        // never has to know WHICH scope VS Code resolved from, only whether any of them fired.
        assert.strictEqual(isUntouched({
            globalValue: undefined, workspaceValue: true, workspaceFolderValue: undefined,
        }), false);
    });
});
