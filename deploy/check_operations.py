"""Check readiness, worker health, failed jobs, disk space, and backup age.

Prints status lines only. It does not print environment files, tokens, or
backup contents. A non-zero exit is the alert signal for a scheduler.
"""

from __future__ import annotations

import argparse
import shutil
import subprocess
import time
from pathlib import Path


def _run(command: list[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(command, capture_output=True, text=True, check=False)


def _health(container: str) -> str:
    completed = _run(
        [
            "docker",
            "inspect",
            "--format",
            "{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}",
            container,
        ]
    )
    if completed.returncode != 0:
        return "missing"
    return completed.stdout.strip() or "missing"


def _failed_jobs(container: str) -> tuple[str, int]:
    completed = _run(
        [
            "docker",
            "exec",
            container,
            "redis-cli",
            "HGETALL",
            "nexa:monitor:failed-jobs",
        ]
    )
    if completed.returncode != 0:
        return "unavailable", 0
    lines = [line.strip() for line in completed.stdout.splitlines() if line.strip()]
    total = 0
    for index in range(1, len(lines), 2):
        try:
            total += int(lines[index])
        except ValueError:
            return "unavailable", 0
    state = "present" if lines else "absent"
    return state, total


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--api-container", required=True)
    parser.add_argument("--web-container", required=True)
    parser.add_argument("--worker-container", required=True)
    parser.add_argument("--redis-container", required=True)
    parser.add_argument("--backup-dir", default="backups")
    parser.add_argument("--project", required=True)
    parser.add_argument("--max-backup-age-hours", type=float, default=26)
    parser.add_argument("--min-free-percent", type=float, default=10)
    args = parser.parse_args()

    failures: list[str] = []
    checks = {
        "api-ready": _health(args.api_container),
        "web": _health(args.web_container),
        "worker": _health(args.worker_container),
    }
    for name, status in checks.items():
        print(f"{name}={status}")
        if status != "healthy":
            failures.append(name)

    job_state, job_count = _failed_jobs(args.redis_container)
    print(f"failed-jobs={job_count}")
    print(f"failed-jobs-key={job_state}")
    if job_state == "unavailable":
        failures.append("failed-jobs")

    usage = shutil.disk_usage(Path(args.backup_dir if Path(args.backup_dir).exists() else "."))
    free_percent = (usage.free / usage.total) * 100 if usage.total else 0
    print(f"disk-free-percent={free_percent:.1f}")
    if free_percent < args.min_free_percent:
        failures.append("disk")

    backups = sorted(Path(args.backup_dir).glob(args.project + "-*"))
    dumps = [path / "database.dump" for path in backups if (path / "database.dump").is_file()]
    if not dumps:
        print("backup-age=missing")
        failures.append("backup-age")
    else:
        newest = max(dumps, key=lambda path: path.stat().st_mtime)
        age_hours = (time.time() - newest.stat().st_mtime) / 3600
        print(f"backup-age-hours={age_hours:.2f}")
        if age_hours > args.max_backup_age_hours:
            failures.append("backup-age")

    status_log = Path(args.backup_dir) / "backup-status.log"
    if status_log.is_file():
        last = status_log.read_text(encoding="utf-8").splitlines()
        last_line = last[-1] if last else ""
        outcome = "ok" if " OK " in f" {last_line} " or " OK " in last_line else "fail"
        if last_line.endswith(" FAIL backup-failed") or " FAIL " in last_line:
            outcome = "fail"
        print(f"backup-status={outcome}")
        if outcome == "fail":
            failures.append("backup-status")
    else:
        print("backup-status=missing")

    if failures:
        print("operations-check-fail " + ",".join(failures))
        return 1
    print("operations-check-ok")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
