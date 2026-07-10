/**
 * Crashlytics stack-frame context menu — webview fragment.
 *
 * Extracted from viewer-crashlytics-interactions-script.ts when plan 110 Stage 2 gave the
 * Crashlytics detail a SECOND render container (the Trouble Mode side rail), pushing that
 * file over the 300-line limit. The menu is self-contained: one lazily created popover
 * reused by every container, wired per-container by cdWireFrameMenu(el).
 *
 * Inlined into the Crashlytics panel's IIFE, so it shares that scope (vscodeApi, vt,
 * cpDetailTitle, cpDetailMarkdown) exactly as it did before the extraction.
 */

/** JS fragment: right-click popover over a stack frame (copy / copy path / open / file issue). */
export function getCrashlyticsFrameMenuScript(): string {
    return /* js */ `
    var cdMenu = null, cdMenuFrame = null;
    function cdEnsureMenu() {
        if (cdMenu && cdMenu.isConnected) return cdMenu;
        cdMenu = document.createElement('div');
        cdMenu.className = 'cd-ctxmenu u-hidden';
        cdMenu.innerHTML =
            '<div class="cd-ctxitem" data-act="copy">' + vt('viewer.crashlytics.frameMenu.copy') + '</div>'
            + '<div class="cd-ctxitem" data-act="copypath">' + vt('viewer.crashlytics.frameMenu.copyPath') + '</div>'
            + '<div class="cd-ctxitem" data-act="open">' + vt('viewer.crashlytics.frameMenu.open') + '</div>'
            + '<div class="cd-ctxitem" data-act="issue">' + vt('viewer.crashlytics.frameMenu.issue') + '</div>';
        document.body.appendChild(cdMenu);
        // stopPropagation so selecting an item does not bubble to the panel's outside-click handler.
        cdMenu.addEventListener('click', function(ev) {
            ev.stopPropagation();
            var it = ev.target.closest('.cd-ctxitem');
            if (it && cdMenuFrame) cdRunFrameAction(it.getAttribute('data-act'), cdMenuFrame);
            cdHideMenu();
        });
        return cdMenu;
    }
    function cdHideMenu() { if (cdMenu) cdMenu.classList.add('u-hidden'); cdMenuFrame = null; }
    function cdFrameText(frame) {
        var btn = frame.querySelector('.cd-frame-copy');
        return btn ? btn.getAttribute('data-copy') : (frame.textContent || '').trim();
    }
    function cdRunFrameAction(act, frame) {
        var file = frame.getAttribute('data-frame-file'), line = frame.getAttribute('data-frame-line'), text = cdFrameText(frame);
        if (act === 'copy') vscodeApi.postMessage({ type: 'copyToClipboard', text: text });
        else if (act === 'copypath' && file) vscodeApi.postMessage({ type: 'copyToClipboard', text: file });
        else if (act === 'open' && file) vscodeApi.postMessage({ type: 'crashlyticsOpenFrame', file: file, line: line });
        else if (act === 'issue') vscodeApi.postMessage({ type: 'crashlyticsCreateIssue', title: cpDetailTitle, body: 'Crash frame: ' + text + '\\n\\n' + cpDetailMarkdown });
    }

    /* Attach the right-click handler to one detail container. Called once per container
       (full-area panel detail + Trouble Mode rail slot) so the menu works in both. */
    function cdWireFrameMenu(el) {
        if (!el) return;
        el.addEventListener('contextmenu', function(e) {
            var frame = e.target.closest('.stack-frame');
            if (!frame) return;
            e.preventDefault();
            var menu = cdEnsureMenu();
            cdMenuFrame = frame;
            var hasFile = !!frame.getAttribute('data-frame-file');
            menu.querySelector('[data-act="copypath"]').style.display = hasFile ? '' : 'none';
            menu.querySelector('[data-act="open"]').style.display = hasFile ? '' : 'none';
            menu.style.left = e.clientX + 'px';
            menu.style.top = e.clientY + 'px';
            menu.classList.remove('u-hidden');
        });
    }
    document.addEventListener('mousedown', function(e) { if (cdMenu && !cdMenu.contains(e.target)) cdHideMenu(); });
`;
}
