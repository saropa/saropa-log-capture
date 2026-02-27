/** Message handlers, click handlers, and dismiss logic for the level filter UI. */
export function getLevelEventHandlers(): string {
    return /* javascript */ `
// Message handlers
window.addEventListener('message', function(event) {
    var msg = event.data;
    if (msg.type === 'setContextLines') {
        contextLinesBefore = typeof msg.count === 'number' ? msg.count : 3;
        syncContextSlider();
        if (enabledLevels.size < 7) applyLevelFilter();
    } else if (msg.type === 'restoreLevelFilters' && msg.levels) {
        restoreLevelState(msg.levels);
    }
});

var dotGroups = document.querySelectorAll('.level-dot-group');
for (var di = 0; di < dotGroups.length; di++) {
    (function(group) {
        group.addEventListener('click', function(e) {
            e.stopPropagation();
            var lvl = group.getAttribute('data-level');
            if (lvl) toggleLevel(lvl);
        });
        group.addEventListener('dblclick', function(e) {
            e.stopPropagation();
            var lvl = group.getAttribute('data-level');
            if (lvl) soloLevel(lvl);
        });
    })(dotGroups[di]);
}

var triggerLabel = document.getElementById('level-trigger-label');
if (triggerLabel) {
    triggerLabel.addEventListener('click', function(e) {
        e.stopPropagation();
        toggleLevelMenu();
    });
}

// Select all / none links
var selAll = document.getElementById('level-select-all');
var selNone = document.getElementById('level-select-none');
if (selAll) selAll.addEventListener('click', function(e) { e.preventDefault(); selectAllLevels(); });
if (selNone) selNone.addEventListener('click', function(e) { e.preventDefault(); selectNoneLevels(); });

// Context lines slider in fly-up
var ctxSlider = document.getElementById('context-lines-slider');
if (ctxSlider) {
    ctxSlider.addEventListener('input', function(e) {
        contextLinesBefore = parseInt(e.target.value, 10);
        syncContextSlider();
        if (enabledLevels.size < 7) applyLevelFilter();
    });
}

// Level circle click handlers (inside fly-up)
var levelIds = allLevelNames;
for (var li = 0; li < levelIds.length; li++) {
    (function(lvl) {
        var btn = document.getElementById('level-' + lvl + '-toggle');
        if (btn) btn.addEventListener('click', function() { toggleLevel(lvl); });
    })(levelIds[li]);
}

document.addEventListener('click', function(e) {
    if (!levelMenuOpen) return;
    var flyup = document.getElementById('level-flyup');
    var trigger = document.getElementById('level-menu-btn');
    if (flyup && !flyup.contains(e.target) && trigger && !trigger.contains(e.target)) {
        closeLevelMenu();
    }
});
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && levelMenuOpen) closeLevelMenu();
});
`;
}
