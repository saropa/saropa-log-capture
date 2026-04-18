/**
 * Dispatches incoming webview postMessage to extension handlers. Each message type
 * (copyToClipboard, editLine, navigateSession, etc.) is routed via ViewerMessageContext
 * callbacks set by LogViewerProvider. Called from the provider's onDidReceiveMessage.
 */

import { logExtensionWarn } from '../../modules/misc/extension-logger';
import { assertDefined } from '../../modules/misc/assert';
import { dispatchPanelMessage } from './viewer-message-handler-panels';
import { dispatchCollectionMessage } from './viewer-message-handler-collection';
import { dispatchViewerActionMessage } from './viewer-message-handler-actions';
import type { ViewerMessageContext } from './viewer-message-types';
import { handleTrackInteractionRecord } from '../../modules/learning/learning-viewer-message';

export type { ViewerMessageContext };

/**
 * Route a webview message to the appropriate handler.
 * @param msg - Incoming message with at least `type`; payload fields vary by type.
 * @param ctx - Callbacks and state (current file, post, load, etc.) for handling the message.
 */
export function dispatchViewerMessage(msg: Record<string, unknown>, ctx: ViewerMessageContext): void {
  assertDefined(ctx, 'ctx');
  if (!msg || typeof msg !== 'object' || typeof msg.type !== 'string') {
    logExtensionWarn('viewerMessage', 'Ignoring message with missing or invalid type');
    return;
  }
  if (dispatchCollectionMessage(msg, ctx)) { return; }
  if (msg.type === 'trackInteraction') {
    handleTrackInteractionRecord(msg);
    return;
  }
  if (dispatchViewerActionMessage(msg, ctx)) { return; }
  dispatchPanelMessage(msg, ctx);
}
