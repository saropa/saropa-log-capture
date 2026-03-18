/**
 * CSS styles for the Insight panel — single-scroll unified view (Unified Insight Model).
 * Accordion sections; no tabs. Reuses session-investigation and recurring card classes.
 */

import { getInsightLayoutStyles } from './viewer-styles-insight-layout';
import { getInsightSectionsStyles } from './viewer-styles-insight-sections';
import { getInsightHeroStyles } from './viewer-styles-insight-hero';

/** Return CSS for the Insight panel and accordion sections. */
export function getInsightPanelStyles(): string {
    return getInsightLayoutStyles() + getInsightSectionsStyles() + getInsightHeroStyles();
}
