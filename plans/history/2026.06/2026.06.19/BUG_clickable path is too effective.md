Status: Fixed

LOG viewer screen

1. log file detection and click to navigate to source works great
2. the clickable text is white which does NOT indicate it is clickable
3. when selecting text, yuo should not hijack the UI and init navigation to the selected text
4.  a single click on the log viewer should clear the selection - it is annoying to have to press "ESC"

D:\src\saropa-log-capture\bugs\BUG_clickable path is too effective.png

d:\src\contacts\reports\20260616\20260616_091310_contacts.log



---

[
  {
    "line": 727,
    "timestamp": "2026-06-16T13:18:24.392Z",
    "level": "info",
    "category": "console",
    "tag": "log",
    "source": "debug",
    "text": "[log] Missing [result] for [contactSaropaUUID]: `sar-f0f820ef-47f0-4fa3-a840-b17113550ff4`, [nativePhoneId]: `857` "
  },
  {
    "line": 2,
    "timestamp": "2026-06-16T13:18:24.394Z",
    "level": "info",
    "category": "console",
    "tag": "log",
    "source": "debug",
    "text": "NativeContactExtensions.nativeImportSingle.<fn>.<fn> ./lib/service/native_phone/native_contact_utils.dart 216:13"
  },
  {
    "line": 3,
    "timestamp": "2026-06-16T13:18:24.395Z",
    "level": "info",
    "category": "console",
    "tag": "log",
    "source": "debug",
    "text": "_ContactViewScreenState._importFromNative ./lib/views/contact/contact_view_screen.dart 483:7"
  },
  {
    "line": 4,
    "timestamp": "2026-06-16T13:18:24.395Z",
    "level": "info",
    "category": "console",
    "tag": "log",
    "source": "debug",
    "text": "Future.wait.<fn> dart:async"
  },
  {
    "line": 5,
    "timestamp": "2026-06-16T13:18:24.395Z",
    "level": "info",
    "category": "console",
    "tag": "log",
    "source": "debug",
    "text": "_ContactViewScreenState._onRefresh ./lib/views/contact/contact_view_screen.dart 469:5"
  },
  {
    "line": 6,
    "timestamp": "2026-06-16T13:18:24.396Z",
    "level": "info",
    "category": "console",
    "tag": "log",
    "source": "debug",
    "text": "CommonRefreshIndicator.build.<fn> ./lib/components/primitive/refresh/common_refresh_indicator.dart 77:11"
  },
  {
    "line": 7,
    "timestamp": "2026-06-16T13:18:24.396Z",
    "level": "info",
    "category": "console",
    "tag": "log",
    "source": "debug",
    "text": "_PullToRefreshIndicatorState._startRefresh ./lib/components/primitive/refresh/src/pull_to_refresh_widget.dart 275:7"
  },
  {
    "line": 734,
    "timestamp": "2026-06-16T13:18:24.396Z",
    "level": "notice",
    "category": "console",
    "tag": "log",
    "source": "debug",
    "text": "[log] System Notice: Sorry, it is not possible to do this now for ‘Shahid Bangash’ [sar-f0f820ef-47f0-4fa3-a840-b17113550ff4] "
  },
  {
    "line": 9,
    "timestamp": "2026-06-16T13:18:24.397Z",
    "level": "notice",
    "category": "console",
    "tag": "log",
    "source": "debug",
    "text": "ActivityModelExtensions.dbActivityAdd ./lib/database/drift_middleware/user_data/activity_drift_extensions_io.dart 266:9"
  },
  {
    "line": 10,
    "timestamp": "2026-06-16T13:18:24.397Z",
    "level": "notice",
    "category": "console",
    "tag": "log",
    "source": "debug",
    "text": "PopupToastUtils._showCommonNoticeImmediate ./lib/utils/system/toasts/popup_toast_message.dart 327:9"
  },
  {
    "line": 11,
    "timestamp": "2026-06-16T13:18:24.397Z",
    "level": "notice",
    "category": "console",
    "tag": "log",
    "source": "debug",
    "text": "PopupToastUtils.showCommonNotice ./lib/utils/system/toasts/popup_toast_message.dart 274:7"
  },
  {
    "line": 12,
    "timestamp": "2026-06-16T13:18:24.397Z",
    "level": "notice",
    "category": "console",
    "tag": "log",
    "source": "debug",
    "text": "PopupToastUtils.showCommonNoticeApology ./lib/utils/system/toasts/popup_toast_message.dart 228:23"
  },
  {
    "line": 13,
    "timestamp": "2026-06-16T13:18:24.398Z",
    "level": "notice",
    "category": "console",
    "tag": "log",
    "source": "debug",
    "text": "NativeContactExtensions._displayPopUpSingleImportResult ./lib/service/native_phone/native_contact_utils.dart 249:25"
  },
  {
    "line": 14,
    "timestamp": "2026-06-16T13:18:24.398Z",
    "level": "notice",
    "category": "console",
    "tag": "log",
    "source": "debug",
    "text": "NativeContactExtensions.nativeImportSingle.<fn>.<fn> ./lib/service/native_phone/native_contact_utils.dart 224:19"
  },
  {
    "line": 15,
    "timestamp": "2026-06-16T13:18:24.398Z",
    "level": "notice",
    "category": "console",
    "tag": "log",
    "source": "debug",
    "text": "_ContactViewScreenState._importFromNative ./lib/views/contact/contact_view_screen.dart 483:7"
  },
  {
    "line": 16,
    "timestamp": "2026-06-16T13:18:24.398Z",
    "level": "notice",
    "category": "console",
    "tag": "log",
    "source": "debug",
    "text": "Future.wait.<fn> dart:async"
  },
  {
    "line": 17,
    "timestamp": "2026-06-16T13:18:24.398Z",
    "level": "notice",
    "category": "console",
    "tag": "log",
    "source": "debug",
    "text": "_ContactViewScreenState._onRefresh ./lib/views/contact/contact_view_screen.dart 469:5"
  },
  {
    "line": 18,
    "timestamp": "2026-06-16T13:18:24.398Z",
    "level": "notice",
    "category": "console",
    "tag": "log",
    "source": "debug",
    "text": "CommonRefreshIndicator.build.<fn> ./lib/components/primitive/refresh/common_refresh_indicator.dart 77:11"
  },
  {
    "line": 19,
    "timestamp": "2026-06-16T13:18:24.398Z",
    "level": "notice",
    "category": "console",
    "tag": "log",
    "source": "debug",
    "text": "_PullToRefreshIndicatorState._startRefresh ./lib/components/primitive/refresh/src/pull_to_refresh_widget.dart 275:7"
  },
  {
    "line": 746,
    "timestamp": "2026-06-16T13:18:24.915Z",
    "level": "performance",
    "category": "logcat",
    "tag": "Choreographer",
    "source": "debug",
    "text": "06-16 09:18:25.403  1925  1981 W Choreographer: Frame time is 0.204373  now = 135303768900679  timestampNanos = 135303769105052 ms in the future!  Check that graphics HAL is generating vsync timestamps using the correct timebase."
  }
]

---

## Finish Report (2026-06-19)

### Defect

In the log viewer webview, app-frame stack lines route a whole-row click to the
frame's embedded `.source-link` (open file). The member name — the obvious click
target — renders member-first as bright plain text, while the only clickability
cue (the file path) floats hard right at reduced opacity and clips off-screen in a
narrow sidebar. The row therefore read as non-clickable. Two further interaction
defects compounded this: a text drag-select whose mouse release landed on a
`.source-link` was hijacked into open-file instead of preserving the selection,
and a multi-row / shift-click model selection only cleared with the Escape key —
a plain click did not dismiss it.

### Changes

- **Clickability cue (point 2).** `formatFrameMemberFirst`
  (`src/ui/viewer/viewer-data-helpers-core.ts`) now wraps the app-frame member in
  `<span class="frame-member">`. The wrapper is added ONLY on linked app frames —
  the link-less dart-SDK branch stays unwrapped so those un-clickable frames get no
  cue (no dead-click affordance). The wrapper is display-only; copy/search/dedup all
  read `rawText`, and `stripTags()` drops the span. CSS in
  `src/ui/viewer-styles/viewer-styles-lines.ts` adds `cursor: pointer` scoped via
  `.stack-line:has(.source-link)`, a persistent subtle dotted underline on
  `.frame-member`, and a solid themed-link underline + color on row hover — matching
  the existing `.source-link` hover treatment.

- **Selection no longer hijacked into navigation (point 3).** The `.source-link`
  click branch in `src/ui/viewer/viewer-script-click-handlers.ts` now reads the
  window selection and returns early when it is non-collapsed, before posting
  `linkClicked`. A plain click leaves a collapsed selection, so open-on-click is
  unchanged; only a real text selection is preserved. This mirrors the
  collapsed-selection guard already present on the frame / stack-owner / banner
  whole-row branches.

- **Plain click dismisses a selection (point 4).**
  `src/ui/viewer/viewer-copy-drag-select.ts` adds an `onDragSelectDismissClick`
  listener on the viewport that calls `clearSelection()` for a plain click. It is
  gated three ways so it never wipes a selection still being built: modifier clicks
  (shift/ctrl extend or path-filter) are skipped, a live native within-line text
  selection (non-collapsed) is preserved, and the trailing click that ends a real
  multi-row drag is skipped via a `dragSelectJustEnded` flag set on mouseup and
  reset on the next mousedown (so a dropped drag-end click cannot strand the flag).

Point 1 (detection + navigation) already worked and was not changed.

### Tests

`src/test/ui/viewer-dart-frame-format.test.ts` — three app-frame assertions
updated to pin the `.frame-member` wrapper; the dart-SDK / unlinkified / prose
cases stay unwrapped. `src/test/ui/viewer-stack-frame-click.test.ts` — added a
case asserting the `.source-link` branch reads the selection and bails when
non-collapsed. `src/test/ui/viewer-copy-drag-select.test.ts` — added cases pinning
the dismiss-on-click listener and its three gates. All 26 cases across the three
files pass (`npx mocha … --ui tdd`). `npm run check-types` clean; `npm run compile`
passes every verify gate.