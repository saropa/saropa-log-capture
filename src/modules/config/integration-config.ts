/**
 * Integration and project-index config loading. Extracted to keep config.ts under line limit.
 */

import * as vscode from 'vscode';
import type {
    IntegrationBuildCiConfig,
    IntegrationGitConfig,
    IntegrationEnvironmentConfig,
    IntegrationTestResultsConfig,
    IntegrationCoverageConfig,
    IntegrationCrashDumpsConfig,
    IntegrationWindowsEventsConfig,
    IntegrationDockerConfig,
    IntegrationLokiConfig,
    IntegrationPerformanceConfig,
    IntegrationTerminalConfig,
    IntegrationLinuxLogsConfig,
    IntegrationExternalLogsConfig,
    IntegrationSecurityConfig,
    IntegrationDatabaseConfig,
    IntegrationHttpConfig,
    IntegrationBrowserConfig,
    ProjectIndexConfig,
    ProjectIndexSourceConfig,
} from './config';
import { clamp, ensureBoolean, ensureEnum, ensureStringArray } from './config-validation';

/** Read a non-negative number from config; return default if missing or invalid. */
function configNonNegative(cfg: vscode.WorkspaceConfiguration, key: string, defaultVal: number): number {
  const v = cfg.get(key);
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : defaultVal;
}

export type IntegrationConfigBlock = {
  integrationsBuildCi: IntegrationBuildCiConfig;
  integrationsGit: IntegrationGitConfig;
  integrationsEnvironment: IntegrationEnvironmentConfig;
  integrationsTestResults: IntegrationTestResultsConfig;
  integrationsCoverage: IntegrationCoverageConfig;
  integrationsCrashDumps: IntegrationCrashDumpsConfig;
  integrationsWindowsEvents: IntegrationWindowsEventsConfig;
  integrationsDocker: IntegrationDockerConfig;
  integrationsLoki: IntegrationLokiConfig;
  integrationsPerformance: IntegrationPerformanceConfig;
  integrationsTerminal: IntegrationTerminalConfig;
  integrationsLinuxLogs: IntegrationLinuxLogsConfig;
  integrationsExternalLogs: IntegrationExternalLogsConfig;
  integrationsSecurity: IntegrationSecurityConfig;
  integrationsDatabase: IntegrationDatabaseConfig;
  integrationsHttp: IntegrationHttpConfig;
  integrationsBrowser: IntegrationBrowserConfig;
};

export function getIntegrationConfig(cfg: vscode.WorkspaceConfiguration): IntegrationConfigBlock {
  return {
    integrationsBuildCi: {
      buildInfoPath: typeof cfg.get('integrations.buildCi.buildInfoPath') === 'string'
        ? (cfg.get('integrations.buildCi.buildInfoPath') as string).trim() || '.saropa/last-build.json'
        : '.saropa/last-build.json',
      fileMaxAgeMinutes: clamp(cfg.get('integrations.buildCi.fileMaxAgeMinutes'), 1, 1440, 60),
    },
    integrationsGit: {
      describeInHeader: ensureBoolean(cfg.get('integrations.git.describeInHeader'), true),
      uncommittedInHeader: ensureBoolean(cfg.get('integrations.git.uncommittedInHeader'), true),
      stashInHeader: ensureBoolean(cfg.get('integrations.git.stashInHeader'), false),
      blameOnNavigate: ensureBoolean(cfg.get('integrations.git.blameOnNavigate'), true),
      includeLineHistoryInMeta: ensureBoolean(cfg.get('integrations.git.includeLineHistoryInMeta'), false),
      commitLinks: ensureBoolean(cfg.get('integrations.git.commitLinks'), true),
    },
    integrationsEnvironment: {
      includeEnvChecksum: ensureBoolean(cfg.get('integrations.environment.includeEnvChecksum'), false),
      configFiles: ensureStringArray(cfg.get('integrations.environment.configFiles'), []),
      includeInHeader: ensureBoolean(cfg.get('integrations.environment.includeInHeader'), true),
    },
    integrationsTestResults: {
      source: ensureEnum(cfg.get('integrations.testResults.source'), ['file', 'junit'], 'file'),
      lastRunPath: typeof cfg.get('integrations.testResults.lastRunPath') === 'string'
        ? (cfg.get('integrations.testResults.lastRunPath') as string).trim() || '.saropa/last-test-run.json'
        : '.saropa/last-test-run.json',
      junitPath: typeof cfg.get('integrations.testResults.junitPath') === 'string' ? (cfg.get('integrations.testResults.junitPath') as string) : '',
      fileMaxAgeHours: clamp(cfg.get('integrations.testResults.fileMaxAgeHours'), 1, 168, 24),
      includeFailedListInHeader: ensureBoolean(cfg.get('integrations.testResults.includeFailedListInHeader'), false),
    },
    integrationsCoverage: {
      reportPath: typeof cfg.get('integrations.coverage.reportPath') === 'string'
        ? (cfg.get('integrations.coverage.reportPath') as string).trim() || 'coverage/lcov.info'
        : 'coverage/lcov.info',
      includeInHeader: ensureBoolean(cfg.get('integrations.coverage.includeInHeader'), true),
    },
    integrationsCrashDumps: {
      searchPaths: ensureStringArray(cfg.get('integrations.crashDumps.searchPaths'), []),
      extensions: ensureStringArray(cfg.get('integrations.crashDumps.extensions'), ['.dmp', '.mdmp', '.core']),
      leadMinutes: configNonNegative(cfg, 'integrations.crashDumps.leadMinutes', 1),
      lagMinutes: configNonNegative(cfg, 'integrations.crashDumps.lagMinutes', 5),
      maxFiles: clamp(cfg.get('integrations.crashDumps.maxFiles'), 1, 100, 20),
      includeInHeader: ensureBoolean(cfg.get('integrations.crashDumps.includeInHeader'), true),
      copyToSession: ensureBoolean(cfg.get('integrations.crashDumps.copyToSession'), false),
    },
    integrationsWindowsEvents: {
      logs: ensureStringArray(cfg.get('integrations.windowsEvents.logs'), ['Application', 'System']),
      levels: ensureStringArray(cfg.get('integrations.windowsEvents.levels'), ['Critical', 'Error', 'Warning']),
      leadMinutes: configNonNegative(cfg, 'integrations.windowsEvents.leadMinutes', 2),
      lagMinutes: configNonNegative(cfg, 'integrations.windowsEvents.lagMinutes', 5),
      maxEvents: clamp(cfg.get('integrations.windowsEvents.maxEvents'), 1, 500, 200),
    },
    integrationsDocker: {
      runtime: ensureEnum(cfg.get('integrations.docker.runtime'), ['docker', 'podman'], 'docker'),
      containerId: typeof cfg.get('integrations.docker.containerId') === 'string' ? (cfg.get('integrations.docker.containerId') as string) : '',
      containerNamePattern: typeof cfg.get('integrations.docker.containerNamePattern') === 'string' ? (cfg.get('integrations.docker.containerNamePattern') as string) : '',
      captureLogs: ensureBoolean(cfg.get('integrations.docker.captureLogs'), true),
      maxLogLines: clamp(cfg.get('integrations.docker.maxLogLines'), 100, 100000, 20000),
    },
    integrationsLoki: {
      enabled: ensureBoolean(cfg.get('loki.enabled'), false),
      pushUrl: typeof cfg.get('loki.pushUrl') === 'string' ? (cfg.get('loki.pushUrl') as string).trim() : '',
    },
    integrationsPerformance: {
      snapshotAtStart: ensureBoolean(cfg.get('integrations.performance.snapshotAtStart'), true),
      sampleDuringSession: ensureBoolean(cfg.get('integrations.performance.sampleDuringSession'), false),
      sampleIntervalSeconds: clamp(cfg.get('integrations.performance.sampleIntervalSeconds'), 1, 300, 5),
      includeInHeader: ensureBoolean(cfg.get('integrations.performance.includeInHeader'), true),
      profilerOutputPath: typeof cfg.get('integrations.performance.profilerOutputPath') === 'string'
        ? (cfg.get('integrations.performance.profilerOutputPath') as string).trim() : '',
      processMetrics: ensureBoolean(cfg.get('integrations.performance.processMetrics'), false),
    },
    integrationsTerminal: {
      whichTerminals: ensureEnum(cfg.get('integrations.terminal.whichTerminals'), ['all', 'active', 'linked'], 'active'),
      writeSidecar: ensureBoolean(cfg.get('integrations.terminal.writeSidecar'), true),
      prefixTimestamp: ensureBoolean(cfg.get('integrations.terminal.prefixTimestamp'), true),
      maxLines: clamp(cfg.get('integrations.terminal.maxLines'), 1000, 500000, 50000),
    },
    integrationsLinuxLogs: {
      when: ensureEnum(cfg.get('integrations.linuxLogs.when'), ['wsl', 'remote', 'always'], 'wsl'),
      sources: ensureStringArray(cfg.get('integrations.linuxLogs.sources'), ['dmesg', 'journalctl']),
      leadMinutes: configNonNegative(cfg, 'integrations.linuxLogs.leadMinutes', 2),
      lagMinutes: configNonNegative(cfg, 'integrations.linuxLogs.lagMinutes', 5),
      maxLines: clamp(cfg.get('integrations.linuxLogs.maxLines'), 100, 10000, 1000),
      wslDistro: typeof cfg.get('integrations.linuxLogs.wslDistro') === 'string' ? (cfg.get('integrations.linuxLogs.wslDistro') as string).trim() : '',
    },
    integrationsExternalLogs: {
      paths: ensureStringArray(cfg.get('integrations.externalLogs.paths'), []),
      writeSidecars: ensureBoolean(cfg.get('integrations.externalLogs.writeSidecars'), true),
      prefixLines: ensureBoolean(cfg.get('integrations.externalLogs.prefixLines'), true),
      maxLinesPerFile: clamp(cfg.get('integrations.externalLogs.maxLinesPerFile'), 100, 1000000, 10000),
    },
    integrationsSecurity: {
      windowsSecurityLog: ensureBoolean(cfg.get('integrations.security.windowsSecurityLog'), false),
      auditLogPath: typeof cfg.get('integrations.security.auditLogPath') === 'string' ? (cfg.get('integrations.security.auditLogPath') as string).trim() : '',
      redactSecurityEvents: ensureBoolean(cfg.get('integrations.security.redactSecurityEvents'), true),
    },
    integrationsDatabase: {
      mode: ensureEnum(cfg.get('integrations.database.mode'), ['parse', 'file', 'api'], 'parse'),
      queryLogPath: typeof cfg.get('integrations.database.queryLogPath') === 'string' ? (cfg.get('integrations.database.queryLogPath') as string).trim() : '',
      requestIdPattern: typeof cfg.get('integrations.database.requestIdPattern') === 'string' ? (cfg.get('integrations.database.requestIdPattern') as string).trim() : '',
      timeWindowSeconds: clamp(cfg.get('integrations.database.timeWindowSeconds'), 1, 120, 5),
      maxQueriesPerLookup: clamp(cfg.get('integrations.database.maxQueriesPerLookup'), 1, 200, 20),
    },
    integrationsHttp: {
      requestIdPattern: typeof cfg.get('integrations.http.requestIdPattern') === 'string' ? (cfg.get('integrations.http.requestIdPattern') as string).trim() : '',
      requestLogPath: typeof cfg.get('integrations.http.requestLogPath') === 'string' ? (cfg.get('integrations.http.requestLogPath') as string).trim() : '',
      timeWindowSeconds: clamp(cfg.get('integrations.http.timeWindowSeconds'), 1, 120, 10),
      maxRequestsPerSession: clamp(cfg.get('integrations.http.maxRequestsPerSession'), 10, 5000, 500),
    },
    integrationsBrowser: {
      mode: ensureEnum(cfg.get('integrations.browser.mode'), ['file', 'cdp'], 'file'),
      browserLogPath: typeof cfg.get('integrations.browser.browserLogPath') === 'string' ? (cfg.get('integrations.browser.browserLogPath') as string).trim() : '',
      browserLogFormat: ensureEnum(cfg.get('integrations.browser.browserLogFormat'), ['jsonl', 'json'], 'jsonl'),
      maxEvents: clamp(cfg.get('integrations.browser.maxEvents'), 100, 100000, 10000),
    },
  };
}

export function getProjectIndexConfig(cfg: vscode.WorkspaceConfiguration): ProjectIndexConfig {
  const rawSources = cfg.get("projectIndex.sources");
  const docsDirs = ensureStringArray(cfg.get("docsScanDirs"), ["bugs", "docs"]);
  let sources: ProjectIndexSourceConfig[];
  if (Array.isArray(rawSources) && rawSources.length > 0) {
    sources = [];
    for (const s of rawSources) {
      if (!s || typeof s !== 'object') {continue;}
      const o = s as Record<string, unknown>;
      const path = typeof o.path === 'string' ? o.path.trim() : '';
      if (!path) {continue;}
      const fileTypes = Array.isArray(o.fileTypes)
        ? (o.fileTypes as unknown[]).filter((x): x is string => typeof x === 'string')
        : ['.md', '.txt'];
      sources.push({ path, fileTypes, enabled: o.enabled !== false });
    }
  } else {
    sources = docsDirs.map((dir) => ({ path: dir, fileTypes: ['.md', '.txt'], enabled: true }));
  }
  return {
    enabled: ensureBoolean(cfg.get('projectIndex.enabled'), true),
    sources,
    includeRootFiles: ensureBoolean(cfg.get('projectIndex.includeRootFiles'), true),
    includeReports: ensureBoolean(cfg.get('projectIndex.includeReports'), true),
    maxFilesPerSource: clamp(cfg.get('projectIndex.maxFilesPerSource'), 10, 1000, 100),
    refreshInterval: clamp(cfg.get('projectIndex.refreshInterval'), 0, 3600, 0),
  };
}
