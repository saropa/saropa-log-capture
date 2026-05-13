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

/* Severity-dot tightening inside banner-group rows.
   WHY: the default dot sits at left: 0.74em (≈12px) measured from the .line
   padding edge, which on a banner-group row is the INNER edge of the 3px red
   rail. That left ≈12px gap reads as a misaligned stripe — the rail and the
   dotted severity column look like two competing left-side guides instead of
   one continuous spine. Pulling left to 0.15em closes the gap to ≈2-3px so
   the rail visually flows through the dots.
   Connector ::after width is 0.14em; re-centering it under the pulled-in dot
   (dot center = 0.15em + 0.44em/2 = 0.37em → connector left = 0.37 - 0.07 = 0.30em)
   prevents the bar-up / bar-down stub from looking offset from the dot it joins. */
.banner-group-start[class*="level-bar-"]::before,
.banner-group-mid[class*="level-bar-"]::before,
.banner-group-end[class*="level-bar-"]::before {
    left: 0.15em;
}
.banner-group-start.bar-down::after,
.banner-group-mid.bar-down::after,
.banner-group-end.bar-down::after,
.banner-group-start.bar-up::after,
.banner-group-mid.bar-up::after,
.banner-group-end.bar-up::after {
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
