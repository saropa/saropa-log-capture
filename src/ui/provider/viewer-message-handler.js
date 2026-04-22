"use strict";
/**
 * Dispatches incoming webview postMessage to extension handlers. Each message type
 * (copyToClipboard, editLine, navigateSession, etc.) is routed via ViewerMessageContext
 * callbacks set by LogViewerProvider. Called from the provider's onDidReceiveMessage.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.dispatchViewerMessage = dispatchViewerMessage;
const extension_logger_1 = require("../../modules/misc/extension-logger");
const assert_1 = require("../../modules/misc/assert");
const viewer_message_handler_panels_1 = require("./viewer-message-handler-panels");
const viewer_message_handler_collection_1 = require("./viewer-message-handler-collection");
const viewer_message_handler_actions_1 = require("./viewer-message-handler-actions");
const learning_viewer_message_1 = require("../../modules/learning/learning-viewer-message");
/**
 * Route a webview message to the appropriate handler.
 * @param msg - Incoming message with at least `type`; payload fields vary by type.
 * @param ctx - Callbacks and state (current file, post, load, etc.) for handling the message.
 */
function dispatchViewerMessage(msg, ctx) {
    (0, assert_1.assertDefined)(ctx, 'ctx');
    if (!msg || typeof msg !== 'object' || typeof msg.type !== 'string') {
        (0, extension_logger_1.logExtensionWarn)('viewerMessage', 'Ignoring message with missing or invalid type');
        return;
    }
    if ((0, viewer_message_handler_collection_1.dispatchCollectionMessage)(msg, ctx)) {
        return;
    }
    if (msg.type === 'trackInteraction') {
        (0, learning_viewer_message_1.handleTrackInteractionRecord)(msg);
        return;
    }
    if ((0, viewer_message_handler_actions_1.dispatchViewerActionMessage)(msg, ctx)) {
        return;
    }
    (0, viewer_message_handler_panels_1.dispatchPanelMessage)(msg, ctx);
}
//# sourceMappingURL=viewer-message-handler.js.map