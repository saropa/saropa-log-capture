#!/usr/bin/env node
/**
 * One-time script to implement docs/src-folder-reorganization-plan.md.
 * Run from repo root: node scripts/reorganize-src.mjs
 * Phase 1: modules. Phase 2: ui. Phase 3: test moves + import updates.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const src = path.join(root, 'src');

const MODULE_TO_SUBFOLDER = {
  tracker: 'capture', 'log-session': 'capture', 'log-session-split': 'capture',
  'log-session-helpers': 'capture', deduplication: 'capture', 'dap-formatter': 'capture',
  ansi: 'capture', 'flood-guard': 'capture',
  'session-manager': 'session', 'session-event-bus': 'session', 'session-metadata': 'session',
  'session-lifecycle': 'session', 'session-summary': 'session', 'session-templates': 'session',
  'run-boundaries': 'session', 'run-summaries': 'session', 'metadata-loader': 'session',
  config: 'config', 'config-file-utils': 'config', 'file-retention': 'config', 'gitignore-checker': 'config',
  'firebase-crashlytics': 'crashlytics', 'crashlytics-api': 'crashlytics', 'crashlytics-types': 'crashlytics',
  'crashlytics-io': 'crashlytics', 'crashlytics-stats': 'crashlytics', 'crashlytics-ai-summary': 'crashlytics',
  'crashlytics-event-parser': 'crashlytics', 'crashlytics-diagnostics': 'crashlytics',
  'google-play-vitals': 'crashlytics', 'google-play-vitals-types': 'crashlytics',
  'bug-report-formatter': 'bug-report', 'bug-report-sections': 'bug-report', 'bug-report-collector': 'bug-report',
  'bug-report-lint-section': 'bug-report', 'bug-report-thread-format': 'bug-report',
  'ai-jsonl-parser': 'ai', 'ai-jsonl-types': 'ai', 'ai-line-formatter': 'ai', 'ai-session-resolver': 'ai', 'ai-watcher': 'ai',
  'html-export': 'export', 'html-export-interactive': 'export', 'html-export-script': 'export',
  'html-export-json': 'export', 'html-export-styles': 'export', 'export-formats': 'export',
  'log-search': 'search', 'log-search-ui': 'search', 'search-index': 'search',
  'source-linker': 'source', 'source-resolver': 'source', 'source-tag-parser': 'source',
  'link-helpers': 'source', 'symbol-resolver': 'source', 'import-extractor': 'source',
  'stack-parser': 'analysis', 'level-classifier': 'analysis', 'line-analyzer': 'analysis',
  'analysis-relevance': 'analysis', 'error-fingerprint': 'analysis', 'anr-risk-scorer': 'analysis',
  'duration-extractor': 'analysis', 'correlation-scanner': 'analysis', 'related-lines-scanner': 'analysis',
  'git-blame': 'git', 'git-diff': 'git', 'github-context': 'git',
  'bookmark-store': 'storage', 'filter-presets': 'storage', 'scope-context': 'storage',
  'highlight-rules': 'storage', 'highlight-rules-types': 'storage',
  'keyword-watcher': 'features', 'exclusion-matcher': 'features', 'error-rate-alert': 'features',
  'deep-links': 'features', 'delete-command': 'features',
  'json-detector': 'misc', 'file-splitter': 'misc', 'device-detector': 'misc', 'app-identity': 'misc',
  'app-version': 'misc', 'error-status-store': 'misc', 'docs-scanner': 'misc', 'workspace-analyzer': 'misc',
  'environment-collector': 'misc', 'diff-engine': 'misc', 'auto-tagger': 'misc', 'session-templates-ui': 'misc',
  'folder-organizer': 'misc', 'perf-fingerprint': 'misc', 'perf-aggregator': 'misc', 'cross-session-aggregator': 'misc',
  'package-detector': 'misc', 'lint-violation-reader': 'misc',
};

const UI_TO_SUBFOLDER = {
  'log-viewer-provider': 'provider', 'viewer-provider-helpers': 'provider', 'viewer-handler-wiring': 'provider',
  'viewer-message-handler': 'provider', 'viewer-broadcaster': 'provider', 'viewer-content': 'provider', 'viewer-layout': 'provider',
  'viewer-script': 'viewer', 'viewer-script-keyboard': 'viewer', 'viewer-data': 'viewer', 'viewer-data-helpers': 'viewer',
  'viewer-data-viewport': 'viewer', 'viewer-file-loader': 'viewer', 'viewer-target': 'viewer', 'viewer-visibility': 'viewer',
  'viewer-scroll-anchor': 'viewer', 'viewer-scrollbar-minimap': 'viewer', 'viewer-copy': 'viewer', 'viewer-pin': 'viewer',
  'viewer-timing': 'viewer', 'viewer-goto-line': 'viewer', 'viewer-annotations': 'viewer', 'viewer-json': 'viewer',
  'viewer-stats': 'viewer', 'viewer-audio': 'viewer',
  'viewer-styles': 'viewer-styles', 'viewer-styles-overlays': 'viewer-styles', 'viewer-styles-decoration': 'viewer-styles',
  'viewer-styles-session-panel': 'viewer-styles', 'viewer-styles-session': 'viewer-styles', 'viewer-styles-session-tags-loading': 'viewer-styles',
  'viewer-styles-session-list': 'viewer-styles', 'viewer-styles-about': 'viewer-styles', 'viewer-styles-content': 'viewer-styles',
  'viewer-styles-icon-bar': 'viewer-styles', 'viewer-styles-performance': 'viewer-styles', 'viewer-styles-recurring': 'viewer-styles',
  'viewer-styles-info': 'viewer-styles', 'viewer-styles-trash': 'viewer-styles', 'viewer-styles-bookmarks': 'viewer-styles',
  'viewer-styles-find': 'viewer-styles', 'viewer-styles-options': 'viewer-styles', 'viewer-styles-search': 'viewer-styles',
  'viewer-styles-tags': 'viewer-styles', 'viewer-styles-exclusion-chips': 'viewer-styles', 'viewer-styles-components': 'viewer-styles',
  'viewer-styles-ui': 'viewer-styles', 'viewer-styles-level': 'viewer-styles', 'viewer-styles-ai': 'viewer-styles',
  'viewer-styles-errors': 'viewer-styles', 'viewer-styles-modal': 'viewer-styles', 'viewer-styles-run-separator': 'viewer-styles',
  'viewer-styles-crashlytics': 'viewer-styles',
  'viewer-session-panel': 'viewer-panels', 'viewer-session-panel-html': 'viewer-panels', 'viewer-options-panel': 'viewer-panels',
  'viewer-options-panel-html': 'viewer-panels', 'viewer-options-panel-script': 'viewer-panels', 'viewer-options-events': 'viewer-panels',
  'viewer-bookmark-panel': 'viewer-panels', 'viewer-trash-panel': 'viewer-panels', 'viewer-export': 'viewer-panels',
  'viewer-export-html': 'viewer-panels', 'viewer-export-script': 'viewer-panels', 'viewer-export-init': 'viewer-panels',
  'viewer-find-panel': 'viewer-panels', 'viewer-about-panel': 'viewer-panels', 'about-content-loader': 'viewer-panels', 'pop-out-panel': 'viewer-panels',
  'viewer-session-nav': 'viewer-nav', 'viewer-session-header': 'viewer-nav', 'viewer-run-nav': 'viewer-nav', 'viewer-split-nav': 'viewer-nav', 'viewer-icon-bar': 'viewer-nav',
  'viewer-search': 'viewer-search-filter', 'viewer-search-toggles': 'viewer-search-filter', 'viewer-search-history': 'viewer-search-filter',
  'viewer-filter': 'viewer-search-filter', 'viewer-level-filter': 'viewer-search-filter', 'viewer-level-events': 'viewer-search-filter',
  'viewer-level-classify': 'viewer-search-filter', 'viewer-exclusions': 'viewer-search-filter', 'viewer-filters-panel': 'viewer-search-filter',
  'viewer-filters-panel-html': 'viewer-search-filter', 'viewer-filters-panel-script': 'viewer-search-filter', 'viewer-filter-badge': 'viewer-search-filter',
  'viewer-scope-filter': 'viewer-search-filter', 'viewer-presets': 'viewer-search-filter',
  'viewer-context-menu': 'viewer-context-menu', 'viewer-context-menu-html': 'viewer-context-menu', 'viewer-session-context-menu': 'viewer-context-menu',
  'viewer-context-modal': 'viewer-context-menu', 'viewer-edit-modal': 'viewer-context-menu',
  'viewer-decorations': 'viewer-decorations', 'viewer-deco-settings': 'viewer-decorations', 'viewer-highlight': 'viewer-decorations',
  'viewer-highlight-serializer': 'viewer-decorations', 'viewer-error-breakpoint': 'viewer-decorations', 'viewer-error-classification': 'viewer-decorations',
  'viewer-error-handler': 'viewer-decorations', 'inline-decorations': 'viewer-decorations',
  'viewer-stack-filter': 'viewer-stack-tags', 'viewer-stack-dedup': 'viewer-stack-tags', 'viewer-source-tags': 'viewer-stack-tags',
  'viewer-source-tags-ui': 'viewer-stack-tags', 'viewer-class-tags': 'viewer-stack-tags',
  'session-history-provider': 'session', 'session-history-helpers': 'session', 'session-history-grouping': 'session',
  'session-severity-counts': 'session', 'session-display': 'session', 'session-comparison': 'session', 'session-comparison-styles': 'session',
  'analysis-panel': 'analysis', 'analysis-panel-render': 'analysis', 'analysis-panel-script': 'analysis', 'analysis-panel-styles': 'analysis',
  'analysis-panel-summary': 'analysis', 'analysis-panel-helpers': 'analysis', 'analysis-panel-streams': 'analysis',
  'analysis-frame-handler': 'analysis', 'analysis-frame-render': 'analysis', 'analysis-related-render': 'analysis',
  'analysis-trend-render': 'analysis', 'analysis-crash-detail': 'analysis',
  'insights-panel': 'insights', 'insights-panel-script': 'insights', 'insights-panel-styles': 'insights', 'insights-panel-environment': 'insights',
  'insights-drill-down': 'insights', 'insights-drill-down-styles': 'insights', 'insights-crashlytics-bridge': 'insights',
  'timeline-panel': 'panels', 'timeline-panel-styles': 'panels', 'bug-report-panel': 'panels', 'bug-report-panel-styles': 'panels',
  'viewer-performance-panel': 'panels', 'viewer-performance-current': 'panels', 'viewer-recurring-panel': 'panels',
  'viewer-crashlytics-panel': 'panels', 'vitals-panel': 'panels',
  'status-bar': 'shared', 'viewer-panel-handlers': 'shared', 'crashlytics-codelens': 'shared',
  'viewer-session-tags': 'viewer-panels', 'viewer-session-transforms': 'viewer', 'viewer-watch': 'viewer',
};

const TEST_TO_MODULE_SUBFOLDER = {
  'run-summaries.test': 'session', 'session-metadata.test': 'session', 'run-boundaries.test': 'session', 'metadata-loader.test': 'session',
  'session-manager.test': 'session', 'session-severity-counts.test': 'session', 'session-templates.test': 'session', 'session-summary.test': 'session',
  'session-display.test': 'session',
  'ansi.test': 'capture', 'deduplication.test': 'capture', 'dap-formatter.test': 'capture', 'flood-guard.test': 'capture',
  'log-session-helpers.test': 'capture',
  'config.test': 'config',
  'filter-presets.test': 'storage', 'bookmark-store.test': 'storage', 'highlight-rules.test': 'storage',
  'keyword-watcher.test': 'features', 'error-rate-alert.test': 'features', 'deep-links.test': 'features', 'exclusion.test': 'features',
  'bug-report-formatter.test': 'bug-report',
  'export-formats.test': 'export',
  'log-search.test': 'search', 'search-index.test': 'search',
  'source-linker.test': 'source', 'source-tag-parser.test': 'source', 'source-resolver.test': 'source', 'link-helpers.test': 'source',
  'stack-parser.test': 'analysis', 'stack-parser-thread.test': 'analysis', 'level-classifier.test': 'analysis', 'line-analyzer.test': 'analysis',
  'analysis-relevance.test': 'analysis', 'error-fingerprint.test': 'analysis', 'anr-risk-scorer.test': 'analysis', 'duration-extractor.test': 'analysis',
  'device-detector.test': 'misc', 'json-detector.test': 'misc', 'file-splitter.test': 'misc', 'diff-engine.test': 'misc', 'auto-tagger.test': 'misc',
  'lint-violation-reader.test': 'misc',
  'viewer-options-panel.test': 'ui', 'viewer-context-menu.test': 'ui', 'viewer-script-syntax.test': 'ui', 'thread-grouping.test': 'ui',
  'inline-decorations.test': 'ui', 'extension.test': 'root',
};

function mkdirSyncRecursive(dir) {
  if (fs.existsSync(dir)) return;
  mkdirSyncRecursive(path.dirname(dir));
  fs.mkdirSync(dir);
}

function gitMv(from, to) {
  const fromFull = path.join(root, from);
  const toFull = path.join(root, to);
  if (!fs.existsSync(fromFull)) return;
  mkdirSyncRecursive(path.dirname(toFull));
  execSync(`git mv "${fromFull}" "${toFull}"`, { cwd: root, stdio: 'inherit' });
}

function allTsFiles(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory() && e.name !== 'node_modules') out.push(...allTsFiles(p));
    else if (e.name.endsWith('.ts')) out.push(p);
  }
  return out;
}

/** Return relative prefix (e.g. '../../../') from file to src. */
function relativePrefixToSrc(filePath) {
  const dir = path.dirname(filePath);
  const rel = path.relative(dir, src);
  const segs = rel.split(path.sep).filter(Boolean);
  return segs.length ? '../'.repeat(segs.length) : './';
}

function updateImportsInFile(filePath, map, prefix, contentRef) {
  let content = contentRef.current;
  const prefixToSrc = relativePrefixToSrc(filePath);
  // Match modules/name or modules/sub/name (already updated).
  const re = new RegExp(`(from\\s+['"])([^'"]*?)${prefix.replace('/', '\\/')}\\/([^/'"]+)(?:\\/([^/'"]+))?(['"])`, 'g');
  content = content.replace(re, (_, open, lead, a, b, close) => {
    const sub = b ? a : map[a];
    const name = b || a;
    const newPath = sub ? `${prefixToSrc}${prefix}/${sub}/${name}` : `${prefixToSrc}${prefix}/${name}`;
    return `${open}${newPath}${close}`;
  });
  contentRef.current = content;
}

/** Fix relative imports (./ and ../) inside moved module or ui files. */
function fixRelativeImportsInMovedFile(filePath, map, contentRef, currentSub) {
  let content = contentRef.current;
  const relPath = path.relative(src, path.dirname(filePath));
  const parts = relPath.split(path.sep).filter(Boolean);
  if (parts.length < 2) return; // not in modules/X/ or ui/X/
  const [top, sub] = parts;
  if (top !== 'modules' && top !== 'ui') return;
  const nameToSub = map;
  // from './NAME' -> from '../SUB/NAME' when NAME is in a different subfolder
  content = content.replace(/(from\s+['"])\.\/([^/'"]+)(['"])/g, (_, open, name, close) => {
    const targetSub = nameToSub[name];
    if (!targetSub || targetSub === sub) return open + './' + name + close;
    return `${open}../${targetSub}/${name}${close}`;
  });
  // from '../NAME' -> from '../SUB/NAME'
  content = content.replace(/(from\s+['"])\.\.\/([^/'"]+)(['"])/g, (_, open, name, close) => {
    const targetSub = nameToSub[name];
    if (!targetSub) return open + '../' + name + close;
    return `${open}../${targetSub}/${name}${close}`;
  });
  contentRef.current = content;
}

function main() {
  const phase = process.argv[2] || 'all';
  if (phase === 'modules' || phase === 'all') {
    console.log('Phase 1: Moving modules...');
    for (const [name, sub] of Object.entries(MODULE_TO_SUBFOLDER)) {
      gitMv(path.join('src', 'modules', name + '.ts'), path.join('src', 'modules', sub, name + '.ts'));
    }
    console.log('Updating module imports in src...');
    for (const f of allTsFiles(src)) {
      const ref = { current: fs.readFileSync(f, 'utf8') };
      updateImportsInFile(f, MODULE_TO_SUBFOLDER, 'modules', ref);
      fixRelativeImportsInMovedFile(f, MODULE_TO_SUBFOLDER, ref, null);
      fs.writeFileSync(f, ref.current);
    }
  }
  if (phase === 'ui' || phase === 'all') {
    console.log('Phase 2: Moving ui...');
    for (const [name, sub] of Object.entries(UI_TO_SUBFOLDER)) {
      gitMv(path.join('src', 'ui', name + '.ts'), path.join('src', 'ui', sub, name + '.ts'));
    }
    console.log('Updating ui imports in src...');
    for (const f of allTsFiles(src)) {
      const ref = { current: fs.readFileSync(f, 'utf8') };
      updateImportsInFile(f, UI_TO_SUBFOLDER, 'ui', ref);
      fixRelativeImportsInMovedFile(f, UI_TO_SUBFOLDER, ref, null);
      fs.writeFileSync(f, ref.current);
    }
  }
  if (phase === 'tests' || phase === 'all') {
    console.log('Phase 3: Moving tests...');
    const testDir = path.join(src, 'test');
    if (!fs.existsSync(testDir)) return;
    for (const [base, sub] of Object.entries(TEST_TO_MODULE_SUBFOLDER)) {
      const from = path.join('src', 'test', base + '.ts');
      const toDir = sub === 'root' ? path.join('src', 'test') : sub === 'ui' ? path.join('src', 'test', 'ui') : path.join('src', 'test', 'modules', sub);
      const to = path.join(toDir, path.basename(base + '.ts'));
      if (path.resolve(root, from) !== path.resolve(root, to)) gitMv(from, to);
    }
    console.log('Updating imports in test files...');
    for (const f of allTsFiles(src)) {
      const ref = { current: fs.readFileSync(f, 'utf8') };
      updateImportsInFile(f, MODULE_TO_SUBFOLDER, 'modules', ref);
      updateImportsInFile(f, UI_TO_SUBFOLDER, 'ui', ref);
      fs.writeFileSync(f, ref.current);
    }
  }
  if (phase === 'fix-imports' || phase === 'all') {
    console.log('Recomputing all module and ui import paths...');
    for (const f of allTsFiles(src)) {
      const ref = { current: fs.readFileSync(f, 'utf8') };
      updateImportsInFile(f, MODULE_TO_SUBFOLDER, 'modules', ref);
      updateImportsInFile(f, UI_TO_SUBFOLDER, 'ui', ref);
      fixRelativeImportsInMovedFile(f, MODULE_TO_SUBFOLDER, ref, null);
      fixRelativeImportsInMovedFile(f, UI_TO_SUBFOLDER, ref, null);
      fs.writeFileSync(f, ref.current);
    }
  }
  console.log('Done.');
}

main();
