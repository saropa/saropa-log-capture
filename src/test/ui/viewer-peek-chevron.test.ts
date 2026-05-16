/**
 * Spec for the counter-row affordance: a single ▶ / ▼ chevron rendered
 * right of the line number on rows that own collapsible / expandable
 * hidden content. Replaces the prior between-row `.viewer-divider` pills,
 * trailing `.dedup-badge` chips, AND the inline `.stack-toggle` chevron
 * on stack-header rows, all of which had visual overlap, tag-column
 * collision, or mid-row clutter problems.
 *
 * Each expand / collapse concept wires through ONE click target —
 * `.deco-counter-row[data-affordance-kind]` — with the kind attribute
 * dispatching to the right peek / unpeek function:
 *   data-affordance-kind="dedup" → peekDedupFold / unpeekChevron
 *   data-affordance-kind="stack" → toggleStackGroup(gid)
 *   data-affordance-kind="gap"   → peekChevron(from, to, 'filter')
 *   data-affordance-kind="peek"  → unpeekChevron(peekKey)
 *
 * Stack toggle priority: when a log line's next visible row is a multi-
 * frame stack-header, the chevron on the log line owns the trace's
 * collapse state — the stack-header itself renders as plain text.
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

    test("stack branch fires on multi-frame stack-header rows themselves", () => {
        // The chevron lives on the stack-header row's own line number,
        // not on the previous log line. Clicking the line number OR the
        // chevron toggles the trace via toggleStackGroup(item.groupId).
        assert.ok(
            aff.includes("item.type === 'stack-header' && item.frameCount > 1"),
            "stack branch must fire when the row IS a multi-frame stack-header",
        );
        assert.ok(
            aff.includes("data-stack-gid"),
            "stack chevron must carry the group id so click routes to toggleStackGroup",
        );
        assert.ok(
            aff.includes("item.collapsed === false"),
            "chevron must flip to ▼ only when the header is FULLY expanded — preview state stays ▶",
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

    test("rows without any affordance still emit an empty .deco-chevron spacer", () => {
        // The chevron span renders even when no action applies so the
        // line-number column width stays identical row-to-row. Without
        // this spacer, rows with a chevron would sit ~0.9em wider than
        // rows without and the numeric column would zig-zag.
        assert.ok(
            /if\s*\(!kind\)\s*\{[^}]*return\s+counterHtml\s*\+\s*chev/.test(aff),
            "no-affordance branch must return counterHtml + empty chev so column alignment matches",
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

    test("'stack' kind routes to toggleStackGroup(gid)", () => {
        assert.ok(
            peek.includes("kind === 'stack'"),
            "stack kind must have its own branch in the delegate",
        );
        assert.ok(
            peek.includes("toggleStackGroup(stackGid)"),
            "stack click on the previous-line chevron must toggle the trace via its gid",
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

    test(".stack-toggle is fully retired — toggle moved to previous-line counter-row chevron", () => {
        // The inline ▶ stack chip used to clutter the middle of the
        // stack-header row. The user moves expansion control onto the
        // line above (the log line that emitted the trace) via
        // data-affordance-kind="stack".
        assert.ok(
            !css.includes(".stack-toggle"),
            "no .stack-toggle CSS rule should remain — counter-row stack-kind affordance replaces it",
        );
    });
});
