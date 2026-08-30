"""Shared helpers for the Python spike scripts. See specs/000-engine-quality-check.md."""
import json
import time
from pathlib import Path

HERE = Path(__file__).parent


def list_files(dir_path: Path, extensions: tuple[str, ...]) -> list[Path]:
    if not dir_path.exists():
        return []
    return sorted(p for p in dir_path.iterdir() if p.is_file() and p.suffix.lower() in extensions)


def file_size(path: Path) -> int | None:
    try:
        return path.stat().st_size
    except OSError:
        return None


def timed(fn):
    """Runs fn(), returns (ms, error_str_or_None). Never raises."""
    start = time.perf_counter()
    try:
        fn()
        return round((time.perf_counter() - start) * 1000), None
    except Exception as exc:  # spike script: any failure is a reportable finding, not a crash
        return round((time.perf_counter() - start) * 1000), str(exc)


def report(name: str, rows: list[dict]) -> None:
    results_dir = HERE / "results"
    results_dir.mkdir(exist_ok=True)
    out_path = results_dir / f"{name}.json"
    out_path.write_text(json.dumps(rows, indent=2), encoding="utf-8")

    ok = [r for r in rows if r["ok"]]
    failed = [r for r in rows if not r["ok"]]
    print(f"\n=== {name} ===")
    print(f"{len(ok)}/{len(rows)} succeeded")
    for r in rows:
        status = f"{r['ms']}ms" if r["ok"] else f"FAILED: {r['error']}"
        print(f"  {r['file']:<40} {status}")
    if ok:
        avg = round(sum(r["ms"] for r in ok) / len(ok))
        print(f"avg {avg}ms over {len(ok)} successful files")
    if failed:
        print(f"{len(failed)} failed - see reasons above")
    print(f"Full report: {out_path}")
