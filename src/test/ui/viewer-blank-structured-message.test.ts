import * as assert from 'node:assert';
import * as vm from 'node:vm';
import { getViewerDataHelpersCore } from '../../ui/viewer/viewer-data-helpers-core';
import { getStructuredLineParserScript } from '../../ui/viewer/viewer-structured-line-parser';
import { getDecoContentScript } from '../../ui/viewer-decorations/viewer-deco-content';
import { getLineBirthScript } from '../../ui/viewer/viewer-data-add-line-birth';

/**
 * Regression: a structured log line whose message body is empty must be treated as a blank row.
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
 * Builds the real parser + calcItemHeight + buildDecoParts in a VM (no DOM, no vscode).
 */
const EMPTY_LOGCAT = '[10:43:00.243] [logcat] 07-10 08:23:05.388   924 17991 W keystore2:';
const NORMAL_LOGCAT = '[10:43:00.243] [logcat] 07-10 08:23:05.361  1894  4273 D ActivityManager: sync unfroze 22484';
/** sda-log format: "[tag] hh:mm:ss msg" — an empty msg collapses too. See the SCOPE note on isLineContentBlank. */
const EMPTY_SDA = '[db] 08:23:05.388 ';
/** A tag carrying '&' — html-escaped to &amp;, which stripTags decodes and stripHtmlPrefix counts as one char. */
const ENTITY_TAG_LOGCAT = '07-10 08:23:05.388   924 17991 W Foo&Bar: real message survives';

const QUARTER = Math.max(4, Math.floor(20 / 4));

interface Ctx extends Record<string, unknown> {
  structuredLineParsing: boolean;
  parseStructuredPrefix(plain: string, formatId: string | null): { prefixLen: number; tag: string; msg: string } | null;
  isLineContentBlank(item: Record<string, unknown>): boolean;
  calcItemHeight(item: Record<string, unknown>): number;
  buildDecoParts(item: Record<string, unknown>, idx: number, hiddenAfter: unknown): { key: string }[];
  getDecorationCells(item: Record<string, unknown>, idx: number, hiddenAfter: unknown): string;
  computeLineBirthHeight(...a: unknown[]): number;
}

function build(): Ctx {
  /* stripTags is the REAL one from viewer-script.ts: it decodes exactly the five entities
     escapeHtml emits. The entity test below depends on that symmetry, so a naive stub
     that skips decoding would make the test vacuous. */
  const prelude = /* javascript */ `
var ROW_HEIGHT=20,MARKER_HEIGHT=28,RUN_SEPARATOR_HEIGHT=72,logFontSize=12;
var fileMode='log',formatEnabled=false,decoShowCounter=false,decoShowTimestamp=false;
var decoShowSessionElapsed=false,sessionStartTs=null,allLines=[];
function stripTags(html){
    var s=(html==null?'':String(html)).replace(/<[^>]*>/g,'');
    return s.replace(/&#39;/g,"'").replace(/&quot;/g,'"').replace(/&gt;/g,'>').replace(/&lt;/g,'<').replace(/&amp;/g,'&');
}
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

/** Mirror escapeHtml (escape-html-script.ts) — addToData stores escaped html, not raw text. */
function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** Build the line item the way addToData does: html is escaped, the parser runs on stripTags(html). */
function itemFor(ctx: Ctx, rawText: string): Record<string, unknown> {
  const html = escapeHtml(rawText);
  const plain = (ctx.stripTags as (h: string) => string)(html);
  const slp = ctx.parseStructuredPrefix(plain, null);
  assert.ok(slp, 'structured parser must match this line: ' + rawText);
  return {
    html, type: 'line', level: 'warning',
    structuredPrefixLen: slp!.prefixLen, parsedTag: slp!.tag,
  };
}

suite('Empty-message structured rows render as blanks, not tag-only rows', () => {
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
    assert.strictEqual(ctx.calcItemHeight(itemFor(ctx, EMPTY_LOGCAT)), QUARTER);
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
    assert.strictEqual(born, QUARTER, 'born at quarter height, so it never flashes full-height before recalc');
  });

  /* The collapse is deliberately format-agnostic: any structured line that renders no text
     collapses and loses its tag chip. Pinned here so a later reader does not "fix" sda-log
     back to a full-height tag-only row. */
  test('an empty-message sda-log line collapses too, losing its tag chip', () => {
    const ctx = build();
    const empty = itemFor(ctx, EMPTY_SDA);
    assert.strictEqual(ctx.isLineContentBlank(empty), true, 'sda-log with no message is blank');
    assert.strictEqual(ctx.calcItemHeight(empty), QUARTER);
    assert.strictEqual(ctx.buildDecoParts(empty, 0, null).length, 0, 'the [db] chip is dropped with the row');
  });

  /* Turning structured parsing off must un-blank the row: renderItem then shows the raw
     line, so isLineContentBlank must stop stripping even though structuredPrefixLen is
     still stored on the item. The two must never disagree about what is on screen. */
  test('with structured parsing off, the empty-message row is full-height raw text', () => {
    const ctx = build();
    const empty = itemFor(ctx, EMPTY_LOGCAT);
    ctx.structuredLineParsing = false;
    assert.strictEqual(ctx.isLineContentBlank(empty), false, 'the raw line has visible text');
    assert.strictEqual(ctx.calcItemHeight(empty), 20, 'full height when nothing is stripped');
    assert.ok(
      ctx.buildDecoParts(empty, 0, null).length >= 0,
      'decoration parts are computed without throwing',
    );
  });

  /* prefixLen is counted on stripTags(html) (entities decoded, 1 char each) while
     stripHtmlPrefix walks the escaped html counting each &entity; as 1 visible char.
     A tag containing '&' exercises that symmetry: if it desynced, the strip would eat
     into the message and report a false blank. */
  test('an html entity inside the prefix does not over-strip the message', () => {
    const ctx = build();
    const item = itemFor(ctx, ENTITY_TAG_LOGCAT);
    assert.strictEqual(item.parsedTag, 'Foo&Bar', 'the parser sees the decoded tag');
    assert.ok(String(item.html).includes('&amp;'), 'the stored html really is escaped');
    assert.strictEqual(ctx.isLineContentBlank(item), false, 'the message must survive the strip');
    assert.strictEqual(ctx.calcItemHeight(item), 20);
  });
});
