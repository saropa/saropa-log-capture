/**
 * Options panel for the log viewer.
 *
 * Provides a slide-out panel with organized sections for all viewer settings:
 *   - Display options (word wrap, decorations, font size, line height)
 *   - Level filters
 *   - Search and filtering
 *   - Exclusions and watch
 *   - Layout (visual spacing)
 *   - Audio alerts
 *
 * The panel slides in from the right side of the viewer and can be toggled
 * via a gear icon button in the footer.
 */
import { getOptionsPanelHtml } from './viewer-options-panel-html';
import { getOptionsPanelScript } from './viewer-options-panel-script';

export { getOptionsPanelHtml, getOptionsPanelScript };
