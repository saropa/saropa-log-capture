# Extension not visible in Cursor marketplace / cannot install VSIX

**Status:** Resolved  
**Date:** 2026-02-27

## Summary

Extension was published only to the VS Code Marketplace. Cursor uses the **Open VSX Registry** (open-vsx.org), not the VS Code Marketplace, so the extension did not appear in Cursor’s Extensions view and some users could not install the packaged .vsix.

## Resolution

- Publish pipeline now publishes to **Open VSX** (Step 14) after the VS Code Marketplace (Step 13).
- Requires `OVSX_PAT`; script checks and guides: token URL, shell env, and first-time `npx ovsx create-namespace saropa -p <token>`.
- Users can install from Cursor’s marketplace (once listed on Open VSX) or via **Extensions: Install from VSIX…** with a downloaded .vsix.
