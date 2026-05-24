/**
 * Extension-side handlers for Crashlytics and Recurring Errors panels.
 *
 * Re-exports all handlers from the handlers subdirectory for backward compatibility.
 */

export type { PostFn } from './handlers/crashlytics-handlers';

export {
    handleCrashlyticsRequest,
    handleCrashlyticsValidate,
    handleCrashlyticsFilterIndex,
    handleGcloudAuth,
    handleBrowseGoogleServices,
    handleOpenGoogleServicesJson,
    handleOpenGcloudInstall,
    handleCrashlyticsShowOutput,
    startCrashlyticsAutoRefresh,
    stopCrashlyticsAutoRefresh,
    disposeCrashlyticsHandlers,
} from './handlers/crashlytics-handlers';

export {
    handleSetErrorStatus,
    handleSignalDataRequest,
    handleMuteSignalWithReason,
    handleAcceptFilterSuggestion,
    handleRejectFilterSuggestion,
} from './handlers/recurring-handlers';

export {
    handlePerformanceRequest,
    handleIntegrationContextRequest,
    handleIntegrationContextDocument,
    handleRelatedQueriesRequest,
} from './handlers/context-handlers';

export { handleCrashlyticsDetail, openCrashFrame, handleCrashlyticsCreateIssue } from './handlers/crashlytics-detail-handler';

export { openLogLine } from '../../modules/crashlytics/crash-log-correlation';

export { serializeContext, buildDiagnosticHtml } from './handlers/crashlytics-serializers';

/** Dispose all handlers. */
export function disposeHandlers(): void {
    const { disposeCrashlyticsHandlers } = require('./handlers/crashlytics-handlers');
    disposeCrashlyticsHandlers();
}
