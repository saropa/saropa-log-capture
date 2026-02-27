# Footer position, About changelog, selection count, Project Logs UX (implemented)

**Summary:** Feature work completed; no open bug.

- **Footer under log only:** Status bar (filename, version, level dots, line count) moved from full-width under main content to sit only under the log area (`#log-area-with-footer` wraps log + footer); sidebar panels no longer have the footer beneath them.
- **Version link:** Version appears on the far right of the footer and opens the About panel (same as the About icon).
- **About panel:** Shows current version, recent changelog excerpt from CHANGELOG.md (loaded when panel opens), and "Full changelog on Marketplace" link. Shared loader in `about-content-loader.ts` used by both sidebar and pop-out.
- **Selection count:** Footer shows "N lines, M chars selected" when text is selected in the viewport; updates throttled with requestAnimationFrame.
- **Project Logs UX (earlier in same batch):** Loading label shows folder path; header shows path not "Default"; min width 560px enforced; tag chips sorted by count, badge style, 2-line cap; session item icon has `user-select: none` so selection does not include bullet.

**Fix (version link):** Clicking the footer version link opened the About panel but the click bubbled to document; the About panel's outside-click handler then closed the panel. Added `stopPropagation()` on the version-link click so the panel stays open.
