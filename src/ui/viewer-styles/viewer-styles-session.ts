/**
 * CSS styles for the session history slide-out panel.
 *
 * Follows the same fixed-position slide-in pattern as the search
 * and options panels, sitting to the left of the icon bar.
 * Styles are composed from submodules (layout, list, tags/loading) to stay under the 300-line file limit.
 */
import { getSessionPanelLayoutStyles } from './viewer-styles-session-panel';
import { getSessionListStyles } from './viewer-styles-session-list';
import { getSessionTagsLoadingStyles } from './viewer-styles-session-tags-loading';

/** Return CSS for the session panel and its list items. */
export function getSessionPanelStyles(): string {
    return getSessionPanelLayoutStyles() + getSessionListStyles() + getSessionTagsLoadingStyles();
}
