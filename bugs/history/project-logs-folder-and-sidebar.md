# Project Logs folder + sidebar animation (implemented)

**Summary:** Feature work completed; no open bug.

- **Root folder:** Project Logs panel supports an optional root folder (workspace state `sessionPanelRootFolder`). Header shows "Project Logs" only when default; when a non-default folder is selected it shows "Project Logs · path" (never shows the word "Default"). The whole header (title through optional suffix) is clickable to browse; reset icon when not default. Last-used folder is remembered for picker `defaultUri` so the dialog never opens at system default.
- **Loading UX:** Progress bar and shimmer while the session list loads.
- **Sidebar open animation:** Panel slot keeps `overflow: hidden` until the width transition ends, then adds `open`; prevents content overlapping the log when opening. Transitionend listener is cleared when switching/close to avoid accumulation.
- **Path separator selection:** The " · " in the header is in a separate span with `user-select: none` so it is not highlighted when the user selects the path.
