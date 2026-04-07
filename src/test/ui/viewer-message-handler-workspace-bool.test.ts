import * as assert from "node:assert";
import { SAROPA_BOOL_SETTING_BY_MSG_TYPE } from "../../ui/provider/viewer-workspace-bool-message-map";

/**
 * Before: `setMinimapSqlDensity` was the only webview message type handled by a dedicated switch case.
 * After: the same and related layout toggles route through `SAROPA_BOOL_SETTING_BY_MSG_TYPE` so new
 * boolean settings do not duplicate `getConfiguration().update` blocks.
 */
suite("viewer-message-handler workspace bool messages", () => {
    test("maps each webview message type to the saropaLogCapture config key", () => {
        assert.strictEqual(SAROPA_BOOL_SETTING_BY_MSG_TYPE.setMinimapSqlDensity, "minimapShowSqlDensity");
        assert.strictEqual(SAROPA_BOOL_SETTING_BY_MSG_TYPE.setMinimapProportionalLines, "minimapProportionalLines");
        assert.strictEqual(SAROPA_BOOL_SETTING_BY_MSG_TYPE.setShowScrollbar, "showScrollbar");
        assert.strictEqual(SAROPA_BOOL_SETTING_BY_MSG_TYPE.setMinimapShowInfoMarkers, "minimapShowInfoMarkers");
        assert.strictEqual(SAROPA_BOOL_SETTING_BY_MSG_TYPE.setMinimapViewportRedOutline, "minimapViewportRedOutline");
        assert.strictEqual(SAROPA_BOOL_SETTING_BY_MSG_TYPE.setMinimapViewportOutsideArrow, "minimapViewportOutsideArrow");
    });

    test("does not include unrelated message types", () => {
        assert.strictEqual(SAROPA_BOOL_SETTING_BY_MSG_TYPE.setMinimapWidth, undefined);
    });
});
