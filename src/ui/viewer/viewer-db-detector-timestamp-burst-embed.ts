/**
 * Embedded JS for the DB timestamp burst detector (plan **DB_16**).
 *
 * Extracted from `viewer-db-detector-framework-script.ts` to respect file line budget.
 * Registers into the shared `dbDetectorRegistry`; uses global `tsBurstBySession` and
 * `viewerTimestampBurstThresholds` declared by the framework script.
 */

import { TIMESTAMP_BURST_DETECTOR_ID } from "../../modules/db/drift-db-timestamp-burst-detector";

/** Returns the JS string that registers the timestamp burst detector. */
export function getTimestampBurstDetectorEmbedJs(): string {
  return /* javascript */ `
    registerDbDetector({
        id: '${TIMESTAMP_BURST_DETECTOR_ID}',
        priority: 80,
        feed: function(ctx) {
            if (typeof viewerDbDetectorTimestampBurstEnabled !== 'undefined' && !viewerDbDetectorTimestampBurstEnabled) return [];
            if (!ctx || !viewerTimestampBurstThresholds) return [];
            var now = ctx.timestampMs;
            if (typeof now !== 'number' || !isFinite(now)) return [];
            var anc = ctx.anchorSeq;
            if (typeof anc !== 'number' || !isFinite(anc)) return [];
            var sid = (ctx.sessionId != null && ctx.sessionId !== '') ? String(ctx.sessionId) : 'default';
            var st = tsBurstBySession[sid];
            if (!st) { st = { refTs: 0, count: 0, firstSeq: 0, emitted: false, lastEmitTs: 0 }; tsBurstBySession[sid] = st; }
            var tol = viewerTimestampBurstThresholds.toleranceMs;
            var minN = viewerTimestampBurstThresholds.minCount;
            var cool = viewerTimestampBurstThresholds.cooldownMs;
            if (st.count > 0 && Math.abs(now - st.refTs) <= tol) {
                st.count++;
            } else {
                st.refTs = now;
                st.count = 1;
                st.firstSeq = anc;
                st.emitted = false;
            }
            if (st.count < minN || st.emitted) return [];
            if (cool > 0 && st.lastEmitTs > 0 && now - st.lastEmitTs < cool) return [];
            st.emitted = true;
            st.lastEmitTs = now;
            return [{
                kind: 'marker',
                detectorId: '${TIMESTAMP_BURST_DETECTOR_ID}',
                stableKey: '${TIMESTAMP_BURST_DETECTOR_ID}::' + sid + '::' + st.firstSeq,
                priority: 80,
                payload: {
                    category: 'db-signal',
                    label: 'DB timestamp burst (' + st.count + ' queries at same instant)',
                    anchorSeq: anc
                }
            }];
        }
    });
`;
}
