/**
 * Spec for the counter-row affordance: a single ▶ / ▼ chevron rendered
 * right of the line number on rows that own collapsible / expandable
 * hidden content. Replaces the prior between-row `.viewer-divider` pills
 * and trailing `.dedup-badge` chips, all of which had visual overlap or
 * tag-column collision problems.
 *
 * Each expand / collapse concept now wires through ONE click target —
 * `.deco-counter-row[data-affordance-kind]` — with the kind attribute
 * dispatching to the right peek / unpeek function:
 *   data-affordance-kind="dedup" → peekDedupFold / unpeekChevron
 *   data-affordance-kind="gap"   → peekChevron(from, to, 'filter')
 *   data-affordance-kind="peek"  → unpeekChevron(peekKey)
 *
 * Stack-headers keep their inline `.stack-toggle` because they have no
 * line-number prefix to host a counter-row chevron.
 */
import * as assert from "assert";
import { getPeekChevronScript } from "../../ui/viewer/viewer-peek-chevron";
import { getCounterAffordanceScript } from "../../ui/viewer/viewer-data-divider";
import { getViewerStyles } from "../../ui/viewer-styles/viewer-styles";

suite("Counter-row affordance — chevron right of the line number", () => {
    const aff = getCounterAffordanceScript();

    test("script defines getCounterAffordance + computeRowAffordances", () => {
        assert.ok(
            aff.includes("function getCounterAffordance("),
            "the affordance builder must be exported into the viewer script scope",
        );
        assert.ok(
            aff.includes("function computeRowAffordances("),
            "the per-row pre-pass that stamps _hiddenAfter / _triggeredPeekKey must exist",
        );
    });

    test("getCounterAffordance emits ▶ for collapsed states, ▼ for expanded", () => {
        // \\u25b6 = ▶ (collapsed), \\u25bc = ▼ (expanded). Same direction-
        // encodes-state convention as .stack-toggle on stack-headers.
        assert.ok(aff.includes("\\u25b6") && aff.includes("\\u25bc"), "both chevron glyphs must be present in the builder");
    });

    test("dedup branch wins when item.compressDupCount > 1", () => {
        assert.ok(
            aff.includes("item.compressDupCount > 1"),
            "dedup is the highest-priority affordance because the state is row-local",
        );
        assert.ok(
            aff.includes("data-dedup-survivor-idx"),
            "dedup chevron must carry the survivor idx so click routes to peekDedupFold",
        );
    });

    test("gap branch fires when item has _hiddenAfter stamped by the pre-pass", () => {
        assert.ok(
            aff.includes("hiddenAfter && hiddenAfter.count > 0"),
            "filter-hidden gap is the second-priority affordance",
        );
        assert.ok(
            aff.includes("data-hidden-from") && aff.includes("data-hidden-to"),
            "gap chevron must carry from/to so click routes to peekChevron(from, to)",
        );
    });

    test("peek branch fires when item triggered an expanded peek (▼ collapse)", () => {
        assert.ok(
            aff.includes("_triggeredPeekKey"),
            "the pre-pass stamps _triggeredPeekKey on the row that triggered a now-expanded peek",
        );
        assert.ok(
            aff.includes("data-peek-key"),
            "peek-collapse chevron must carry the key so click routes to unpeekChevron",
        );
    });

    test("clickable counter-row wraps the line-number digits AND the chevron", () => {
        // The whole numeric column is interactive so the user can aim at
        // either the digits or the small chevron — same action.
        assert.ok(
            aff.includes("deco-counter-row") && aff.includes("role=\"button\""),
            "wrapper carries role=button so the whole region reads as a click target to AT",
        );
        assert.ok(
            aff.includes("aria-expanded"),
            "wrapper sets aria-expanded so screen readers announce the toggle state",
        );
    });

    test("tooltip prepends the parsed tag when present so suppressed context is one hover away", () => {
        assert.ok(
            aff.includes("item.parsedTag"),
            "tooltip text must include the row's parsed tag (e.g. flutter, MediaSessionCompat) when one exists",
        );
    });

    test("computeRowAffordances clears stale stamps before re-scanning", () => {
        // Stamps must be regenerated on every render — filters toggle,
        // peeks open / close, lines stream in. Stale data would leave a
        // chevron pointing at content that no longer exists.
        assert.ok(
            aff.includes("_hiddenAfter") && aff.includes("= null"),
            "pre-pass must null out _hiddenAfter before recomputing",
        );
        assert.ok(
            aff.includes("_triggeredPeekKey"),
            "pre-pass must also clear/recompute _triggeredPeekKey each tick",
        );
    });
});

suite("Click delegate routes counter-row affordances by kind", () => {
    const peek = getPeekChevronScript();

    test("delegate scopes to .deco-counter-row by data-affordance-kind", () => {
        assert.ok(
            peek.includes("closest('.deco-counter-row[data-affordance-kind]')"),
            "handler must scope to the counter-row wrapper, not the chevron child, so line-number clicks count",
        );
    });

    test("'dedup' kind routes to peekDedupFold / unpeekChevron based on survivor.peekAnchorKey", () => {
        assert.ok(
            peek.includes("kind === 'dedup'") && peek.includes("peekDedupFold(idx)"),
            "collapsed dedup → peekDedupFold(idx)",
        );
        assert.ok(
            peek.includes("survivor.peekAnchorKey != null") && peek.includes("unpeekChevron(survivor.peekAnchorKey)"),
            "expanded dedup → unpeekChevron(survivor's peek key)",
        );
    });

    test("'gap' kind routes to peekChevron(from, to, 'filter')", () => {
        assert.ok(
            peek.includes("kind === 'gap'"),
            "filter-hidden gap kind must have its own branch",
        );
        assert.ok(
            peek.includes("peekChevron(from, to, 'filter')"),
            "gap click must call peekChevron with the filter kind so calcItemHeight bypasses filter gates",
        );
    });

    test("'peek' kind routes to unpeekChevron(peekKey)", () => {
        assert.ok(
            peek.includes("kind === 'peek'"),
            "peek-collapse kind must have its own branch",
        );
        assert.ok(
            peek.includes("unpeekChevron(peekKey)"),
            "peek click on the trigger row must collapse via the stamped peek key",
        );
    });

    test("shift-click is left alone so range selection still works", () => {
        // viewer-copy.ts uses shift-click for multi-row selection. The
        // delegate must not consume those events.
        assert.ok(
            peek.includes("if (e.shiftKey) return"),
            "delegate must short-circuit on shift-click",
        );
    });
});

suite("Counter-row CSS — clickable line-number column", () => {
    const css = getViewerStyles();

    test(".deco-counter-row is the clickable container, .deco-chevron is the glyph", () => {
        assert.ok(css.includes(".deco-counter-row"), "wrapper rule must exist");
        assert.ok(css.includes(".deco-chevron"), "chevron child rule must exist");
    });

    test(".deco-counter-row has cursor: pointer and a hover state", () => {
        // The whole region must read as interactive at rest, and the hover
        // affordance gives the user visual feedback the click is live.
        assert.ok(
            /\.deco-counter-row\s*\{[^}]*cursor:\s*pointer/.test(css),
            "wrapper must declare cursor: pointer",
        );
        assert.ok(
            /\.deco-counter-row:hover/.test(css),
            "wrapper must have a hover rule (background tint or chevron lift)",
        );
    });

    test(".deco-chevron is dimmed at rest, lifts on counter-row hover", () => {
        assert.ok(
            /\.deco-chevron\s*\{[^}]*opacity:\s*0\.5/.test(css),
            "chevron must sit at ~0.5 opacity at rest so it reads as a quiet marker on the number",
        );
        assert.ok(
            css.includes(".deco-counter-row:hover .deco-chevron") || css.includes(".deco-counter-row:focus-visible .deco-chevron"),
            "hover/focus on the wrapper must lift the chevron to full opacity",
        );
    });

    test("retired affordances do NOT have CSS rules — no .viewer-divider or .dedup-badge", () => {
        // The new design replaces both with .deco-counter-row + .deco-chevron.
        // Re-introducing either would recreate the overlap / floating-pill
        // visual problems the user reported.
        assert.ok(
            !css.includes(".viewer-divider"),
            ".viewer-divider rule must be removed — between-row dividers caused overlap with adjacent rows' tag chips",
        );
        assert.ok(
            !css.includes(".dedup-badge"),
            ".dedup-badge rule must be removed — trailing pill was replaced by the counter-row chevron",
        );
    });

    test(".stack-toggle survives for stack-header rows (no line-number prefix to host counter-row)", () => {
        assert.ok(
            css.includes(".stack-toggle"),
            "stack-headers keep their inline chevron because they have no decoration prefix",
        );
    });
});
