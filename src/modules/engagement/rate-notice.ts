/**
 * One-time "please rate" toast after enough activations to form an opinion. Follows the
 * same `globalState`-gated, fire-and-forget, never-throws contract as the other notice
 * modules (nls-coverage-notice, screenshot-dedup-default-notice).
 *
 * Three outcomes:
 *  - "Rate" → opens the Marketplace review page, permanently suppresses.
 *  - "Not now" → resets the activation counter; the prompt returns after another cycle.
 *  - "Don't Ask Again" → permanently suppresses without opening anything.
 */

import * as vscode from 'vscode';
import { t } from '../../l10n';
import { logExtensionInfo } from '../misc/extension-logger';
import {
    type RateOutcome,
    describeRateDecision,
    shouldPromptForRating,
} from './rate-notice-helpers';

/** Activation counter — incremented every time the extension activates. */
const ACTIVATION_COUNT_KEY = 'slc.rateActivationCount';

/** Permanent outcome once the user rates or permanently dismisses. */
const RATE_OUTCOME_KEY = 'slc.rateOutcome';

/** Full VS Code Marketplace review URL for Saropa Log Capture. */
const MARKETPLACE_REVIEW_URL =
    'https://marketplace.visualstudio.com/items?itemName=saropa.saropa-log-capture&ssr=false#review-details';

/**
 * Increment the activation counter and maybe show the rating prompt. Safe to call on
 * every activation: returns immediately when permanently resolved or below threshold.
 * Never throws — activation must not be blocked.
 */
export function maybePromptForRating(context: vscode.ExtensionContext): void {
    try {
        const outcome = context.globalState.get<RateOutcome>(RATE_OUTCOME_KEY);
        const count = (context.globalState.get<number>(ACTIVATION_COUNT_KEY) ?? 0) + 1;

        // Always persist the incremented counter (even when permanently resolved — cheap,
        // and keeps the log line accurate if the outcome key is ever cleared for debugging).
        void context.globalState.update(ACTIVATION_COUNT_KEY, count);

        const show = shouldPromptForRating(count, outcome);
        const reason = describeRateDecision(count, outcome, show);

        logExtensionInfo('rate', `activations=${count} outcome=${outcome ?? '(none)'} prompt=${show ? 'SHOWN' : 'hidden'} reason=${reason}`);

        if (!show) { return; }

        // The three button labels — localized via t().
        const rateLabel = t('rate.action.rate');
        const laterLabel = t('learning.notNow');
        const neverLabel = t('action.dontAskAgain');

        void vscode.window.showInformationMessage(
            t('rate.prompt'),
            rateLabel,
            laterLabel,
            neverLabel,
        ).then(choice => {
            if (choice === rateLabel) {
                // Open the Marketplace review page and mark as permanently resolved.
                void vscode.env.openExternal(vscode.Uri.parse(MARKETPLACE_REVIEW_URL));
                void context.globalState.update(RATE_OUTCOME_KEY, 'rated' satisfies RateOutcome);
                logExtensionInfo('rate', 'user chose to rate — opened Marketplace');
            } else if (choice === neverLabel) {
                // Permanently suppress without opening anything.
                void context.globalState.update(RATE_OUTCOME_KEY, 'dismissed' satisfies RateOutcome);
                logExtensionInfo('rate', 'user chose not to be asked again');
            } else {
                // "Not now" or dismissed the toast — reset counter for another cycle.
                void context.globalState.update(ACTIVATION_COUNT_KEY, 0);
                logExtensionInfo('rate', 'user deferred — counter reset, will ask again later');
            }
        });
    } catch {
        // Never block activation. Swallow silently — the prompt is non-critical.
    }
}
