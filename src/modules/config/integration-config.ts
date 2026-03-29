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
    IntegrationCodeQualityConfig,
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
    IntegrationAdbLogcatConfig,
    IntegrationUnifiedLogConfig,
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

function readStringOrDefault(cfg: vscode.WorkspaceConfiguration, key: string, defaultVal: string): string {
  const v = cfg.get(key);
  return typeof v === 'string' ? v : defaultVal;
}

function readTrimmedStringOrDefault(cfg: vscode.WorkspaceConfiguration, key: string, defaultVal: string): string {
  const v = cfg.get(key);
  return typeof v === 'string' ? v.trim() : defaultVal;
}

function readTrimmedNonEmptyStringOrDefault(cfg: vscode.WorkspaceConfiguration, key: string, defaultVal: string): string {
  const t = readTrimmedStringOrDefault(cfg, key, defaultVal);
  return t.length > 0 ? t : defaultVal;
}

export type IntegrationConfigBlock = {
  integrationsBuildCi: IntegrationBuildCiConfig;
  integrationsGit: IntegrationGitConfig;
  integrationsEnvironment: IntegrationEnvironmentConfig;
  integrationsTestResults: IntegrationTestResultsConfig;
  integrationsCoverage: IntegrationCoverageConfig;
  integrationsCodeQuality: IntegrationCodeQualityConfig;
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
  integrationsAdbLogcat: IntegrationAdbLogcatConfig;
  integrationsUnifiedLog: IntegrationUnifiedLogConfig;
};

function parseProjectIndexSources(
  rawSources: unknown,
  docsDirs: readonly string[],
): ProjectIndexSourceConfig[] {
  if (!Array.isArray(rawSources)) {
    return docsDirs.map((dir) => ({ path: dir, fileTypes: ['.md', '.txt', '.json', '.yaml', '.yml', '.toml', '.xml', '.arb', '.rules', '.rst', '.adoc', '.gradle', '.kts', '.dart', '.ini', '.cfg', '.conf', '.properties', '.env', '.sql', '.proto', 'dockerfile', '.hcl', '.tf', '.tfvars', '.csproj', '.sln', '.props', '.targets', '.mod', '.mk', '.sh', '.ps1', '.http', '.rest', 'makefile', 'requirements', 'pipfile'], enabled: true }));
  }
  if (rawSources.length === 0) {
    return docsDirs.map((dir) => ({ path: dir, fileTypes: ['.md', '.txt', '.json', '.yaml', '.yml', '.toml', '.xml', '.arb', '.rules', '.rst', '.adoc', '.gradle', '.kts', '.dart', '.ini', '.cfg', '.conf', '.properties', '.env', '.sql', '.proto', 'dockerfile', '.hcl', '.tf', '.tfvars', '.csproj', '.sln', '.props', '.targets', '.mod', '.mk', '.sh', '.ps1', '.http', '.rest', 'makefile', 'requirements', 'pipfile'], enabled: true }));
  }

  const sources: ProjectIndexSourceConfig[] = [];
  for (const s of rawSources) {
    if (!s) { continue; }
    if (typeof s !== 'object') { continue; }
    const o = s as Record<string, unknown>;

    let pathVal = '';
    if (typeof o.path === 'string') {
      pathVal = o.path.trim();
    }
    if (!pathVal) { continue; }

    let fileTypes = ['.md', '.txt', '.json', '.yaml', '.yml', '.toml', '.xml', '.arb', '.rules', '.rst', '.adoc', '.gradle', '.kts', '.dart', '.ini', '.cfg', '.conf', '.properties', '.env', '.sql', '.proto', 'dockerfile', '.hcl', '.tf', '.tfvars', '.csproj', '.sln', '.props', '.targets', '.mod', '.mk', '.sh', '.ps1', '.http', '.rest', 'makefile', 'requirements', 'pipfile'];
    if (Array.isArray(o.fileTypes)) {
      fileTypes = (o.fileTypes as unknown[]).filter((x): x is string => typeof x === 'string');
    }

    sources.push({ path: pathVal, fileTypes, enabled: o.enabled !== false });
  }
  return sources;
}

export function getIntegrationConfig(cfg: vscode.WorkspaceConfiguration): IntegrationConfigBlock {
  return {
    integrationsBuildCi: {
      source: ensureEnum(cfg.get('integrations.buildCi.source'), ['file', 'github', 'azure', 'gitlab'], 'file'),
      buildInfoPath: readTrimmedNonEmptyStringOrDefault(cfg, 'integrations.buildCi.buildInfoPath', '.saropa/last-build.json'),
      fileMaxAgeMinutes: clamp(cfg.get('integrations.buildCi.fileMaxAgeMinutes'), 1, 1440, 60),
      azureOrg: readTrimmedStringOrDefault(cfg, 'integrations.buildCi.azureOrg', ''),
      azureProject: readTrimmedStringOrDefault(cfg, 'integrations.buildCi.azureProject', ''),
      gitlabProjectId: readTrimmedStringOrDefault(cfg, 'integrations.buildCi.gitlabProjectId', ''),
      gitlabBaseUrl: readTrimmedNonEmptyStringOrDefault(cfg, 'integrations.buildCi.gitlabBaseUrl', 'https://gitlab.com'),
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
      lastRunPath: readTrimmedNonEmptyStringOrDefault(cfg, 'integrations.testResults.lastRunPath', '.saropa/last-test-run.json'),
      junitPath: readStringOrDefault(cfg, 'integrations.testResults.junitPath', ''),
      fileMaxAgeHours: clamp(cfg.get('integrations.testResults.fileMaxAgeHours'), 1, 168, 24),
      includeFailedListInHeader: ensureBoolean(cfg.get('integrations.testResults.includeFailedListInHeader'), false),
    },
    integrationsCoverage: {
      reportPath: readTrimmedNonEmptyStringOrDefault(cfg, 'integrations.coverage.reportPath', 'coverage/lcov.info'),
      includeInHeader: ensureBoolean(cfg.get('integrations.coverage.includeInHeader'), true),
    },
    integrationsCodeQuality: {
      lintReportPath: readTrimmedStringOrDefault(cfg, 'integrations.codeQuality.lintReportPath', ''),
      scanComments: ensureBoolean(cfg.get('integrations.codeQuality.scanComments'), false),
      coverageStaleMaxHours: configNonNegative(cfg, 'integrations.codeQuality.coverageStaleMaxHours', 24),
      includeInBugReport: ensureBoolean(cfg.get('integrations.codeQuality.includeInBugReport'), false),
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
      containerId: readStringOrDefault(cfg, 'integrations.docker.containerId', ''),
      containerNamePattern: readStringOrDefault(cfg, 'integrations.docker.containerNamePattern', ''),
      captureLogs: ensureBoolean(cfg.get('integrations.docker.captureLogs'), true),
      maxLogLines: clamp(cfg.get('integrations.docker.maxLogLines'), 100, 100000, 20000),
      includeInspect: ensureBoolean(cfg.get('integrations.docker.includeInspect'), false),
    },
    integrationsLoki: {
      enabled: ensureBoolean(cfg.get('loki.enabled'), false),
      pushUrl: readTrimmedStringOrDefault(cfg, 'loki.pushUrl', ''),
    },
    integrationsPerformance: {
      snapshotAtStart: ensureBoolean(cfg.get('integrations.performance.snapshotAtStart'), true),
      sampleDuringSession: ensureBoolean(cfg.get('integrations.performance.sampleDuringSession'), false),
      sampleIntervalSeconds: clamp(cfg.get('integrations.performance.sampleIntervalSeconds'), 1, 300, 5),
      includeInHeader: ensureBoolean(cfg.get('integrations.performance.includeInHeader'), true),
      profilerOutputPath: readTrimmedStringOrDefault(cfg, 'integrations.performance.profilerOutputPath', ''),
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
      wslDistro: readTrimmedStringOrDefault(cfg, 'integrations.linuxLogs.wslDistro', ''),
    },
    integrationsExternalLogs: {
      paths: ensureStringArray(cfg.get('integrations.externalLogs.paths'), []),
      writeSidecars: ensureBoolean(cfg.get('integrations.externalLogs.writeSidecars'), true),
      prefixLines: ensureBoolean(cfg.get('integrations.externalLogs.prefixLines'), true),
      maxLinesPerFile: clamp(cfg.get('integrations.externalLogs.maxLinesPerFile'), 100, 1000000, 10000),
    },
    integrationsSecurity: {
      windowsSecurityLog: ensureBoolean(cfg.get('integrations.security.windowsSecurityLog'), false),
      auditLogPath: readTrimmedStringOrDefault(cfg, 'integrations.security.auditLogPath', ''),
      redactSecurityEvents: ensureBoolean(cfg.get('integrations.security.redactSecurityEvents'), true),
      includeSummaryInHeader: ensureBoolean(cfg.get('integrations.security.includeSummaryInHeader'), false),
      includeInBugReport: ensureBoolean(cfg.get('integrations.security.includeInBugReport'), false),
    },
    integrationsDatabase: {
      mode: ensureEnum(cfg.get('integrations.database.mode'), ['parse', 'file', 'api'], 'parse'),
      queryLogPath: readTrimmedStringOrDefault(cfg, 'integrations.database.queryLogPath', ''),
      requestIdPattern: readTrimmedStringOrDefault(cfg, 'integrations.database.requestIdPattern', ''),
      queryBlockPattern: readTrimmedStringOrDefault(cfg, 'integrations.database.queryBlockPattern', ''),
      timeWindowSeconds: clamp(cfg.get('integrations.database.timeWindowSeconds'), 1, 120, 5),
      maxQueriesPerLookup: clamp(cfg.get('integrations.database.maxQueriesPerLookup'), 1, 200, 20),
    },
    integrationsHttp: {
      requestIdPattern: readTrimmedStringOrDefault(cfg, 'integrations.http.requestIdPattern', ''),
      requestLogPath: readTrimmedStringOrDefault(cfg, 'integrations.http.requestLogPath', ''),
      timeWindowSeconds: clamp(cfg.get('integrations.http.timeWindowSeconds'), 1, 120, 10),
      maxRequestsPerSession: clamp(cfg.get('integrations.http.maxRequestsPerSession'), 10, 5000, 500),
    },
    integrationsBrowser: {
      mode: ensureEnum(cfg.get('integrations.browser.mode'), ['file', 'cdp'], 'file'),
      browserLogPath: readTrimmedStringOrDefault(cfg, 'integrations.browser.browserLogPath', ''),
      browserLogFormat: ensureEnum(cfg.get('integrations.browser.browserLogFormat'), ['jsonl', 'json'], 'jsonl'),
      maxEvents: clamp(cfg.get('integrations.browser.maxEvents'), 100, 100000, 10000),
      cdpUrl: readTrimmedStringOrDefault(cfg, 'integrations.browser.cdpUrl', ''),
      includeNetwork: ensureBoolean(cfg.get('integrations.browser.includeNetwork'), false),
      requestIdPattern: readTrimmedStringOrDefault(cfg, 'integrations.browser.requestIdPattern', ''),
    },
    integrationsAdbLogcat: {
      device: readTrimmedStringOrDefault(cfg, 'integrations.adbLogcat.device', ''),
      tagFilters: ensureStringArray(cfg.get('integrations.adbLogcat.tagFilters'), []),
      minLevel: ensureEnum(cfg.get('integrations.adbLogcat.minLevel'), ['V', 'D', 'I', 'W', 'E', 'F', 'A'], 'V'),
      filterByPid: ensureBoolean(cfg.get('integrations.adbLogcat.filterByPid'), true),
      maxBufferLines: clamp(cfg.get('integrations.adbLogcat.maxBufferLines'), 1000, 500000, 50000),
      writeSidecar: ensureBoolean(cfg.get('integrations.adbLogcat.writeSidecar'), true),
    },
    integrationsUnifiedLog: {
      writeAtSessionEnd: ensureBoolean(cfg.get('integrations.unifiedLog.writeAtSessionEnd'), false),
      maxLinesPerSource: clamp(cfg.get('integrations.unifiedLog.maxLinesPerSource'), 1000, 500000, 50000),
    },
  };
}

export function getProjectIndexConfig(cfg: vscode.WorkspaceConfiguration): ProjectIndexConfig {
  const rawSources = cfg.get("projectIndex.sources");
  const docsDirs = ensureStringArray(cfg.get("docsScanDirs"), ["bugs", "docs"]);
  const sources = parseProjectIndexSources(rawSources, docsDirs);
  return {
    enabled: ensureBoolean(cfg.get('projectIndex.enabled'), true),
    sources,
    includeRootFiles: ensureBoolean(cfg.get('projectIndex.includeRootFiles'), true),
    includeReports: ensureBoolean(cfg.get('projectIndex.includeReports'), true),
    maxFilesPerSource: clamp(cfg.get('projectIndex.maxFilesPerSource'), 10, 1000, 100),
    refreshInterval: clamp(cfg.get('projectIndex.refreshInterval'), 0, 3600, 0),
  };
}
