/**
 * CSS styles for the Insight panel — single-scroll unified view (Unified Insight Model).
 * Accordion sections; no tabs. Reuses session-investigation and recurring card classes.
 */

import { getSignalLayoutStyles } from './viewer-styles-signal-layout';
import { getSignalSectionsStyles } from './viewer-styles-signal-sections';
import { getSignalHeroStyles } from './viewer-styles-signal-hero';

/** Return CSS for the Insight panel and accordion sections. */
export function getSignalPanelStyles(): string {
    return getSignalLayoutStyles() + getSignalSectionsStyles() + getSignalHeroStyles();
}
