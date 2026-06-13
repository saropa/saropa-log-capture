/**
 * CSS styles for the Signal panel — single-scroll unified view (Unified Signal Model).
 * Accordion sections; no tabs. Reuses session-collection and recurring card classes.
 */

import { getSignalLayoutStyles } from './viewer-styles-signal-layout';
import { getSignalSectionsStyles } from './viewer-styles-signal-sections';
import { getSignalListStyles } from './viewer-styles-signal-list';
import { getSignalHeroStyles } from './viewer-styles-signal-hero';

/** Return CSS for the Signal panel and accordion sections. */
export function getSignalPanelStyles(): string {
    // signal-list comes right after signal-sections (same cascade position as before the split):
    // it holds the list-row interactivity, chips, evidence/detail, pulse, and suggestion styles.
    return getSignalLayoutStyles()
        + getSignalSectionsStyles()
        + getSignalListStyles()
        + getSignalHeroStyles();
}
