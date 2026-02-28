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
    renderViewport(true);
}

function getAnnotationHtml(idx) {
    if (!annotations[idx]) return '';
    var escaped = annotations[idx].replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return '<div class="annotation">' + escaped + '</div>';
}

function handleLoadAnnotations(msg) {
    if (!msg.annotations) return;
    annotations = {};
    for (var i = 0; i < msg.annotations.length; i++) {
        var ann = msg.annotations[i];
        annotations[ann.lineIndex] = ann.text;
    }
    renderViewport(true);
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
