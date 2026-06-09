/**
 * CSS styles for the session history slide-out panel.
 *
 * Follows the same fixed-position slide-in pattern as the search
 * and options panels, sitting to the left of the icon bar.
 * Styles are composed from submodules (layout, list, tags/loading) to stay under the 300-line file limit.
 */
import { getSessionPanelLayoutStyles } from './viewer-styles-session-panel';
import { getSessionListStyles } from './viewer-styles-session-list';
import { getSessionNameFilterStyles } from './viewer-styles-session-name-filter';
import { getSessionTagsLoadingStyles } from './viewer-styles-session-tags-loading';
import { getSessionGroupStyles } from './viewer-styles-session-group';
import { getSessionNewerStyles } from './viewer-styles-session-newer';
import { getSessionOptionsMenuStyles } from './viewer-styles-session-options';

/** Return CSS for the session panel and its list items. */
export function getSessionPanelStyles(): string {
    return getSessionPanelLayoutStyles()
        + getSessionOptionsMenuStyles()
        + getSessionListStyles()
        + getSessionNameFilterStyles()
        + getSessionNewerStyles()
        + getSessionTagsLoadingStyles()
        + getSessionGroupStyles();
}
