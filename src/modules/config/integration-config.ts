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
      buildInfoPath: cfg.get<string>("integrations.buildCi.buildInfoPath", ".saropa/last-build.json"),
      fileMaxAgeMinutes: Math.max(1, Math.min(1440, cfg.get<number>("integrations.buildCi.fileMaxAgeMinutes", 60))),
    },
    integrationsGit: {
      describeInHeader: cfg.get<boolean>("integrations.git.describeInHeader", true),
      uncommittedInHeader: cfg.get<boolean>("integrations.git.uncommittedInHeader", true),
      stashInHeader: cfg.get<boolean>("integrations.git.stashInHeader", false),
    },
    integrationsEnvironment: {
      includeEnvChecksum: cfg.get<boolean>("integrations.environment.includeEnvChecksum", false),
      configFiles: cfg.get<string[]>("integrations.environment.configFiles", []),
      includeInHeader: cfg.get<boolean>("integrations.environment.includeInHeader", true),
    },
    integrationsTestResults: {
      source: (cfg.get<string>("integrations.testResults.source", "file") as 'file' | 'junit'),
      lastRunPath: cfg.get<string>("integrations.testResults.lastRunPath", ".saropa/last-test-run.json"),
      junitPath: cfg.get<string>("integrations.testResults.junitPath", ""),
      fileMaxAgeHours: Math.max(1, Math.min(168, cfg.get<number>("integrations.testResults.fileMaxAgeHours", 24))),
      includeFailedListInHeader: cfg.get<boolean>("integrations.testResults.includeFailedListInHeader", false),
    },
    integrationsCoverage: {
      reportPath: cfg.get<string>("integrations.coverage.reportPath", "coverage/lcov.info"),
      includeInHeader: cfg.get<boolean>("integrations.coverage.includeInHeader", true),
    },
    integrationsCrashDumps: {
      searchPaths: cfg.get<string[]>("integrations.crashDumps.searchPaths", []),
      extensions: cfg.get<string[]>("integrations.crashDumps.extensions", [".dmp", ".mdmp", ".core"]),
      leadMinutes: Math.max(0, cfg.get<number>("integrations.crashDumps.leadMinutes", 1)),
      lagMinutes: Math.max(0, cfg.get<number>("integrations.crashDumps.lagMinutes", 5)),
      maxFiles: Math.min(100, Math.max(1, cfg.get<number>("integrations.crashDumps.maxFiles", 20))),
      includeInHeader: cfg.get<boolean>("integrations.crashDumps.includeInHeader", true),
    },
    integrationsWindowsEvents: {
      logs: cfg.get<string[]>("integrations.windowsEvents.logs", ["Application", "System"]),
      levels: cfg.get<string[]>("integrations.windowsEvents.levels", ["Critical", "Error", "Warning"]),
      leadMinutes: Math.max(0, cfg.get<number>("integrations.windowsEvents.leadMinutes", 2)),
      lagMinutes: Math.max(0, cfg.get<number>("integrations.windowsEvents.lagMinutes", 5)),
      maxEvents: Math.min(500, Math.max(1, cfg.get<number>("integrations.windowsEvents.maxEvents", 200))),
    },
    integrationsDocker: {
      runtime: (cfg.get<string>("integrations.docker.runtime", "docker") as 'docker' | 'podman'),
      containerId: cfg.get<string>("integrations.docker.containerId", ""),
      containerNamePattern: cfg.get<string>("integrations.docker.containerNamePattern", ""),
      captureLogs: cfg.get<boolean>("integrations.docker.captureLogs", true),
      maxLogLines: Math.min(100000, Math.max(100, cfg.get<number>("integrations.docker.maxLogLines", 20000))),
    },
  };
}

export function getProjectIndexConfig(cfg: vscode.WorkspaceConfiguration): ProjectIndexConfig {
  const rawSources = cfg.get<Array<{ path: string; fileTypes?: string[]; enabled?: boolean }>>("projectIndex.sources");
  const docsDirs = cfg.get<string[]>("docsScanDirs", ["bugs", "docs"]);
  const sources: ProjectIndexSourceConfig[] = Array.isArray(rawSources) && rawSources.length > 0
    ? rawSources.map((s) => ({
        path: String(s?.path ?? ""),
        fileTypes: Array.isArray(s?.fileTypes) ? s.fileTypes : [".md", ".txt"],
        enabled: s?.enabled !== false,
      })).filter((s) => s.path.length > 0)
    : docsDirs.map((dir) => ({ path: dir, fileTypes: [".md", ".txt"], enabled: true }));
  return {
    enabled: cfg.get<boolean>("projectIndex.enabled", true),
    sources,
    includeRootFiles: cfg.get<boolean>("projectIndex.includeRootFiles", true),
    includeReports: cfg.get<boolean>("projectIndex.includeReports", true),
    maxFilesPerSource: Math.min(1000, Math.max(10, cfg.get<number>("projectIndex.maxFilesPerSource", 100))),
    refreshInterval: Math.min(3600, Math.max(0, cfg.get<number>("projectIndex.refreshInterval", 0))),
  };
}
