/**
 * CSS styles for Flutter exception banner grouping.
 *
 * Applied by viewer-data-helpers-render.ts when a line carries `bannerGroupId`.
 * Three positional classes connect the rows into a single visual block:
 *   .banner-group-start  — opening `════ Exception caught by … ════` line
 *   .banner-group-mid    — body lines (assertion text, widget info, RenderFlex dump)
 *   .banner-group-end    — closing `════════…` rule
 *
 * Design intent: left accent border + subtle background tint so the block reads
 * as one incident even when tens of body lines scroll past. Uses the standard
 * VS Code error token (--vscode-editorError-foreground) so the tint matches
 * other error decorations (dots, bars, gutter marks).
 */
export function getFlutterBannerStyles(): string {
    return /* css */ `

/* ===================================================================
   Flutter Exception Banner Group
   Connects the full \`════ Exception caught by … ════\` block into one
   cohesive visual band. No collapse interaction — the block is always
   expanded so stack-like RenderFlex dumps stay readable.
   =================================================================== */
.banner-group-start,
.banner-group-mid,
.banner-group-end {
    /* Left accent rail in the error tone. The existing level-bar-error
       decoration is a dot, not a continuous line — this rail joins all
       group members even on lines without their own severity bar. */
    border-left: 3px solid var(--vscode-editorError-foreground, #f14c4c);
    /* Faint wash so the block stays legible against editor background. */
    background-color: color-mix(in srgb, var(--vscode-editorError-foreground, #f14c4c) 6%, transparent);
    /* Pull content right so text doesn't crash into the accent rail. */
    padding-left: 6px;
}
.banner-group-start {
    /* Round top edge to signal the block's start. */
    border-top-left-radius: 4px;
    border-top-right-radius: 4px;
    /* Header gets a subtly stronger tint so the title stands out. */
    background-color: color-mix(in srgb, var(--vscode-editorError-foreground, #f14c4c) 12%, transparent);
}
.banner-group-end {
    border-bottom-left-radius: 4px;
    border-bottom-right-radius: 4px;
}

/* Continue the incident's error rail through the stack trace. Stack frames are
   consumed before the banner classifier (so they form a collapsible group, not
   banner-body lines) and therefore never carry a banner-group-* class — without
   this the 3px rail stops at the banner text and restarts nowhere, so the
   grouping bar looks broken across the frames. Scoped to .level-bar-error so the
   rail only appears when the severity bar is on (barCls is gated on decoShowBar)
   and never paints on a non-error trace.
   border-left ONLY — deliberately no padding-left: the decoration-column rules
   (.line:has(.line-decoration) / .line-deco-spacer-only) are specificity (0,2,0),
   tied with these selectors, so a padding-left here would race them and could
   collapse the 14.25em content column to 6px. The 3px border is purely additive
   and shifts the frame text by the same 3px the banner body rows already shift,
   so stack text stays column-aligned with the banner text.
   Side effect (intended): a standalone error stack with no Flutter banner also
   gains the rail — a continuous error spine is correct there too. */
.stack-header.level-bar-error,
.line.stack-line.level-bar-error {
    border-left: 3px solid var(--vscode-editorError-foreground, #f14c4c);
}

/* Severity-dot tightening inside banner-group rows.
   WHY: the default dot sits at left: 0.74em (≈12px) measured from the .line
   padding edge, which on a banner-group row is the INNER edge of the 3px red
   rail. That left ≈12px gap reads as a misaligned stripe — the rail and the
   dotted severity column look like two competing left-side guides instead of
   one continuous spine. Pulling left to 0.15em closes the gap to ≈2-3px so
   the rail visually flows through the dots. The matching connector ::after is
   re-centered under the pulled-in dot in the rule below. */
.banner-group-start[class*="level-bar-"]::before,
.banner-group-mid[class*="level-bar-"]::before,
.banner-group-end[class*="level-bar-"]::before {
    left: 0.15em;
}
/* Pull the chain connector under the rail (0.30em) for the WHOLE incident —
   banner body rows AND the error stack rows that now carry the rail. This must
   out-specify the default chain connector in viewer-styles-decoration-bars.ts
   (.level-bar-error:not(:is(...)):has(+ .level-bar-error)::after = specificity
   0,3,1); the earlier .banner-group-*[class*="level-bar-"]::after rule was only
   0,2,1 and silently lost, leaving the banner stripe stranded at the default
   0.89em. Adding :has(+ .level-bar-error) here lifts the .line.stack-line
   selectors to 0,4,1 (win outright) and the .banner-group-* / .stack-header
   selectors to 0,3,1 (tie the default, win on source order — these styles are
   concatenated last). The :has guard also matches the default's "only paint when
   the next row shares the level" behavior, so the last row of a run still
   terminates cleanly. Only the left offset is overridden; width/top/bottom/
   background continue to come from the default rule.
   0.30em centers the 0.14em stripe under the 0.44em dot pulled to 0.15em
   (dot center = 0.15 + 0.44/2 = 0.37em → stripe left = 0.37 - 0.14/2 = 0.30em). */
.banner-group-start.level-bar-error:has(+ .level-bar-error)::after,
.banner-group-mid.level-bar-error:has(+ .level-bar-error)::after,
.banner-group-end.level-bar-error:has(+ .level-bar-error)::after,
.stack-header.level-bar-error:has(+ .level-bar-error)::after,
.line.stack-line.level-bar-error:has(+ .level-bar-error)::after {
    left: 0.30em;
}

/* Decoration prefix on banner body/footer rows is redundant:
   the entire group emits in the same frame so the timestamp is identical to
   the header's, and the per-row counter on a 50-line RenderFlex dump adds
   noise without information. visibility: hidden keeps the .line-decoration
   span occupying its normal width so the .line:has(.line-decoration) rule
   still applies (preserving the 14.25em padding-left + hanging-indent), and
   the message body of every body/footer row stays column-aligned with the
   header's message body. The counter still advances per file line number
   (idx-based) so Copy with decorations and Copy Error continue to produce
   correctly numbered output. */
.banner-group-mid > .line-decoration,
.banner-group-end > .line-decoration {
    visibility: hidden;
}
`;
}
