/**
 * Client-side JavaScript for log line annotations in the viewer.
 * Annotations appear as muted text below annotated lines.
 * Concatenated into the same script scope as viewer-script.ts.
 */
export function getAnnotationScript(): string {
    return /* javascript */ `
var annotations = {};

function setAnnotation(idx, text) {
    if (idx < 0 || idx >= allLines.length) return;
    if (!text || text.trim() === '') {
        delete annotations[idx];
    } else {
        annotations[idx] = text.trim();
    }
    /* bug_027: an added/removed annotation changes this row's calcItemHeight() result
       (ANNOTATION_HEIGHT is added when annotations[idx] is set), so the prefix-sum
       heights recalcHeights() maintains are now stale. Rebuild them BEFORE
       renderViewport reads totalHeight/row offsets, or scroll position drifts from the
       actual DOM as more rows get annotated. */
    recalcHeights();
    renderViewport(true);
}

function getAnnotationHtml(idx) {
    if (!annotations[idx]) return '';
    // Escape & first so a literal "&lt;" in the annotation text doesn't render as a "<" — and so the
    // text is fully inert in innerHTML (annotations are user-typed).
    var escaped = annotations[idx].replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return '<div class="annotation">' + escaped + '</div>';
}

function handleLoadAnnotations(msg) {
    if (!msg.annotations) return;
    annotations = {};
    for (var i = 0; i < msg.annotations.length; i++) {
        var ann = msg.annotations[i];
        annotations[ann.lineIndex] = ann.text;
    }
    /* bug_027: reload-restored annotations grow their rows' heights the same way
       setAnnotation does, but this path replaces the whole annotations map at once —
       recalcHeights() must run before renderViewport so the prefix sums account for
       every restored annotation, not just the ones from this session. */
    recalcHeights();
    renderViewport(true);
}

/* trimData() splices excessCount rows off the head of allLines; the annotations map is
   keyed by the OLD index, so every surviving key must shift down by excessCount or the
   annotation renders under a different (unrelated) row after the trim (bug_025). Keys
   whose row was itself trimmed away (new index negative) are dropped — a note attached
   to a row that no longer exists has nowhere left to render. */
function adjustAnnotationsAfterTrim(excessCount) {
    if (excessCount <= 0) return;
    var shifted = {};
    var hasAny = false;
    for (var key in annotations) {
        if (!Object.prototype.hasOwnProperty.call(annotations, key)) continue;
        var newIdx = parseInt(key, 10) - excessCount;
        if (newIdx >= 0) { shifted[newIdx] = annotations[key]; hasAny = true; }
    }
    annotations = hasAny ? shifted : {};
}

function promptAnnotation(idx) {
    vscodeApi.postMessage({
        type: 'promptAnnotation',
        lineIndex: idx,
        current: annotations[idx] || '',
    });
}
`;
}
