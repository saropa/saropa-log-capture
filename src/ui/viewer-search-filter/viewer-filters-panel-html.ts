/**
 * Tag section HTML fragments for the filter drawer.
 *
 * Message Tags, Source Classes, and SQL Commands now live as accordion
 * sections inside the filter drawer (viewer-toolbar-filter-drawer-html.ts).
 * This file is kept for backward compatibility — getTagsPanelHtml()
 * returns an empty string since the slide-out panel was removed.
 */

/**
 * Returns empty string — the Tags & Origins slide-out panel has been
 * removed. Tag sections are now accordion sections in the filter drawer.
 */
export function getTagsPanelHtml(): string {
    return '';
}
