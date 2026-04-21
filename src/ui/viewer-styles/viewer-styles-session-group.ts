/**
 * Session-group styles for the Logs panel.
 *
 * Renders the auto-group feature (see bugs/auto-group-related-sessions.md):
 *   - `.session-group` wraps consecutive rows that share a `groupId`.
 *   - The primary row carries a chevron + "+N" badge indicating the group.
 *   - Secondary rows sit with a left indent and a muted tether line so the
 *     eye reads them as children of the primary.
 *   - Hovering any row dims the sibling rows' background (CSS-only cascade
 *     via the group container's :hover) while the hovered row itself keeps
 *     the standard strong hover colour.
 *   - Collapsed groups hide their secondary rows and swap the chevron glyph.
 */

export function getSessionGroupStyles(): string {
    return /* css */ `

/* --- Session group wrapper ---
   The container absorbs sibling hover so that mousing over one row tints
   every member of the group. Background is kept transparent by default so
   date-heading contrast is preserved. */
.session-group {
    background: transparent;
}

/* Shared-hover cascade. When any row inside the group is hovered, every
   .session-item inside that same group gets a soft dim. The more specific
   :hover selector on the actual row still wins, giving it the stronger
   vscode-list-hoverBackground colour. */
.session-group:hover .session-item {
    background: var(--vscode-list-inactiveSelectionBackground, rgba(128, 128, 128, 0.08));
}
.session-group .session-item:hover {
    background: var(--vscode-list-hoverBackground);
}

/* --- Primary row (always visible, carries group chrome) --- */
.session-group .session-item-primary .session-item-icon {
    /* Keep space for the chevron that precedes the icon. */
    padding-left: 0;
}

/* Chevron next to the icon on the primary row. Uses the same codicon pattern
   as the day-heading chevron so visual consistency is explicit. */
.session-group-chevron {
    display: inline-flex;
    align-items: center;
    width: 16px;
    margin-right: 2px;
    flex-shrink: 0;
    cursor: pointer;
    color: var(--vscode-icon-foreground);
    opacity: 0.85;
}
.session-group-chevron:hover {
    opacity: 1;
}

/* The "+N" badge on the primary row. Mirrors .session-day-count so it reads
   as part of the Logs panel's existing count vocabulary. */
.session-group-count {
    margin-left: 4px;
    color: var(--vscode-descriptionForeground);
    font-size: 0.85em;
    font-weight: normal;
    white-space: nowrap;
}

/* --- Secondary rows --- */
.session-group .session-item-secondary {
    /* Step the whole row in so the eye reads it as a child of the primary. */
    padding-left: 28px;
    position: relative;
}
.session-group .session-item-secondary::before {
    /* Left-edge tether: a 1px rule that runs down the secondary's left side.
       Positioned absolutely so it extends to the row's full height regardless
       of content, and sits in the indent gap without taking layout space. */
    content: '';
    position: absolute;
    left: 16px;
    top: 0;
    bottom: 0;
    width: 1px;
    background: var(--vscode-tree-indentGuidesStroke, rgba(128, 128, 128, 0.35));
}

/* Secondary-row labels read as subordinate: use the description foreground
   colour for the source adapter chip so the primary's name pops. */
.session-group .session-item-secondary .session-item-meta {
    color: var(--vscode-descriptionForeground);
}

/* --- Collapsed state ---
   When the primary row's data-collapsed="true", hide every secondary row in
   the group. The primary stays fully visible. Badge counts are summed on the
   primary while collapsed (populated by the renderer before this state kicks
   in). */
.session-group[data-collapsed="true"] .session-item-secondary {
    display: none;
}

/* Chevron glyph swap is done by the renderer via codicon class toggling
   (codicon-chevron-right vs codicon-chevron-down), so no CSS rule is needed
   here \u2014 but we keep a consistent transform so the icon doesn't jump. */
.session-group-chevron .codicon {
    font-size: 12px;
    line-height: 1;
}
`;
}
