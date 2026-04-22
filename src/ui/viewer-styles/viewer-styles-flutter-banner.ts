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
`;
}
