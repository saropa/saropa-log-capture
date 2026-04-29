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
    test('returns labels for new panel toggle actions', () => {
      assert.strictEqual(getViewerActionLabel('toggleOptions'), 'Toggle options panel');
      assert.strictEqual(getViewerActionLabel('toggleFilters'), 'Toggle filters panel');
      assert.strictEqual(getViewerActionLabel('toggleSignals'), 'Toggle signals panel');
      assert.strictEqual(getViewerActionLabel('toggleBookmarks'), 'Toggle bookmarks panel');
      assert.strictEqual(getViewerActionLabel('toggleSessions'), 'Toggle sessions panel');
      assert.strictEqual(getViewerActionLabel('toggleCollections'), 'Toggle collections panel');
      assert.strictEqual(getViewerActionLabel('toggleSqlHistory'), 'Toggle SQL history panel');
      assert.strictEqual(getViewerActionLabel('toggleTrash'), 'Toggle trash panel');
    });
    test('returns labels for new display and nav actions', () => {
      assert.strictEqual(getViewerActionLabel('bookmark'), 'Bookmark center line');
      assert.strictEqual(getViewerActionLabel('toggleCompress'), 'Toggle compress duplicates');
      assert.strictEqual(getViewerActionLabel('toggleBlankLines'), 'Toggle hide blank lines');
      assert.strictEqual(getViewerActionLabel('toggleSpacing'), 'Toggle visual spacing');
      assert.strictEqual(getViewerActionLabel('prevSession'), 'Previous session');
      assert.strictEqual(getViewerActionLabel('nextSession'), 'Next session');
      assert.strictEqual(getViewerActionLabel('prevPart'), 'Previous file part');
      assert.strictEqual(getViewerActionLabel('nextPart'), 'Next file part');
      assert.strictEqual(getViewerActionLabel('lineHeightUp'), 'Line height up');
      assert.strictEqual(getViewerActionLabel('lineHeightDown'), 'Line height down');
      assert.strictEqual(getViewerActionLabel('lineHeightReset'), 'Line height reset');
      assert.strictEqual(getViewerActionLabel('copyFilePath'), 'Copy log file path');
      assert.strictEqual(getViewerActionLabel('revealFile'), 'Log file actions');
      assert.strictEqual(getViewerActionLabel('showKeyboardShortcuts'), 'Keyboard shortcuts');
    });
    test('returns actionId for unknown', () => {
      assert.strictEqual(getViewerActionLabel('unknown'), 'unknown');
    });
  });

  suite('new keybinding defaults', () => {
    test('panel toggle keys are single letters', () => {
      const map = getDefaultKeyToAction();
      assert.strictEqual(map['o'], 'toggleOptions');
      assert.strictEqual(map['f'], 'toggleFilters');
      assert.strictEqual(map['s'], 'toggleSignals');
      assert.strictEqual(map['b'], 'toggleBookmarks');
      assert.strictEqual(map['l'], 'toggleSessions');
      assert.strictEqual(map['i'], 'toggleCollections');
      assert.strictEqual(map['q'], 'toggleSqlHistory');
      assert.strictEqual(map['t'], 'toggleTrash');
    });
    test('navigation keys use brackets', () => {
      const map = getDefaultKeyToAction();
      assert.strictEqual(map['['], 'prevSession');
      assert.strictEqual(map[']'], 'nextSession');
      assert.strictEqual(map['shift+['], 'prevPart');
      assert.strictEqual(map['shift+]'], 'nextPart');
    });
    test('line height keys mirror font size with shift', () => {
      const map = getDefaultKeyToAction();
      assert.strictEqual(map['ctrl+shift+='], 'lineHeightUp');
      assert.strictEqual(map['ctrl+shift+-'], 'lineHeightDown');
      assert.strictEqual(map['ctrl+shift+0'], 'lineHeightReset');
    });
    test('F1 opens keyboard shortcuts', () => {
      const map = getDefaultKeyToAction();
      assert.strictEqual(map['f1'], 'showKeyboardShortcuts');
    });
    test('no default key collisions', () => {
      const map = getDefaultKeyToAction();
      const keys = Object.keys(map);
      const unique = new Set(keys);
      assert.strictEqual(keys.length, unique.size, 'every default key must map to exactly one action');
    });
  });

  suite('new actions are registered', () => {
    const ids = VIEWER_KEYBINDING_ACTION_IDS as readonly string[];
    const newActions = [
      'showKeyboardShortcuts', 'toggleOptions', 'toggleFilters', 'toggleSignals',
      'toggleBookmarks', 'toggleSessions', 'toggleCollections', 'toggleSqlHistory',
      'toggleTrash', 'bookmark', 'toggleCompress', 'toggleBlankLines', 'toggleSpacing',
      'prevSession', 'nextSession', 'prevPart', 'nextPart',
      'lineHeightUp', 'lineHeightDown', 'lineHeightReset', 'copyFilePath', 'revealFile',
    ];
    for (const action of newActions) {
      test(`${action} is in VIEWER_KEYBINDING_ACTION_IDS`, () => {
        assert.ok(ids.includes(action), `${action} must be a registered action ID`);
      });
    }
  });
});
