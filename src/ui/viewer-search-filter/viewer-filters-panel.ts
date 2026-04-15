/**
 * Tags & Origins panel for the log viewer.
 *
 * Provides a slide-out panel (opened from the icon bar) with
 * chip-heavy browsing sections:
 *   - Message Tags (source tag chips with search)
 *   - Code Origins (class/method tag chips with search)
 *   - SQL Commands (query type chips)
 *   - Individual Sources (per-category toggles — placeholder)
 *
 * Also re-exports the panel script which wires tier radio and
 * exclusion controls that live in the filter drawer.
 */
import { getTagsPanelHtml } from './viewer-filters-panel-html';
import { getTagsPanelScript } from './viewer-filters-panel-script';

/**
 * @deprecated Use getTagsPanelHtml — kept for backward compatibility.
 */
export function getFiltersPanelHtml(): string {
    return getTagsPanelHtml();
}

/**
 * @deprecated Use getTagsPanelScript — kept for backward compatibility.
 */
export function getFiltersPanelScript(): string {
    return getTagsPanelScript();
}

export { getTagsPanelHtml, getTagsPanelScript };
