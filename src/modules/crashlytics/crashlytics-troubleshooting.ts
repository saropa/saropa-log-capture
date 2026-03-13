/**
 * In-app troubleshooting content for Firebase Crashlytics setup.
 * Rendered in the Crashlytics panel so users get help without opening external docs.
 */

export interface TroubleshootingRow {
    readonly symptom: string;
    readonly cause: string;
    readonly fix: string;
}

/** Symptom → cause → fix table; also summarized in the in-panel Help section. */
export const CRASHLYTICS_TROUBLESHOOTING_TABLE: readonly TroubleshootingRow[] = [
    {
        symptom: '"Install gcloud CLI"',
        cause: 'gcloud not found on PATH',
        fix: 'Install from https://docs.cloud.google.com/sdk/docs/install-sdk',
    },
    {
        symptom: '"Run: gcloud auth application-default login"',
        cause: 'No ADC credentials',
        fix: 'Run the login command',
    },
    {
        symptom: '"Add google-services.json..."',
        cause: "Can't detect project/app",
        fix: 'Add the file or set settings manually',
    },
    {
        symptom: '"0 matches" with Firebase available',
        cause: 'No Crashlytics issues match the error tokens',
        fix: 'Check Firebase Console directly via the link',
    },
    {
        symptom: '"Firebase query failed"',
        cause: 'Network error or API issue',
        fix: 'Check `gcloud auth application-default print-access-token` works',
    },
] as const;

/** Which setup step a row applies to (for contextual hint in the wizard). */
export function getTroubleshootingRowsForStep(step: 'gcloud' | 'token' | 'config'): readonly TroubleshootingRow[] {
    switch (step) {
        case 'gcloud':
            return CRASHLYTICS_TROUBLESHOOTING_TABLE.slice(0, 1);
        case 'token':
            return CRASHLYTICS_TROUBLESHOOTING_TABLE.slice(1, 2);
        case 'config':
            return CRASHLYTICS_TROUBLESHOOTING_TABLE.slice(2, 3);
        default:
            return [];
    }
}
