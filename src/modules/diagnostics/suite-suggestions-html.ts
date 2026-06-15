/**
 * Builds the "suggested for your project" block for the Integrations screen, plus the suggestion
 * count that feeds the icon-bar badge. Reads the workspace manifests (pubspec.yaml / package.json),
 * maps declared packages to the integration adapters that enrich them (reusing the same pure tables
 * the activation nudge uses), and drops anything already enabled — so the screen shows only the
 * adapters worth turning on, each with the package that justifies it.
 *
 * Host-side (reads fs, reads settings, localizes labels). The webview injects the returned HTML and
 * wires each row's Enable button to the existing integration checkbox.
 */

import * as vscode from 'vscode';
import { escapeHtml } from '../capture/ansi';
import { t } from '../../l10n';
import { getConfig } from '../config/config';
import { readPubspecDependencies, readPackageJsonDependencies } from '../misc/manifest-dependencies';
import {
  suggestAdaptersFromPubspec,
  suggestAdaptersFromPackageJson,
  type AdapterRecommendation,
} from '../misc/adapter-recommendations';
import { INTEGRATION_ADAPTERS } from '../integrations/integrations-ui';
import { hasAndroidApp } from '../misc/workspace-app-detection';

/** count drives the badge (with issues); html fills the suggestions container. */
export interface SuiteSuggestionsPayload {
  readonly count: number;
  readonly html: string;
}

/** Friendly label for an adapter id, falling back to the raw id. */
function adapterLabel(id: string): string {
  return INTEGRATION_ADAPTERS.find((a) => a.id === id)?.label ?? id;
}

/** Dedupe recommendations by adapter id, keeping the first (pubspec-then-package.json) trigger. */
function dedupeByAdapter(recs: readonly AdapterRecommendation[]): AdapterRecommendation[] {
  const seen = new Set<string>();
  const out: AdapterRecommendation[] = [];
  for (const rec of recs) {
    if (seen.has(rec.adapter)) { continue; }
    seen.add(rec.adapter);
    out.push(rec);
  }
  return out;
}

/** One suggestion row: the integration, the package that justifies it, and an Enable button. */
function suggestionRowHtml(rec: AdapterRecommendation): string {
  return `<div class="suite-suggest-row">` +
    `<span class="suite-suggest-label">${escapeHtml(adapterLabel(rec.adapter))}</span>` +
    `<span class="suite-suggest-reason">${escapeHtml(t('viewer.integrations.suggestReason', rec.trigger))}</span>` +
    `<button type="button" class="suite-suggest-enable" data-adapter-id="${escapeHtml(rec.adapter)}">` +
    `${escapeHtml(t('viewer.integrations.suggestEnable'))}</button>` +
    `</div>`;
}

/**
 * Read both manifests, compute the not-yet-enabled adapters their packages imply, and render the
 * suggestions block + count. Best-effort: no workspace or unreadable manifests yield an empty set
 * (the readers never throw), so the block simply does not appear.
 */
export async function buildSuiteSuggestions(): Promise<SuiteSuggestionsPayload> {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) {
    return { count: 0, html: '' };
  }
  const enabled = getConfig().integrationsAdapters ?? [];
  const [pubspecDeps, packageJsonDeps] = await Promise.all([
    readPubspecDependencies(folder.uri),
    readPackageJsonDependencies(folder.uri),
  ]);
  const merged = dedupeByAdapter([
    ...suggestAdaptersFromPubspec(pubspecDeps, enabled),
    ...suggestAdaptersFromPackageJson(packageJsonDeps, enabled),
  ]);
  // adb logcat is keyed off `flutter`, which every Flutter package declares; only suggest it when a
  // real Android app module exists to attach to — matching the activation nudge's behavior.
  const recs = (await hasAndroidApp())
    ? merged
    : merged.filter((rec) => rec.adapter !== 'adbLogcat');
  if (recs.length === 0) {
    return { count: 0, html: '' };
  }
  const heading = `<div class="suite-suggest-heading">${escapeHtml(t('viewer.integrations.suggestHeading'))}</div>`;
  return { count: recs.length, html: heading + recs.map(suggestionRowHtml).join('') };
}
