/**
 * Small embed fragments for `renderItem()` DB timestamp burst classes (viewer-data-helpers-render.ts max-lines).
 */
export const VIEWER_RENDER_EMBED_MARKER_BURST_EDGE = /* javascript */ `
        var _burstEdgeCls = '';
        if (item.markerBurstEdge === 'top' || item.markerBurstEdge === 'bottom') {
            _burstEdgeCls = ' marker-db-ts-burst-edge marker-db-ts-burst-' + item.markerBurstEdge;
        }
`;

export const VIEWER_RENDER_EMBED_LINE_DB_TS_BURST = /* javascript */ `
    var dbTsBurstCls = '';
    if (item.dbTsBurstSegment === 'first') dbTsBurstCls = ' db-ts-burst-member db-ts-burst-first';
    else if (item.dbTsBurstSegment === 'mid') dbTsBurstCls = ' db-ts-burst-member db-ts-burst-mid';
    else if (item.dbTsBurstSegment === 'last') dbTsBurstCls = ' db-ts-burst-member db-ts-burst-last';
`;
