import * as assert from 'node:assert';
import * as vm from 'node:vm';
import { getRunNavScript } from '../../ui/viewer-nav/viewer-run-nav';
import { getViewerDataHelpersRender } from '../../ui/viewer/viewer-data-helpers-render';

/**
 * The green "App started" divider the run-nav script inserts into the feed at the launch line
 * (firstLaunchLineIndex + insertAppStartMarker). Runs the script in a DOM-stubbed VM: it only
 * wires listeners on stub elements at load, then the insertion functions are exercised directly.
 */
function stubEl(): Record<string, unknown> {
  return {
    addEventListener: () => undefined,
    classList: { add: () => undefined, remove: () => undefined, contains: () => false },
    disabled: false,
    textContent: '',
  };
}

function buildRunNavCtx(): Record<string, unknown> {
  const ctx = vm.createContext({
    allLines: [], totalHeight: 0, MARKER_HEIGHT: 28, prefixSums: [],
    vt: (key: string) => key,
    buildPrefixSums: () => undefined,
    renderViewport: () => undefined,
    document: { getElementById: () => stubEl() },
    logEl: { addEventListener: () => undefined, scrollTop: 0 },
    Number, Math, console,
  }) as Record<string, unknown>;
  vm.runInContext(getRunNavScript(), ctx, { filename: 'run-nav.js' });
  return ctx;
}

suite('Run nav — the green app-start divider', () => {
  test('firstLaunchLineIndex returns the first launch boundary, ignoring restarts/reloads', () => {
    const ctx = buildRunNavCtx();
    const f = ctx.firstLaunchLineIndex as (b: unknown) => number;
    assert.strictEqual(f([{ kind: 'hot_reload', lineIndex: 2 }, { kind: 'launch', lineIndex: 5 }]), 5, 'skips the earlier reload');
    assert.strictEqual(f([{ kind: 'hot_restart', lineIndex: 3 }]), -1, 'no launch line -> none');
    assert.strictEqual(f(null), -1, 'no boundaries -> none');
  });

  test('insertAppStartMarker inserts one marker at the launch line and shifts run indices', () => {
    const ctx = buildRunNavCtx();
    // Launch is content line 1; a later run starts at line 3.
    ctx.allLines = [
      { type: 'line', level: 'info', timestamp: 10 },
      { type: 'line', level: 'info', rawText: 'Launching', timestamp: 20 },
      { type: 'line', level: 'error', timestamp: 30 },
      { type: 'line', level: 'info', timestamp: 40 },
    ];
    ctx.runStartIndices = [1, 3];
    ctx.totalHeight = 0;
    (ctx.insertAppStartMarker as (n: number) => void)(1);

    const lines = ctx.allLines as Array<Record<string, unknown>>;
    assert.strictEqual(lines.length, 5, 'one divider added');
    assert.strictEqual(lines[1].type, 'marker', 'a marker sits at the launch line');
    assert.strictEqual(lines[1].appStart, true, 'flagged as the app-start divider');
    assert.strictEqual(lines[2].rawText, 'Launching', 'the launch line shifted one down');
    assert.deepStrictEqual(ctx.runStartIndices, [2, 4], 'run-start indices shift with the insertion');
    assert.strictEqual(ctx.totalHeight, 28, 'total height grew by MARKER_HEIGHT');
  });

  test('insertAppStartMarker is idempotent and a no-op when there is no launch', () => {
    const ctx = buildRunNavCtx();
    ctx.allLines = [
      { type: 'line', level: 'info', rawText: 'Launching', timestamp: 20 },
      { type: 'line', level: 'error', timestamp: 30 },
    ];
    ctx.runStartIndices = [0];
    (ctx.insertAppStartMarker as (n: number) => void)(0);
    (ctx.insertAppStartMarker as (n: number) => void)(0); // second call must not add a second divider
    assert.strictEqual((ctx.allLines as unknown[]).length, 3, 'exactly one divider after two calls');

    // No launch line -> firstLaunchLineIndex is -1 -> nothing inserted.
    const fresh = buildRunNavCtx();
    fresh.allLines = [{ type: 'line', level: 'info', timestamp: 10 }];
    (fresh.insertAppStartMarker as (n: number) => void)(-1);
    assert.strictEqual((fresh.allLines as unknown[]).length, 1, 'no divider without a launch line');
  });

  test('the marker render branch tags an app-start marker with the green app-start-marker class', () => {
    // renderItem is a string-building embed; assert the marker branch adds the class when
    // item.appStart, so the inserted divider renders solid green rather than a faint marker.
    const chunk = getViewerDataHelpersRender();
    assert.ok(chunk.includes('item.appStart'), 'the marker branch reads item.appStart');
    assert.ok(chunk.includes('app-start-marker'), 'and emits the app-start-marker class');
  });
});
