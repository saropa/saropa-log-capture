import * as assert from 'assert';
import {
  buildKeyToAction,
  getDefaultKeyToAction,
  getViewerActionLabel,
  normalizeKeyDescriptor,
  VIEWER_KEYBINDING_ACTION_IDS,
} from '../../ui/viewer/viewer-keybindings';

suite('ViewerKeybindings', () => {

  suite('normalizeKeyDescriptor', () => {
    test('lowercases and orders modifiers', () => {
      assert.strictEqual(normalizeKeyDescriptor('Ctrl+Shift+F'), 'ctrl+shift+f');
      assert.strictEqual(normalizeKeyDescriptor('Meta+Alt+A'), 'ctrl+alt+a');
    });
    test('normalizes space and special keys', () => {
      assert.strictEqual(normalizeKeyDescriptor('Space'), 'space');
      assert.strictEqual(normalizeKeyDescriptor('Escape'), 'escape');
    });
    test('single key', () => {
      assert.strictEqual(normalizeKeyDescriptor('m'), 'm');
      assert.strictEqual(normalizeKeyDescriptor('M'), 'm');
    });
  });

  suite('getDefaultKeyToAction', () => {
    test('returns key -> actionId map with f3 for openSearch', () => {
      const map = getDefaultKeyToAction();
      assert.strictEqual(map['ctrl+f'], 'openSearch');
      assert.strictEqual(map['f3'], 'openSearch');
      assert.strictEqual(map['space'], 'togglePause');
      assert.strictEqual(map['m'], 'insertMarker');
    });
    test('all action IDs have exactly one default key (or f3 alias)', () => {
      const map = getDefaultKeyToAction();
      const actions = new Set(Object.values(map));
      assert.ok(actions.size >= VIEWER_KEYBINDING_ACTION_IDS.length, 'every action has a key');
    });
    test('copyRaw is bound to ctrl+alt+c by default', () => {
      const map = getDefaultKeyToAction();
      assert.strictEqual(map['ctrl+alt+c'], 'copyRaw');
    });
  });

  test('VIEWER_KEYBINDING_ACTION_IDS includes copyRaw', () => {
    assert.ok(
      (VIEWER_KEYBINDING_ACTION_IDS as readonly string[]).includes('copyRaw'),
      'copyRaw must be a registered action ID',
    );
  });

  suite('buildKeyToAction', () => {
    test('empty user config returns defaults plus f3', () => {
      const map = buildKeyToAction(undefined);
      assert.strictEqual(map['space'], 'togglePause');
      assert.strictEqual(map['f3'], 'openSearch');
    });
    test('user override replaces default', () => {
      const map = buildKeyToAction({ togglePause: 'x' });
      assert.strictEqual(map['x'], 'togglePause');
      assert.strictEqual(map['space'], undefined);
    });
    test('invalid action IDs are ignored', () => {
      const map = buildKeyToAction({ unknownAction: 'x', togglePause: 'x' } as Record<string, string>);
      assert.strictEqual(map['x'], 'togglePause');
    });
    test('empty key is ignored', () => {
      const map = buildKeyToAction({ togglePause: '   ' });
      assert.strictEqual(map['space'], 'togglePause');
    });
  });

  suite('getViewerActionLabel', () => {
    test('returns label for known action', () => {
      assert.strictEqual(getViewerActionLabel('togglePause'), 'Toggle pause');
      assert.strictEqual(getViewerActionLabel('openSearch'), 'Focus log search');
      assert.strictEqual(getViewerActionLabel('copyRaw'), 'Copy as raw text');
    });
    test('returns actionId for unknown', () => {
      assert.strictEqual(getViewerActionLabel('unknown'), 'unknown');
    });
  });
});
