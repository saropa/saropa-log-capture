# -*- coding: utf-8 -*-
"""Report generation, timing display, and success banner.

Reports are saved to reports/ (which is gitignored) so the user
has a persistent record of each pipeline run. The timing chart
gives a visual breakdown of where time was spent.
"""

import datetime
import os
import webbrowser

from modules.constants import C, MARKETPLACE_URL, PROJECT_ROOT, REPO_URL
from modules.display import heading, ok
from modules.utils import elapsed_str


def _build_report_header(
    results: list[tuple[str, bool, float]],
    version: str,
    is_publish: bool,
) -> list[str]:
    """Build the header lines for a report."""
    total_time = sum(t for _, _, t in results)
    passed = sum(1 for _, p, _ in results if p)
    failed = len(results) - passed
    kind = "Publish" if is_publish else "Analysis"

    lines = [
        f"Saropa Log Capture — {kind} Report",
        f"Generated: {datetime.datetime.now().isoformat()}",
        f"Extension version: {version}",
        "",
        f"Results: {passed} passed, {failed} failed" if failed else
        f"Results: {passed} passed",
        f"Total time: {elapsed_str(total_time)}",
    ]
    return lines


def save_report(
    results: list[tuple[str, bool, float]],
    version: str,
    vsix_path: str | None = None,
    is_publish: bool = False,
) -> str | None:
    """Save a summary report to reports/. Returns the report path."""
    reports_dir = os.path.join(PROJECT_ROOT, "reports")
    os.makedirs(reports_dir, exist_ok=True)

    ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    kind = "publish" if is_publish else "analyze"
    report_name = f"{ts}_saropa_log_capture_{kind}_report.log"
    report_path = os.path.join(reports_dir, report_name)

    lines = _build_report_header(results, version, is_publish)

    if vsix_path and os.path.isfile(vsix_path):
        vsix_size = os.path.getsize(vsix_path) / 1024
        lines.append(f"VSIX file: {os.path.basename(vsix_path)}")
        lines.append(f"VSIX size: {vsix_size:.1f} KB")

    if is_publish:
        lines.append(f"Marketplace: {MARKETPLACE_URL}")
        lines.append(f"GitHub release: {REPO_URL}/releases/tag/v{version}")

    lines.append("")
    lines.append("Step Details:")
    for name, ok_flag, secs in results:
        status = "PASS" if ok_flag else "FAIL"
        lines.append(f"  [{status}] {name:<25s} {elapsed_str(secs):>8s}")

    with open(report_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")

    return report_path


def print_timing(results: list[tuple[str, bool, float]]) -> None:
    """Print a coloured timing bar chart for all recorded steps.

    Each step gets a proportional bar (max 30 chars wide) showing
    its share of total time. Failed steps show a red X instead of check.
    """
    total = sum(t for _, _, t in results)
    heading("Timing")
    for name, passed, secs in results:
        icon = f"{C.GREEN}✓{C.RESET}" if passed else f"{C.RED}✗{C.RESET}"
        # Scale bar length proportionally to total time (max 30 chars)
        bar_len = int(min(secs / max(total, 0.001) * 30, 30))
        bar = f"{C.GREEN}{'█' * bar_len}{C.RESET}" if bar_len else ""
        print(f"  {icon} {name:<25s} {elapsed_str(secs):>8s}  {bar}")
    print(f"  {'─' * 45}")
    print(f"    {'Total':<23s} {C.BOLD}{elapsed_str(total)}{C.RESET}")


def print_success_banner(version: str, vsix_path: str) -> None:
    """Print the final success summary with links."""
    heading("Published Successfully!")
    print(f"""
  {C.GREEN}{C.BOLD}v{version} is live!{C.RESET}

  {C.CYAN}Marketplace:{C.RESET}
    {C.WHITE}{MARKETPLACE_URL}{C.RESET}

  {C.CYAN}GitHub Release:{C.RESET}
    {C.WHITE}{REPO_URL}/releases/tag/v{version}{C.RESET}

  {C.CYAN}VSIX:{C.RESET}
    {C.WHITE}{os.path.basename(vsix_path)}{C.RESET}
""")
    try:
        webbrowser.open(MARKETPLACE_URL)
    except Exception:
        pass
