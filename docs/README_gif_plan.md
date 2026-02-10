# GIF Plan for README

Where to store, what to record, and how to keep file sizes down.

---

## File location

Put all GIFs in `images/` (same directory as `banner.png` and `icon.png`).
Reference them in the README with relative paths:

```md
![Description](images/capture-demo.gif)
```

The `images/` directory is already included in the `.vsix` package.
If total GIF size exceeds ~5 MB, switch to raw GitHub URLs to keep the package small:

```md
![Description](https://raw.githubusercontent.com/saropa/saropa-log-capture/main/images/capture-demo.gif)
```

---

## Recording tips

- **Tool:** [ScreenToGif](https://www.screentogif.com/) — free, has a built-in editor for trimming/cropping.
- **Window size:** Record at a small, consistent size (e.g. 900x500). Smaller = smaller file.
- **Theme:** Use VS Code default dark theme for marketplace consistency.
- **Zoom:** `Ctrl+=` once or twice so text is readable at thumbnail size.
- **Duration:** 6–12 seconds per GIF. Cut dead time.
- **Frame rate:** 10–15 FPS in ScreenToGif editor (Edit → Reduce Frame Count).
- **Crop:** Trim to just the relevant panel — don't show the full VS Code window unless necessary.
- **Pause at start/end:** Hold for ~1 second so viewers can orient before action starts.
- **Cursor:** Keep mouse movements deliberate. ScreenToGif can add click highlights.
- **Clean workspace:** Close unrelated tabs/panels before recording.

---

## GIFs to record

### 1. Hero demo (top of README) — `capture-demo.gif`

**Shows:** The core value prop in one clip.
**Steps:** Hit F5 → debug output streams into the panel viewer → brief pause showing lines accumulating with minimap and footer visible.
**Target:** ~10 seconds.
**README placement:** Immediately after the tagline, before "Who is this for?"

### 2. Icon bar tour — `icon-bar.gif`

**Shows:** The activity-bar-style icon bar and slide-out panels.
**Steps:** Click Project Logs icon → panel slides out showing session list → click Search icon → search panel replaces it → click Options icon → options panel opens → click icon again to close.
**Target:** ~8 seconds.
**README placement:** Features section, under "Viewer".

### 3. Search and level filter — `search-filter.gif`

**Shows:** Search and severity filtering.
**Steps:** Open search panel (Ctrl+F) → type a query → matches highlight → toggle regex → close search → click footer level dots → fly-up menu opens → toggle off info level → lines filter out.
**Target:** ~10 seconds.
**README placement:** Features section, under "Search & Filter".

### 4. Stack trace cycling — `stack-traces.gif`

**Shows:** Collapsible stack trace states.
**Steps:** Scroll to a stack trace → click the header → cycles from preview (3 frames) → expanded (all frames) → collapsed → preview again.
**Target:** ~6 seconds.
**README placement:** Features section, under "Viewer".

### 5. Click-to-source — `click-to-source.gif`

**Shows:** Navigating from log output to source code.
**Steps:** Click a `file.dart:42` link in the log → editor opens that file at the line → right-click another link → context menu shows Open File / Copy Path options.
**Target:** ~8 seconds.
**README placement:** Features section, under "Viewer".

### 6. Minimap — `minimap.gif`

**Shows:** The scrollbar minimap with markers.
**Steps:** Load a file with errors/warnings → red and orange markers visible in minimap → click a marker area → viewport jumps there → drag the viewport indicator to scroll.
**Target:** ~6 seconds.
**README placement:** Features section, under "Display & Layout".

### 7. Pop-out viewer — `pop-out.gif`

**Shows:** Floating viewer window.
**Steps:** Click the pop-out icon in the icon bar → viewer opens as a floating panel → arrange side-by-side with the main window → both show the same live data.
**Target:** ~6 seconds.
**README placement:** Features section, under "Viewer".

---

## Priority

| Priority | GIF | Why |
|----------|-----|-----|
| Must have | Hero demo | First thing marketplace visitors see |
| Must have | Search and level filter | Core daily-use feature |
| Must have | Icon bar tour | Explains the UI layout |
| Should have | Stack trace cycling | Unique feature, visually clear |
| Should have | Click-to-source | Key productivity feature |
| Nice to have | Minimap | Visually impressive but secondary |
| Nice to have | Pop-out viewer | Niche use case |

---

## Naming convention

Use lowercase kebab-case: `capture-demo.gif`, `icon-bar.gif`, `search-filter.gif`.

## Size budget

| Target | Limit |
|--------|-------|
| Per GIF | < 2 MB |
| Total (all GIFs) | < 10 MB |
| If over budget | Host on GitHub, reference via raw URL |
