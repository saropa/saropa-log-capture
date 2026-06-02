/**
 * Regression tests for muted decoration/link styling AND for the
 * virtualized-row ghost-paint defenses (CSS + viewport renderer). The two
 * groups share a file because both are about preventing a future cleanup
 * from removing rules whose purpose is non-obvious from the diff alone.
 *
 * Decorations (counter, timestamp, elapsed, separator) and clickable links
 * (source-link, url-link) must render in grey (editorLineNumber token) so
 * they visually recede behind severity-coloured log content. Links reveal
 * their blue colour only on hover.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { getDecorationStyles } from "../../ui/viewer-styles/viewer-styles-decoration";
import { getLineStyles } from "../../ui/viewer-styles/viewer-styles-lines";
import { getViewportRenderScript } from "../../ui/viewer/viewer-data-viewport";

// --- Decoration prefix ---

test("decoration prefix uses editorLineNumber grey, not inherited level color", () => {
  const css = getDecorationStyles();
  assert.match(
    css,
    /\.line-decoration\s*\{[^}]*editorLineNumber-foreground/s,
    ".line-decoration must set color to editorLineNumber token",
  );
});

test("decoration prefix does not use opacity hack", () => {
  const css = getDecorationStyles();
  const rule = css.match(/\.line-decoration\s*\{[^}]*\}/s)?.[0] ?? "";
  assert.ok(
    !rule.includes("opacity"),
    ".line-decoration should not set opacity (explicit color replaces opacity)",
  );
});

test("no standalone deco-counter color rule (parent handles it)", () => {
  const css = getDecorationStyles();
  // Match the bare `.deco-counter` class only. A plain substring check also
  // matches `.deco-counter-row` (the legitimate collapse-affordance wrapper
  // from getCollapseControlStyles), giving a false failure. The negative
  // lookahead `(?![\w-])` rejects any continuation char, so `.deco-counter-row`
  // and a future `.deco-counterX` are excluded while a real standalone
  // `.deco-counter {`, `.deco-counter:hover`, or `.deco-counter,` still trips.
  assert.ok(
    !/\.deco-counter(?![\w-])/.test(css),
    ".deco-counter rule should be removed — parent .line-decoration sets the grey",
  );
});

// --- Source file links ---

test("source-link defaults to grey, not blue", () => {
  const css = getLineStyles();
  assert.match(
    css,
    /\.source-link\s*\{[^}]*editorLineNumber-foreground/s,
    ".source-link must default to editorLineNumber grey",
  );
});

test("source-link reveals blue on hover", () => {
  const css = getLineStyles();
  assert.match(
    css,
    /\.source-link:hover\s*\{[^}]*textLink-foreground/s,
    ".source-link:hover must switch to textLink blue",
  );
});

// --- URL links ---

test("url-link defaults to grey, not blue", () => {
  const css = getLineStyles();
  assert.match(
    css,
    /\.url-link\s*\{[^}]*editorLineNumber-foreground/s,
    ".url-link must default to editorLineNumber grey",
  );
});

test("url-link reveals blue on hover", () => {
  const css = getLineStyles();
  assert.match(
    css,
    /\.url-link:hover\s*\{[^}]*textLink-foreground/s,
    ".url-link:hover must switch to textLink blue",
  );
});

// --- Recent-error-context border ---

// --- Compositor-layer isolation on every row ---

test(".line, .stack-header carry transform: translateZ(0) for compositor isolation", () => {
  /* Without this, Chromium can leave un-invalidated paint inside a virtualized
     row slot when the slot is recycled (e.g. level-info → level-database via
     innerHTML replace), so faint pixels of the previous row's text ghost
     through the new text until a :hover repaint clears the layer. The fix is
     per-row compositor promotion; pinning it here so a future "drop the
     transform — it looks redundant next to isolation: isolate" cleanup is
     caught (the two do different things: isolation is stacking-context only). */
  const css = getLineStyles();
  const rule = css.match(/\.line,\s*\.stack-header\s*\{[^}]*\}/s)?.[0] ?? "";
  assert.ok(
    rule.length > 0,
    ".line, .stack-header base rule must exist",
  );
  assert.ok(
    /transform:\s*translateZ\(0\)/.test(rule),
    ".line, .stack-header must declare transform: translateZ(0) to prevent stale-pixel ghosting on virtualized row recycle",
  );
});

test(".line, .stack-header carry opaque background to obscure recycled-slot ghost pixels", () => {
  /* Attempt #1 (transform: translateZ(0)) shipped in v7.17.0 was empirically
     insufficient on the user's machine — they still saw "DRIFT: Drift debug
     server disconnected" rendered with prior info-row blue text ghosting
     through. Attempt #2 adds an opaque fill rect on every row, painted
     before the text content, so any stale pixels Chromium leaves in the
     recycled slot are physically covered. Same color as the editor parent
     so the row looks identical, but the browser DOES rasterize the fill —
     which is the point. Pinning so a future "rows have no background — why
     is this here?" cleanup is caught. See
     plans/history/2026.06/2026.06.02/viewer-row-paint-ghosting-attempts.md. */
  const css = getLineStyles();
  const rule = css.match(/\.line,\s*\.stack-header\s*\{[^}]*\}/s)?.[0] ?? "";
  assert.ok(
    /background:\s*var\(--vscode-editor-background\)/.test(rule),
    ".line, .stack-header must declare background: var(--vscode-editor-background) to physically obscure ghost pixels left by Chromium's paint cache on virtualized row recycle",
  );
});

test("renderViewport swaps DOM via <template> + replaceChildren/appendChild, never via innerHTML on the live viewport", () => {
  /* Attempt #3 of the ghost-paint fix (attempts #1 transform: translateZ(0)
     and #2 opaque background documented in viewer-styles-lines.ts and
     plans/history/2026.06/2026.06.02/viewer-row-paint-ghosting-attempts.md). The innerHTML setter takes a
     Chromium fast path that can reuse prior child paint records for a slot;
     attempts #1 and #2 layer compositor/paint defenses on top of that, but
     the deterministic fix is to detach + dispose every prior child via
     replaceChildren() and attach a fresh DocumentFragment so the new row
     has no paint-cache lineage with whatever previously occupied the slot.

     This test guards against a future "let's go back to innerHTML for perf"
     cleanup — replaceChildren has slightly more overhead but is the load-
     bearing defense, the perf difference is negligible at ~50 visible rows,
     and reverting it would silently re-open the ghost-paint regression. */
  const js = getViewportRenderScript();
  assert.ok(
    /viewportEl\.replaceChildren\(\)/.test(js),
    "renderViewport must clear the live viewport with replaceChildren() before attaching the new fragment",
  );
  assert.ok(
    /viewportEl\.appendChild\(\s*_vTmpl\.content\s*\)/.test(js),
    "renderViewport must attach the new rows via appendChild(template.content) so the fragment moves in one atomic operation",
  );
  assert.ok(
    !/viewportEl\.innerHTML\s*=/.test(js),
    "renderViewport must NOT assign to viewportEl.innerHTML — that path can reuse prior paint records and was the original source of the ghost-pixel bug",
  );
});

test("recent-error-context uses box-shadow, not border-left (no layout shift)", () => {
  const css = getLineStyles();
  const rule = css.match(/\.line\.recent-error-context\s*\{[^}]*\}/s)?.[0] ?? "";
  /* Before this fix, the rule used border-left + padding-left: 5px, which
     overrode the base 1.85em left padding and shifted content leftward when
     decorations were off.  box-shadow avoids layout participation entirely. */
  assert.ok(
    rule.includes("box-shadow"),
    ".line.recent-error-context must use box-shadow for the left indicator",
  );
  assert.ok(
    !rule.includes("border-left"),
    ".line.recent-error-context must not use border-left (causes layout shift)",
  );
  assert.ok(
    !rule.includes("padding-left"),
    ".line.recent-error-context must not override padding-left (causes content shift)",
  );
});
