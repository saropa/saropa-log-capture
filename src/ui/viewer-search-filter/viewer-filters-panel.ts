/**
 * Filters panel for the log viewer.
 *
 * Provides a slide-out panel with filter controls:
 *   - Quick Filters (presets + reset)
 *   - Log Inputs (merged sources + DAP category checkboxes)
 *   - Exclusions (exclusion patterns)
 *   - Message Tags (source tag chips with search)
 *   - Code Origins (class/method tag chips with search)
 *   - File Scope (code location narrowing)
 *   - SQL Commands (query type chips)
 */
import { getFiltersPanelHtml } from './viewer-filters-panel-html';
import { getFiltersPanelScript } from './viewer-filters-panel-script';

export { getFiltersPanelHtml, getFiltersPanelScript };
