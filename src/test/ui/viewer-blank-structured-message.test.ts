import * as assert from 'node:assert';
import * as vm from 'node:vm';
import { getViewerDataHelpersCore } from '../../ui/viewer/viewer-data-helpers-core';
import { getStructuredLineParserScript } from '../../ui/viewer/viewer-structured-line-parser';
import { getDecoContentScript } from '../../ui/viewer-decorations/viewer-deco-content';
import { getLineBirthScript } from '../../ui/viewer/viewer-data-add-line-birth';

/**
 * Regression: a logcat line whose message body is empty must be treated as a blank row.
 *
 * Real capture (Android keystore2 warns with no message):
 *     [10:43:00.243] [logcat] 07-10 08:23:05.388   924 17991 W keystore2:
 *
 * parseStructuredPrefix matches logcat-threadtime with msg = '', so prefixLen spans the
 * WHOLE line and renderItem strips all of it — the row displays nothing. Before the fix,
 * isLineContentBlank tested the unstripped item.html, so the row was measured at full
 * ROW_HEIGHT, kept its parsed-tag chip (a tag-only row with no text), and remained a legal
 * anchor for the filter-hidden-gap reveal chevron.
 *
 * Builds the real parser + calcItemHeight + getDecorationCells in a VM (no DOM, no vscode).
 */
const EMPTY_LOGCAT = '[10:43:00.243] [logcat] 07-10 08:23:05.388   924 17991 W keystore2:';
const NORMAL_LOGCAT = '[10:43:00.243] [logcat] 07-10 08:23:05.361  1894  4273 D ActivityManager: sync unfroze 22484';

interface Ctx extends Record<string, unknown> {
  parseStructuredPrefix(plain: string, formatId: string | null): { prefixLen: number; tag: string; msg: string } | null;
  isLineContentBlank(item: Record<string, unknown>): boolean;
  calcItemHeight(item: Record<string, unknown>): number;
  buildDecoParts(item: Record<string, unknown>, idx: number, hiddenAfter: unknown): { key: string }[];
  getDecorationCells(item: Record<string, unknown>, idx: number, hiddenAfter: unknown): string;
  computeLineBirthHeight(...a: unknown[]): number;
}

function build(): Ctx {
  const prelude = /* javascript */ `
var ROW_HEIGHT=20,MARKER_HEIGHT=28,RUN_SEPARATOR_HEIGHT=72,logFontSize=12;
var fileMode='log',formatEnabled=false,decoShowCounter=false,decoShowTimestamp=false;
var decoShowSessionElapsed=false,sessionStartTs=null,allLines=[];
function stripTags(h){return (h==null?'':String(h)).replace(/<[^>]*>/g,'');}
function areDecorationsOn(){return true;}
function calcLevelFiltered(){return false;}
function getCounterDigitsForLayout(){return 5;}
`;
  const code = prelude + getStructuredLineParserScript() + getViewerDataHelpersCore()
    + getDecoContentScript() + getLineBirthScript();
  const ctx = vm.createContext({ console, vt: (k: string) => k }) as Ctx;
  vm.runInContext(code, ctx, { filename: 'blank-structured.js', timeout: 10_000 });
  return ctx;
}

/** Build the line item the way addToData does, from the real parser output. */
function itemFor(ctx: Ctx, text: string): Record<string, unknown> {
  const slp = ctx.parseStructuredPrefix(text, null);
  assert.ok(slp, 'structured parser must match this logcat line: ' + text);
  return {
    html: text, type: 'line', level: 'warning',
    structuredPrefixLen: slp!.prefixLen, parsedTag: slp!.tag,
  };
}

suite('Empty-message logcat rows render as blanks, not tag-only rows', () => {
  test('a logcat line with no message body is content-blank', () => {
    const ctx = build();
    assert.strictEqual(ctx.isLineContentBlank(itemFor(ctx, EMPTY_LOGCAT)), true);
  });

  test('a logcat line with a real message is NOT content-blank', () => {
    const ctx = build();
    assert.strictEqual(ctx.isLineContentBlank(itemFor(ctx, NORMAL_LOGCAT)), false);
  });

  test('the empty-message row collapses to quarter height', () => {
    const ctx = build();
    const quarter = Math.max(4, Math.floor(20 / 4));
    assert.strictEqual(ctx.calcItemHeight(itemFor(ctx, EMPTY_LOGCAT)), quarter);
    assert.strictEqual(ctx.calcItemHeight(itemFor(ctx, NORMAL_LOGCAT)), 20);
  });

  test('the empty-message row emits no decoration cells — no tag-only row', () => {
    const ctx = build();
    const empty = itemFor(ctx, EMPTY_LOGCAT);
    // Arrays cross the VM realm boundary with a foreign prototype, so compare length,
    // not deepStrictEqual (which compares prototypes and would fail on an equal array).
    assert.strictEqual(ctx.buildDecoParts(empty, 0, null).length, 0, 'no decoration parts');
    assert.strictEqual(
      ctx.getDecorationCells(empty, 0, null), '',
      'a row with no text must not render its parsed-tag chip',
    );

    const normal = itemFor(ctx, NORMAL_LOGCAT);
    assert.ok(
      ctx.buildDecoParts(normal, 0, null).some((c) => c.key === 'tag'),
      'a row WITH text still shows its parsed-tag chip',
    );
    assert.ok(
      ctx.getDecorationCells(normal, 0, null).includes('ActivityManager'),
      'the tag chip carries the parsed tag name',
    );
  });

  test('birth height matches calcItemHeight for the empty-message row', () => {
    const ctx = build();
    const slp = ctx.parseStructuredPrefix(EMPTY_LOGCAT, null);
    // computeLineBirthHeight(html, errSup, tierHidden, classHidden, catFilt, lvl, scopeFilt, autoHidden, flowTag, spLen)
    const born = ctx.computeLineBirthHeight(
      EMPTY_LOGCAT, false, false, false, false, 'warning', false, false, null, slp!.prefixLen,
    );
    assert.strictEqual(born, 5, 'born at quarter height, so it never flashes full-height before recalc');
  });
});
