"""specs/000-engine-quality-check.md - candidate C: Aspose.Words for Python (trial, no license file applied).

Trial output carries an evaluation watermark and a page-count cap - fine for judging layout
fidelity, not the final visual look. See specs/000-engine-quality-check.md risks.

Usage: python pdf-docx-c-aspose.py
"""
import sys
from pathlib import Path

from lib import HERE, file_size, list_files, report, timed

SAMPLES_DIR = HERE / "samples" / "pdf-docx"
OUT_DIR = HERE / "results" / "pdf-docx-c-out"

files = list_files(SAMPLES_DIR, (".pdf",))
if not files:
    print(f"No files in {SAMPLES_DIR} - drop 20-30 real PDF files there first.")
    sys.exit(1)

OUT_DIR.mkdir(parents=True, exist_ok=True)

import aspose.words as aw  # noqa: E402 - imported after the early-exit check

rows = []
for file in files:
    out_path = OUT_DIR / (file.stem + ".docx")
    in_size = file_size(file)

    def convert(f=file, o=out_path):
        doc = aw.Document(str(f))
        doc.save(str(o))

    ms, error = timed(convert)

    rows.append({
        "file": file.name,
        "inSizeBytes": in_size,
        "outSizeBytes": None if error else file_size(out_path),
        "ms": ms,
        "ok": error is None,
        "error": error,
    })

report("pdf-docx-c-aspose", rows)
print(f"Converted files: {OUT_DIR} - open in Word/LibreOffice, ignore the eval watermark, judge layout only.")
