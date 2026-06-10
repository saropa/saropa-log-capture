import * as assert from "assert";
import {
    GlobalAggregateStore,
    canPromote,
    isFrameworkClass,
} from "../../../modules/learning/global-aggregates";

/** Minimal in-memory Memento stand-in for globalState. */
class FakeMemento {
    private readonly m = new Map<string, unknown>();
    get<T>(key: string, def?: T): T {
        return (this.m.has(key) ? this.m.get(key) : def) as T;
    }
    update(key: string, value: unknown): Thenable<void> {
        if (value === undefined) { this.m.delete(key); } else { this.m.set(key, value); }
        return Promise.resolve();
    }
    keys(): readonly string[] { return [...this.m.keys()]; }
}

function store(): GlobalAggregateStore {
    return new GlobalAggregateStore(new FakeMemento() as unknown as import("vscode").Memento);
}

suite("global-aggregates canPromote", () => {
    test("blocks when not opted in, regardless of everything else", () => {
        assert.strictEqual(canPromote("flutter noise", "framework", 0.99, false), false);
    });
    test("allows a clean framework-class high-confidence pattern when opted in", () => {
        assert.strictEqual(canPromote("flutter noise", "framework", 0.99, true), true);
    });
    test("blocks the non-promotable 'noise' category", () => {
        assert.strictEqual(canPromote("flutter noise", "noise", 0.99, true), false);
    });
    test("blocks below the 0.95 confidence bar", () => {
        assert.strictEqual(canPromote("flutter noise", "framework", 0.9, true), false);
    });
    test("blocks a pattern that fails the deny-list even when everything else passes", () => {
        assert.strictEqual(canPromote("C:\\Users\\x\\main.dart", "framework", 0.99, true), false);
    });
    test("isFrameworkClass covers framework/verbose/repetitive, not noise", () => {
        assert.ok(isFrameworkClass("framework") && isFrameworkClass("verbose") && isFrameworkClass("repetitive"));
        assert.ok(!isFrameworkClass("noise"));
    });
});

suite("global-aggregates store", () => {
    test("promote then list returns the pattern with count 1", async () => {
        const s = store();
        await s.promote("flutter noise", "framework", 100);
        const list = s.list();
        assert.strictEqual(list.length, 1);
        assert.strictEqual(list[0].pattern, "flutter noise");
        assert.strictEqual(list[0].acceptedInWorkspaces, 1);
    });

    test("promoting the same pattern again bumps the workspace count", async () => {
        const s = store();
        await s.promote("p", "framework", 100);
        await s.promote("p", "framework", 200);
        const list = s.list();
        assert.strictEqual(list.length, 1, "still one entry");
        assert.strictEqual(list[0].acceptedInWorkspaces, 2);
        assert.strictEqual(list[0].lastPromotedAt, 200, "lastPromotedAt updates");
    });

    test("clear wipes all global aggregates", async () => {
        const s = store();
        await s.promote("p", "framework", 100);
        await s.clear();
        assert.strictEqual(s.list().length, 0);
    });

    test("enforces the 200-pattern cap with FIFO eviction by lastPromotedAt", async () => {
        const s = store();
        // 201 distinct patterns, ascending timestamps → the oldest (ts=0) must be evicted.
        for (let i = 0; i <= 200; i++) { await s.promote("p" + i, "framework", i); }
        const list = s.list();
        assert.strictEqual(list.length, 200, "capped at 200");
        assert.ok(!list.some((p) => p.pattern === "p0"), "oldest-promoted entry evicted");
        assert.ok(list.some((p) => p.pattern === "p200"), "newest kept");
    });
});
