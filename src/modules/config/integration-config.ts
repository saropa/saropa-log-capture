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
