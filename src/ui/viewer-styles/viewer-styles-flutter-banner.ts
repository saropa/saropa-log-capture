/**
 * CSS styles for Flutter exception banner grouping.
 *
 * Applied by viewer-data-helpers-render.ts when a line carries `bannerGroupId`.
 * Positional classes tint the rows so the block reads as one incident:
 *   .banner-group-start  — opening `════ Exception caught by … ════` line; also the collapse toggle
 *   .banner-group-mid    — body lines (assertion text, widget info, RenderFlex dump)
 *   .banner-group-end    — closing `════════…` rule
 *
 * Design intent: a faint error-toned background wash ONLY — no left accent rail
 * and no padding. An earlier 3px `border-left` rail (plus a matching rail on
 * error stack frames) was removed because it pushed every banner/stack row right
 * of the gutter grid, breaking column alignment with ordinary lines, and it was
 * redundant with the per-row severity dots/connectors that already mark the block
 * as error-level. The block is collapsed to its header by default (see
 * `bannerHeaderMap` in viewer-data-add-flutter-banner.ts); the tint on the
 * always-visible header signals an error incident the user can expand.
 */
export function getFlutterBannerStyles(): string {
    return /* css */ `

/* Faint error-toned wash so the incident reads as one block without a left rail. */
.banner-group-start,
.banner-group-mid,
.banner-group-end {
    background-color: color-mix(in srgb, var(--vscode-editorError-foreground, #f14c4c) 6%, transparent);
}
/* Header gets a stronger tint so the always-visible, collapsible title stands out. */
.banner-group-start {
    background-color: color-mix(in srgb, var(--vscode-editorError-foreground, #f14c4c) 12%, transparent);
}

/* Collapse disclosure triangle on the banner header. A bare symbol (▶ / ▼), so it
   needs no l10n; the whole header row is the click target (viewer-script-click-handlers.ts). */
.banner-chevron {
    display: inline-block;
    margin-right: 0.35em;
    color: var(--vscode-editorError-foreground, #f14c4c);
    cursor: pointer;
    user-select: none;
}

/* Decoration prefix on banner body/footer rows is redundant: the whole group
   emits in one frame so the timestamp equals the header's, and a per-row counter
   on a 50-line RenderFlex dump is noise. visibility: hidden keeps the
   .line-decoration span occupying its normal width so the .line:has(.line-decoration)
   column rule still applies and body message bodies stay column-aligned with the
   header. The counter still advances per file line number (idx-based) so Copy with
   decorations / Copy Error continue to produce correctly numbered output. */
.banner-group-mid > .line-decoration,
.banner-group-end > .line-decoration {
    visibility: hidden;
}
`;
}
