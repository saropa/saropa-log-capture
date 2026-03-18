/**
 * Extension-side handlers for Crashlytics and Recurring Errors panels.
 *
 * Re-exports all handlers from the handlers subdirectory for backward compatibility.
 */

export type { PostFn } from './handlers/crashlytics-handlers';

export {
    handleCrashlyticsRequest,
    handleCrashDetail,
    handleCrashlyticsAction,
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
    handleRecurringRequest,
    handleSetErrorStatus,
    handleInsightDataRequest,
} from './handlers/recurring-handlers';

export {
    handlePerformanceRequest,
    handleIntegrationContextRequest,
    handleIntegrationContextDocument,
} from './handlers/context-handlers';

export { serializeContext, buildDiagnosticHtml } from './handlers/crashlytics-serializers';

/** Dispose all handlers. */
export function disposeHandlers(): void {
    const { disposeCrashlyticsHandlers } = require('./handlers/crashlytics-handlers');
    disposeCrashlyticsHandlers();
}
