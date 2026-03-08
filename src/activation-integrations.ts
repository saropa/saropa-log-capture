/**
 * Integration provider registration for extension activation.
 * Registers all built-in integration providers with the global registry.
 */

import { getDefaultIntegrationRegistry } from './modules/integrations';
import { packageLockfileProvider } from './modules/integrations/providers/package-lockfile';
import { buildCiProvider } from './modules/integrations/providers/build-ci';
import { gitSourceCodeProvider } from './modules/integrations/providers/git-source-code';
import { environmentSnapshotProvider } from './modules/integrations/providers/environment-snapshot';
import { testResultsProvider } from './modules/integrations/providers/test-results';
import { codeCoverageProvider } from './modules/integrations/providers/code-coverage';
import { crashDumpsProvider } from './modules/integrations/providers/crash-dumps';
import { windowsEventLogProvider } from './modules/integrations/providers/windows-event-log';
import { dockerContainersProvider } from './modules/integrations/providers/docker-containers';
import { performanceSnapshotProvider } from './modules/integrations/providers/performance-snapshot';
import { terminalOutputProvider } from './modules/integrations/providers/terminal-output';
import { linuxLogsProvider } from './modules/integrations/providers/linux-logs';
import { externalLogsProvider } from './modules/integrations/providers/external-logs';
import { securityAuditProvider } from './modules/integrations/providers/security-audit';
import { databaseQueryLogsProvider } from './modules/integrations/providers/database-query-logs';
import { httpNetworkProvider } from './modules/integrations/providers/http-network';
import { browserDevtoolsProvider } from './modules/integrations/providers/browser-devtools';

/** Register all built-in integration providers with the global registry. */
export function registerAllIntegrations(): void {
    const registry = getDefaultIntegrationRegistry();
    registry.register(packageLockfileProvider);
    registry.register(buildCiProvider);
    registry.register(gitSourceCodeProvider);
    registry.register(environmentSnapshotProvider);
    registry.register(testResultsProvider);
    registry.register(codeCoverageProvider);
    registry.register(crashDumpsProvider);
    registry.register(windowsEventLogProvider);
    registry.register(dockerContainersProvider);
    registry.register(performanceSnapshotProvider);
    registry.register(terminalOutputProvider);
    registry.register(linuxLogsProvider);
    registry.register(externalLogsProvider);
    registry.register(securityAuditProvider);
    registry.register(databaseQueryLogsProvider);
    registry.register(httpNetworkProvider);
    registry.register(browserDevtoolsProvider);
}
