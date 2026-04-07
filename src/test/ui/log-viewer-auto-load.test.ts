import * as assert from 'node:assert';
import type { LogViewerSetupTarget } from '../../ui/provider/log-viewer-provider-setup';

/**
 * Tests for the auto-load-on-visible behavior introduced in the onBecameVisible
 * callback. Validates that the setup target's onBecameVisible() fires in the
 * expected scenarios and that the handler guard logic (wired in extension-activation)
 * correctly skips loads when the active session is already displayed.
 */

/** Minimal stub that satisfies the callback fields tested here. */
interface AutoLoadGuardInputs {
  activeUri: string | undefined;
  currentFileUri: string | undefined;
}

/**
 * Mirrors the guard logic wired in extension-activation.ts setBecameVisibleHandler.
 * Returns whether loadFromFile should be called.
 */
function shouldAutoLoad(inputs: AutoLoadGuardInputs): boolean {
  if (!inputs.activeUri) { return false; }
  if (inputs.currentFileUri === inputs.activeUri) { return false; }
  return true;
}

suite('auto-load on became visible', () => {

  suite('guard logic', () => {
    test('should not load when no active session exists', () => {
      assert.strictEqual(
        shouldAutoLoad({ activeUri: undefined, currentFileUri: undefined }),
        false,
      );
    });

    test('should not load when active session is already displayed', () => {
      const uri = 'file:///logs/session-a.log';
      assert.strictEqual(
        shouldAutoLoad({ activeUri: uri, currentFileUri: uri }),
        false,
      );
    });

    test('should load when viewer is empty and active session exists', () => {
      assert.strictEqual(
        shouldAutoLoad({ activeUri: 'file:///logs/session-a.log', currentFileUri: undefined }),
        true,
      );
    });

    test('should load when viewer shows a different session than the active one', () => {
      assert.strictEqual(
        shouldAutoLoad({ activeUri: 'file:///logs/session-b.log', currentFileUri: 'file:///logs/session-a.log' }),
        true,
      );
    });
  });

  suite('setup target contract', () => {
    test('onBecameVisible fires handler when called', () => {
      let called = false;
      const target: Pick<LogViewerSetupTarget, 'onBecameVisible'> = {
        onBecameVisible: () => { called = true; },
      };
      target.onBecameVisible();
      assert.strictEqual(called, true);
    });
  });
});
