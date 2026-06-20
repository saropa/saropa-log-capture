# Integrations panel opens blank

Clicking the Integrations icon (the plug, `ib-integrations`) in the log viewer's icon bar opened the Options slide-out switched to the Integrations view and then immediately closed it within the same click, leaving the panel-slot open at its set width but with no visible panel. The Options panel's click-away dismiss recognized only the gear icon as an opener, so the click that opened the panel via the plug was misread as a click outside the panel.

## Finish Report (2026-06-20)

### Defect

The icon bar's `setActivePanel('integrations')` opens the Options panel and switches it to the Integrations view (`openOptionsPanel()` then `openIntegrationsView()`). The Options panel also registers a document-level click-away handler that closes the panel when a click lands outside it. That handler excluded the gear icon (`ib-options`) from "outside" but not the Integrations icon (`ib-integrations`).

Because the icon button's own click listener fires during the target phase before the click bubbles to `document`, the sequence on a single plug click was:

1. `setActivePanel('integrations')` runs — opens the Options panel (`optionsPanelOpen = true`, `.visible` added) and un-hides the Integrations view.
2. The same click event reaches the document click-away handler — `optionsPanelOpen` is now `true`, the click target (the plug) is outside the panel and is not the gear — so `closeOptionsPanel()` runs, removing `.visible` and re-hiding the Integrations view.

Net result: the panel opened and closed in one click. The panel-slot width was not reset (it is only reset via `clearActivePanel('options')`, which no-ops because the active panel is `'integrations'`), which is why the slot stayed at its open width while the panel itself was invisible.

### Evidence

Runtime DOM probe from the live webview (DevTools console, webview iframe context):

```
hasIconBar: true        correct frame
slotW: 420              panel-slot open at full width
panelVisible: false     #options-panel lacks .visible
viewHidden: true        #integrations-view still carries integrations-view-hidden
adapterRows: 22         the integrations content exists in the DOM
```

This combination — slot open, content present, panel marked not-visible, view re-hidden — is the signature of open-then-close within a single click. The gear icon worked because it was excluded; only the plug exhibited the bug.

### Fix

`src/ui/viewer-panels/viewer-options-events.ts` — the document click-away handler now treats BOTH the gear (`ib-options`) and the Integrations plug (`ib-integrations`) as panel openers, so the opening click is not mistaken for a click-away. A `onOpener` predicate consolidates the two icon checks; the panel closes only when the click is outside the panel and not on either opener.

### Tests

`src/test/ui/viewer-options-panel.test.ts` — added a regression test asserting the generated options-panel script's click-away closer references both `ib-options` and `ib-integrations` as excluded openers. The options-panel suite passes (27 tests). `npm run check-types` passes; ESLint clean on the touched files.

### Related

Sibling defect in the same click-away family fixed earlier in this release: a slide-out panel resize ending in a synthetic outside-click closed the panel (`slide-out-panel-resize-closes-panel.md`).
