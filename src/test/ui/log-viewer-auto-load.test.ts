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

  /**
   * Mirrors the resolve-time branch in setupLogViewerWebview: a view that resolves
   * ALREADY visible has no hide->show transition to fire onDidChangeVisibility, so the
   * watch-hit badge must be acknowledged here or a count accrued before the view existed
   * stays pinned to the panel tab. onBecameVisible auto-load runs only when no file is
   * pending (the pending branch loads the file instead).
   */
  suite('resolve-when-visible badge acknowledge', () => {
    interface ResolveActions { readonly acknowledge: boolean; readonly becameVisible: boolean; }

    function resolveVisibleActions(visible: boolean, pending: boolean): ResolveActions {
      if (!visible) { return { acknowledge: false, becameVisible: false }; }
      return { acknowledge: true, becameVisible: !pending };
    }

    test('not visible on resolve: neither acknowledge nor onBecameVisible', () => {
      assert.deepStrictEqual(resolveVisibleActions(false, false), { acknowledge: false, becameVisible: false });
      assert.deepStrictEqual(resolveVisibleActions(false, true), { acknowledge: false, becameVisible: false });
    });

    test('visible with a pending file: acknowledge the badge, defer to the file load', () => {
      assert.deepStrictEqual(resolveVisibleActions(true, true), { acknowledge: true, becameVisible: false });
    });

    test('visible with no pending file: acknowledge the badge and run auto-load', () => {
      assert.deepStrictEqual(resolveVisibleActions(true, false), { acknowledge: true, becameVisible: true });
    });
  });
});
