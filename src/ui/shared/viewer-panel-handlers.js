"use strict";
/**
 * Extension-side handlers for Crashlytics and Recurring Errors panels.
 *
 * Re-exports all handlers from the handlers subdirectory for backward compatibility.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildDiagnosticHtml = exports.serializeContext = exports.handleRelatedQueriesRequest = exports.handleIntegrationContextDocument = exports.handleIntegrationContextRequest = exports.handlePerformanceRequest = exports.handleInsightDataRequest = exports.handleSetErrorStatus = exports.handleRecurringRequest = exports.disposeCrashlyticsHandlers = exports.stopCrashlyticsAutoRefresh = exports.startCrashlyticsAutoRefresh = exports.handleCrashlyticsShowOutput = exports.handleOpenGcloudInstall = exports.handleOpenGoogleServicesJson = exports.handleBrowseGoogleServices = exports.handleGcloudAuth = exports.handleCrashlyticsAction = exports.handleCrashDetail = exports.handleCrashlyticsRequest = void 0;
exports.disposeHandlers = disposeHandlers;
var crashlytics_handlers_1 = require("./handlers/crashlytics-handlers");
Object.defineProperty(exports, "handleCrashlyticsRequest", { enumerable: true, get: function () { return crashlytics_handlers_1.handleCrashlyticsRequest; } });
Object.defineProperty(exports, "handleCrashDetail", { enumerable: true, get: function () { return crashlytics_handlers_1.handleCrashDetail; } });
Object.defineProperty(exports, "handleCrashlyticsAction", { enumerable: true, get: function () { return crashlytics_handlers_1.handleCrashlyticsAction; } });
Object.defineProperty(exports, "handleGcloudAuth", { enumerable: true, get: function () { return crashlytics_handlers_1.handleGcloudAuth; } });
Object.defineProperty(exports, "handleBrowseGoogleServices", { enumerable: true, get: function () { return crashlytics_handlers_1.handleBrowseGoogleServices; } });
Object.defineProperty(exports, "handleOpenGoogleServicesJson", { enumerable: true, get: function () { return crashlytics_handlers_1.handleOpenGoogleServicesJson; } });
Object.defineProperty(exports, "handleOpenGcloudInstall", { enumerable: true, get: function () { return crashlytics_handlers_1.handleOpenGcloudInstall; } });
Object.defineProperty(exports, "handleCrashlyticsShowOutput", { enumerable: true, get: function () { return crashlytics_handlers_1.handleCrashlyticsShowOutput; } });
Object.defineProperty(exports, "startCrashlyticsAutoRefresh", { enumerable: true, get: function () { return crashlytics_handlers_1.startCrashlyticsAutoRefresh; } });
Object.defineProperty(exports, "stopCrashlyticsAutoRefresh", { enumerable: true, get: function () { return crashlytics_handlers_1.stopCrashlyticsAutoRefresh; } });
Object.defineProperty(exports, "disposeCrashlyticsHandlers", { enumerable: true, get: function () { return crashlytics_handlers_1.disposeCrashlyticsHandlers; } });
var recurring_handlers_1 = require("./handlers/recurring-handlers");
Object.defineProperty(exports, "handleRecurringRequest", { enumerable: true, get: function () { return recurring_handlers_1.handleRecurringRequest; } });
Object.defineProperty(exports, "handleSetErrorStatus", { enumerable: true, get: function () { return recurring_handlers_1.handleSetErrorStatus; } });
Object.defineProperty(exports, "handleInsightDataRequest", { enumerable: true, get: function () { return recurring_handlers_1.handleInsightDataRequest; } });
var context_handlers_1 = require("./handlers/context-handlers");
Object.defineProperty(exports, "handlePerformanceRequest", { enumerable: true, get: function () { return context_handlers_1.handlePerformanceRequest; } });
Object.defineProperty(exports, "handleIntegrationContextRequest", { enumerable: true, get: function () { return context_handlers_1.handleIntegrationContextRequest; } });
Object.defineProperty(exports, "handleIntegrationContextDocument", { enumerable: true, get: function () { return context_handlers_1.handleIntegrationContextDocument; } });
Object.defineProperty(exports, "handleRelatedQueriesRequest", { enumerable: true, get: function () { return context_handlers_1.handleRelatedQueriesRequest; } });
var crashlytics_serializers_1 = require("./handlers/crashlytics-serializers");
Object.defineProperty(exports, "serializeContext", { enumerable: true, get: function () { return crashlytics_serializers_1.serializeContext; } });
Object.defineProperty(exports, "buildDiagnosticHtml", { enumerable: true, get: function () { return crashlytics_serializers_1.buildDiagnosticHtml; } });
/** Dispose all handlers. */
function disposeHandlers() {
    const { disposeCrashlyticsHandlers } = require('./handlers/crashlytics-handlers');
    disposeCrashlyticsHandlers();
}
//# sourceMappingURL=viewer-panel-handlers.js.map