/**
 * Filter panel script and backward-compat re-exports.
 *
 * Tag chip sections (Message Tags, Source Classes, SQL Commands) now
 * live inside the filter drawer as accordion sections. The slide-out
 * panel was removed.
 */
import { getTagsPanelHtml } from './viewer-filters-panel-html';
import { getTagsPanelScript } from './viewer-filters-panel-script';

/**
 * @deprecated Use getTagsPanelScript — kept for backward compatibility.
 */
export function getFiltersPanelScript(): string {
    return getTagsPanelScript();
}

export { getTagsPanelHtml, getTagsPanelScript };
