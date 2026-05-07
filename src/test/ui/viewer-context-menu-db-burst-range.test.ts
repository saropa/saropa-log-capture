import * as assert from "node:assert";
import test from "node:test";
import { computeDbTimestampBurstRange } from "../../ui/viewer-context-menu/viewer-context-menu-db-burst-range";

function burstLines(): Parameters<typeof computeDbTimestampBurstRange>[0] {
    return [
        { type: "line", html: "before" },
        { type: "marker", markerBurstEdge: "top", html: "<span>DB timestamp burst</span>" },
        { type: "line", dbTsBurstSegment: "first", html: "q1" },
        { type: "line", dbTsBurstSegment: "mid", html: "q2" },
        { type: "line", dbTsBurstSegment: "last", html: "q3" },
        { type: "marker", markerBurstEdge: "bottom", html: "<span>DB timestamp burst</span>" },
        { type: "line", html: "after" },
    ];
}

test("computeDbTimestampBurstRange from member mid", () => {
    const lines = burstLines();
    assert.deepStrictEqual(computeDbTimestampBurstRange(lines, 3), { lo: 1, hi: 5 });
});

test("computeDbTimestampBurstRange from top marker", () => {
    const lines = burstLines();
    assert.deepStrictEqual(computeDbTimestampBurstRange(lines, 1), { lo: 1, hi: 5 });
});

test("computeDbTimestampBurstRange from bottom marker", () => {
    const lines = burstLines();
    assert.deepStrictEqual(computeDbTimestampBurstRange(lines, 5), { lo: 1, hi: 5 });
});

test("computeDbTimestampBurstRange null outside burst", () => {
    const lines = burstLines();
    assert.strictEqual(computeDbTimestampBurstRange(lines, 0), null);
    assert.strictEqual(computeDbTimestampBurstRange(lines, 6), null);
});

test("computeDbTimestampBurstRange three-member minimum burst", () => {
    const lines: Parameters<typeof computeDbTimestampBurstRange>[0] = [
        { type: "marker", markerBurstEdge: "top", html: "t" },
        { type: "line", dbTsBurstSegment: "first", html: "a" },
        { type: "line", dbTsBurstSegment: "mid", html: "b" },
        { type: "line", dbTsBurstSegment: "last", html: "c" },
        { type: "marker", markerBurstEdge: "bottom", html: "b" },
    ];
    assert.deepStrictEqual(computeDbTimestampBurstRange(lines, 2), { lo: 0, hi: 4 });
});
