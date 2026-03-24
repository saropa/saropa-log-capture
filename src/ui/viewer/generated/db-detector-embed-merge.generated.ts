/**
 * AUTO-GENERATED — do not edit. Run `npm run generate:db-detector-embed-merge`.
 * Source: src/modules/db/db-detector-merge-stable-key.ts
 */
export const EMBED_MERGE_DB_DETECTOR_RESULTS_JS = "function mergeDbDetectorResultsByStableKey(results) {\n  const order = [];\n  const byKey = /* @__PURE__ */ Object.create(null);\n  for (const r of results) {\n    if (!(r == null ? void 0 : r.stableKey)) {\n      continue;\n    }\n    if (byKey[r.stableKey] === void 0) {\n      order.push(r.stableKey);\n    }\n    byKey[r.stableKey] = r;\n  }\n  return order.map((k) => byKey[k]);\n}\n";
