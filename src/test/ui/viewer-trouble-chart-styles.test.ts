import * as assert from 'node:assert';
import { getTroubleChartStyles } from '../../ui/viewer-styles/viewer-styles-trouble-chart';

/**
 * Trouble Mode severity chart — the two style contracts that carry user-visible meaning.
 *
 * CSS is normally left to the eye, but these two rules encode decisions that a later
 * "tidy-up" edit reverses without anyone noticing until the chart ships wrong:
 *
 *  1. The collapse caret must NOT inherit the head row's 10px label size. At 10px the
 *     glyph reads as a stray pixel rather than a control, and it is the only affordance
 *     announcing that the chart can be put away. It is sized from the type scale
 *     (--text-h3), not a literal, so the scale stays the single source of truth.
 *  2. The plot frame is THREE-sided. A top border would close it into a box and imply a
 *     ceiling the bars are measured against; the scale is the running peak, which moves.
 *
 * Both assertions are deliberately keyed to the declaration, not to a pixel value — the
 * point is that the caret is scale-sized and the frame is open at the top, whatever the
 * scale currently says.
 */

/** The block of declarations for one selector, or '' when the selector is absent. */
function ruleBody(css: string, selector: string): string {
  const at = css.indexOf(selector + ' {');
  if (at < 0) { return ''; }
  const open = css.indexOf('{', at);
  const close = css.indexOf('}', open);
  return close < 0 ? '' : css.slice(open + 1, close);
}

suite('Trouble Mode severity chart styles', () => {
  test('the collapse caret is sized from the type scale, not the 10px head-row label size', () => {
    const toggle = ruleBody(getTroubleChartStyles(), '.trouble-chart .tc-toggle');

    assert.ok(toggle.length > 0, 'the .tc-toggle rule must exist');
    assert.match(toggle, /font-size:\s*var\(--text-h3\)/, 'caret size must come from the type scale');
    assert.doesNotMatch(toggle, /font-size:\s*\d/, 'a literal px size would drift from the scale');
  });

  test('the caret cancels the head row uppercase letter-spacing so the glyph stays centered', () => {
    const toggle = ruleBody(getTroubleChartStyles(), '.trouble-chart .tc-toggle');

    assert.match(toggle, /letter-spacing:\s*normal/);
  });

  test('the plot frame is open at the top: left, right, and bottom borders only', () => {
    const plot = ruleBody(getTroubleChartStyles(), '.trouble-chart .tc-plot');

    assert.ok(plot.length > 0, 'the .tc-plot rule must exist');
    assert.match(plot, /border-left:\s*1px solid var\(--border\)/);
    assert.match(plot, /border-right:\s*1px solid var\(--border\)/);
    assert.match(plot, /border-bottom:\s*1px solid var\(--border\)/);
    // A bare `border:` shorthand would also paint the top — reject it alongside border-top.
    assert.doesNotMatch(plot, /border-top:/, 'a top border implies a ceiling the bars are not scaled to');
    assert.doesNotMatch(plot, /\bborder:\s/, 'the border shorthand would close the frame at the top');
  });

  test('the frame is drawn on the plot, so the baseline sits under the bars and above the clock labels', () => {
    const css = getTroubleChartStyles();

    // .tc-plot wraps the <svg> alone; .tc-axis is its sibling. Were the frame moved to the
    // body wrapper, the baseline would draw beneath the time labels instead of the bars.
    assert.doesNotMatch(ruleBody(css, '.trouble-chart-body'), /border-/);
    assert.doesNotMatch(ruleBody(css, '.trouble-chart .tc-axis'), /border-/);
  });
});
