"use strict";
/**
 * Integration provider registration for extension activation.
 * Registers all built-in integration providers with the global registry.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerAllIntegrations = registerAllIntegrations;
const integrations_1 = require("./modules/integrations");
const package_lockfile_1 = require("./modules/integrations/providers/package-lockfile");
const build_ci_1 = require("./modules/integrations/providers/build-ci");
const git_source_code_1 = require("./modules/integrations/providers/git-source-code");
const environment_snapshot_1 = require("./modules/integrations/providers/environment-snapshot");
const test_results_1 = require("./modules/integrations/providers/test-results");
const code_coverage_1 = require("./modules/integrations/providers/code-coverage");
const crash_dumps_1 = require("./modules/integrations/providers/crash-dumps");
const windows_event_log_1 = require("./modules/integrations/providers/windows-event-log");
const docker_containers_1 = require("./modules/integrations/providers/docker-containers");
const performance_snapshot_1 = require("./modules/integrations/providers/performance-snapshot");
const terminal_output_1 = require("./modules/integrations/providers/terminal-output");
const linux_logs_1 = require("./modules/integrations/providers/linux-logs");
const external_logs_1 = require("./modules/integrations/providers/external-logs");
const security_audit_1 = require("./modules/integrations/providers/security-audit");
const database_query_logs_1 = require("./modules/integrations/providers/database-query-logs");
const http_network_1 = require("./modules/integrations/providers/http-network");
const browser_devtools_1 = require("./modules/integrations/providers/browser-devtools");
const code_quality_metrics_1 = require("./modules/integrations/providers/code-quality-metrics");
const adb_logcat_1 = require("./modules/integrations/providers/adb-logcat");
const flutter_crash_logs_1 = require("./modules/integrations/providers/flutter-crash-logs");
const drift_advisor_builtin_1 = require("./modules/integrations/providers/drift-advisor-builtin");
/** Register all built-in integration providers with the global registry. */
function registerAllIntegrations() {
    const registry = (0, integrations_1.getDefaultIntegrationRegistry)();
    registry.register(package_lockfile_1.packageLockfileProvider);
    registry.register(build_ci_1.buildCiProvider);
    registry.register(git_source_code_1.gitSourceCodeProvider);
    registry.register(environment_snapshot_1.environmentSnapshotProvider);
    registry.register(test_results_1.testResultsProvider);
    // codeQuality must run before coverage: it snapshots the per-file map
    // that codeCoverageProvider.onSessionEnd clears.
    registry.register(code_quality_metrics_1.codeQualityMetricsProvider);
    registry.register(code_coverage_1.codeCoverageProvider);
    registry.register(crash_dumps_1.crashDumpsProvider);
    registry.register(windows_event_log_1.windowsEventLogProvider);
    registry.register(docker_containers_1.dockerContainersProvider);
    registry.register(performance_snapshot_1.performanceSnapshotProvider);
    registry.register(terminal_output_1.terminalOutputProvider);
    registry.register(linux_logs_1.linuxLogsProvider);
    registry.register(external_logs_1.externalLogsProvider);
    registry.register(security_audit_1.securityAuditProvider);
    registry.register(database_query_logs_1.databaseQueryLogsProvider);
    registry.register(http_network_1.httpNetworkProvider);
    registry.register(browser_devtools_1.browserDevtoolsProvider);
    registry.register(adb_logcat_1.adbLogcatProvider);
    registry.register(flutter_crash_logs_1.flutterCrashLogsProvider);
    // Drift Advisor: meta/sidecar from extension API or `.saropa/drift-advisor-session.json`.
    // External bridge registers after built-ins; last writer wins for same meta key.
    registry.register(drift_advisor_builtin_1.driftAdvisorBuiltinProvider);
}
//# sourceMappingURL=activation-integrations.js.map