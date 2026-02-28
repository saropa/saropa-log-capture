/**
 * Run separator block in the list view: tall pink bar with run start/end time, duration, issue counts.
 */

export function getRunSeparatorStyles(): string {
    return /* css */ `
.run-separator {
    min-height: 72px;
    background: linear-gradient(135deg, #c2185b 0%, #880e4f 100%);
    border-left: 4px solid #ad1457;
    margin: 0;
    padding: 8px 12px;
    display: flex;
    align-items: center;
    color: rgba(255,255,255,0.95);
    font-size: 12px;
    box-sizing: border-box;
}
.run-separator-inner {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
}
.run-sep-title {
    font-weight: bold;
    margin-right: 4px;
}
.run-sep-times {
    opacity: 0.95;
}
.run-sep-duration {
    opacity: 0.9;
    font-size: 11px;
}
.run-sep-counts {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-left: auto;
}
.run-sep-dot {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 18px;
    height: 18px;
    border-radius: 9px;
    font-size: 10px;
    font-weight: bold;
    padding: 0 4px;
}
.run-sep-dot-error { background: #f44336; color: #fff; }
.run-sep-dot-warning { background: #ff9800; color: #000; }
.run-sep-dot-perf { background: #9c27b0; color: #fff; }
.run-sep-dot-info { background: #4caf50; color: #fff; }
.run-sep-dot-none { background: rgba(255,255,255,0.25); color: rgba(255,255,255,0.8); }
`;
}
