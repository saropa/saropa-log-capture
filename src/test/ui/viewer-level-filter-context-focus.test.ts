/**
 * Regression for BUG_Log_viewer_issues.md — "turned OFF Performance and it only DIMMED the
 * perf lines". applyLevelFilter's ±contextLinesBefore reveal used to fire whenever ANY level
 * was disabled, so excluding one level (7/8 still on) re-revealed that level's lines as dimmed
 * CONTEXT around still-shown neighbors instead of hiding them. The fix gates the context reveal
 * on a FOCUSED selection (shown levels are a minority); excluding one/two levels now hides
 * cleanly, while soloing / narrowing to a few levels still gets its context window.
 *
 * Runs the real applyLevelFilter in a VM with the surrounding level-filter script, stubbing the
 * DOM/host bridge it touches for indicator sync and persistence.
 */
import * as assert from 'node:assert';
import * as vm from 'node:vm';
import { getLevelFilterScript } from '../../ui/viewer-search-filter/viewer-level-filter';

interface Row { type: string; level: string; levelFiltered?: boolean; isContext?: boolean; height?: number; }

function loadFilter(rows: Row[], enabled: string[], context: number): Record<string, unknown> {
  const domStub = {
    getElementById: () => null,
    querySelectorAll: () => [],
    querySelector: () => null,
    body: { classList: { toggle: () => undefined } },
  };
  const prelude = /* javascript */ `
var allLines = [];
var contextLinesBefore = 0;
var recalcCalls = 0;
function recalcAndRender() { recalcCalls++; }
function recalcHeights() {}
function renderViewport() {}
function markPresetDirty() {}
function stripTags(h){return (h==null?'':String(h)).replace(/<[^>]*>/g,'');}
var vscodeApi = { postMessage: function(){}, getState: function(){return {};}, setState: function(){} };
`;
  const windowStub = { addEventListener: () => undefined, removeEventListener: () => undefined };
  const ctx = vm.createContext({ console, document: domStub, window: windowStub, vt: (k: string) => k }) as Record<string, unknown>;
  vm.runInContext(prelude + getLevelFilterScript(), ctx, { filename: 'level-filter-focus.js', timeout: 10_000 });
  (ctx as { allLines: Row[] }).allLines = rows;
  (ctx as { enabledLevels: Set<string> }).enabledLevels = new Set(enabled);
  (ctx as { contextLinesBefore: number }).contextLinesBefore = context;
  (ctx.applyLevelFilter as () => void)();
  return ctx;
}

// Alternating info / performance lines — every perf line sits directly beside an info line, the
// worst case for the old context reveal (each perf line is within 1 row of a shown info line).
const ALT_ROWS = (): Row[] => [
  { type: 'line', level: 'info' },
  { type: 'line', level: 'performance' },
  { type: 'line', level: 'info' },
  { type: 'line', level: 'performance' },
  { type: 'line', level: 'info' },
  { type: 'line', level: 'performance' },
];

suite('level-filter context reveal is gated to focus mode', () => {
  test('excluding one level (7/8 on) hides its lines — never re-revealed as dimmed context', () => {
    const rows = ALT_ROWS();
    loadFilter(rows, ['error', 'warning', 'info', 'todo', 'notice', 'debug', 'database'], 3); // performance OFF
    for (const r of rows.filter((x) => x.level === 'performance')) {
      assert.strictEqual(r.levelFiltered, true, 'perf line must be filtered (hidden) when Performance is off');
      assert.notStrictEqual(r.isContext, true, 'perf line must NOT come back as dimmed context');
    }
    for (const r of rows.filter((x) => x.level === 'info')) {
      assert.strictEqual(r.levelFiltered, false, 'still-enabled info lines stay visible');
    }
  });

  test('focused selection (solo errors) still reveals surrounding lines as context', () => {
    const rows: Row[] = [
      { type: 'line', level: 'info' },
      { type: 'line', level: 'error' },
      { type: 'line', level: 'info' },
    ];
    loadFilter(rows, ['error'], 3); // 1/8 enabled — focus mode
    assert.strictEqual(rows[1].levelFiltered, false, 'the error stays visible');
    assert.strictEqual(rows[0].levelFiltered, false, 'the preceding info line is revealed as context');
    assert.strictEqual(rows[0].isContext, true, 'and is marked isContext so it renders dimmed');
  });

  test('narrowing to a few levels (<= half) keeps context; excluding a couple does not', () => {
    // 3/8 enabled counts as focused (<= 4): context reveal active.
    const focusedRows: Row[] = [{ type: 'line', level: 'debug' }, { type: 'line', level: 'error' }];
    loadFilter(focusedRows, ['error', 'warning', 'database'], 3);
    assert.strictEqual(focusedRows[0].isContext, true, '3/8 enabled is focus mode — debug neighbor revealed as context');

    // 6/8 enabled is NOT focused: the two disabled levels hide cleanly.
    const looseRows: Row[] = [{ type: 'line', level: 'debug' }, { type: 'line', level: 'error' }];
    loadFilter(looseRows, ['error', 'warning', 'info', 'todo', 'notice', 'database'], 3);
    assert.strictEqual(looseRows[0].levelFiltered, true, '6/8 enabled — disabled debug line stays hidden');
    assert.notStrictEqual(looseRows[0].isContext, true, 'not re-revealed as context');
  });
});
