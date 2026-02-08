/**
 * Filters panel for the log viewer.
 *
 * Provides a slide-out panel with filter controls:
 *   - Quick Filters (presets + reset)
 *   - Output Channels (DAP category checkboxes)
 *   - Log Tags (source tag chips with search)
 *   - Class Tags (class tag chips with search)
 *   - Noise Reduction (exclusions + app-only)
 */
import { getFiltersPanelHtml } from './viewer-filters-panel-html';
import { getFiltersPanelScript } from './viewer-filters-panel-script';

export { getFiltersPanelHtml, getFiltersPanelScript };
