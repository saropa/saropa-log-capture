/**
 * CSS styles for interactive UI components in the viewer webview.
 *
 * Covers search bar, keyword watch chips, pinned section,
 * exclusion controls, level filter buttons, and inline peek.
 */
import { getSearchStyles } from './viewer-styles-search';
import { getUiStyles } from './viewer-styles-ui';

export function getComponentStyles(): string {
    return getSearchStyles() + getUiStyles();
}
