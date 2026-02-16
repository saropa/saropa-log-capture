/** Shared type definitions for Firebase Crashlytics integration. */

import type { DiagnosticDetails } from './crashlytics-diagnostics';

export interface CrashlyticsIssue {
    readonly id: string;
    readonly title: string;
    readonly subtitle: string;
    readonly eventCount: number;
    readonly userCount: number;
    readonly isFatal: boolean;
    readonly state: 'OPEN' | 'CLOSED' | 'REGRESSION' | 'UNKNOWN';
    readonly firstVersion?: string;
    readonly lastVersion?: string;
}

export interface FirebaseContext {
    readonly available: boolean;
    readonly setupHint?: string;
    /** Which setup step failed — drives the wizard UI in the panel. */
    readonly setupStep?: 'gcloud' | 'token' | 'config';
    readonly issues: readonly CrashlyticsIssue[];
    readonly consoleUrl?: string;
    readonly queriedAt?: number;
    readonly diagnostics?: DiagnosticDetails;
}

export interface CrashlyticsStackFrame {
    readonly text: string;
    readonly fileName?: string;
    readonly lineNumber?: number;
}

export interface CrashlyticsThread {
    readonly name: string;
    readonly frames: readonly CrashlyticsStackFrame[];
}

export interface CrashlyticsEventDetail {
    readonly issueId: string;
    readonly crashThread?: CrashlyticsThread;
    readonly appThreads: readonly CrashlyticsThread[];
    readonly deviceModel?: string;
    readonly osVersion?: string;
    readonly eventTime?: string;
    readonly customKeys?: readonly { readonly key: string; readonly value: string }[];
    readonly logs?: readonly { readonly timestamp?: string; readonly message: string }[];
}

export interface CrashlyticsIssueEvents {
    readonly issueId: string;
    readonly events: readonly CrashlyticsEventDetail[];
    readonly currentIndex: number;
}
