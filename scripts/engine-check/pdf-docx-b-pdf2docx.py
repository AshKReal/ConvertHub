"""specs/000-engine-quality-check.md - candidate B: pdf2docx (MIT wrapper over PyMuPDF, AGPL/commercial-dual).

Run locally only for this one-off evaluation - see the license note in specs/000-engine-quality-check.md
before using this in anything that ships.

Usage: python pdf-docx-b-pdf2docx.py
"""
import sys
from pathlib import Path

from lib import HERE, file_size, list_files, report, timed

SAMPLES_DIR = HERE / "samples" / "pdf-docx"
OUT_DIR = HERE / "results" / "pdf-docx-b-out"

files = list_files(SAMPLES_DIR, (".pdf",))
if not files:
    print(f"No files in {SAMPLES_DIR} - drop 20-30 real PDF files there first.")
    sys.exit(1)

OUT_DIR.mkdir(parents=True, exist_ok=True)

from pdf2docx import Converter  # noqa: E402 - imported after the early-exit check

rows = []
for file in files:
    out_path = OUT_DIR / (file.stem + ".docx")
    in_size = file_size(file)

    def convert(f=file, o=out_path):
        cv = Converter(str(f))
        try:
            cv.convert(str(o))
        finally:
            cv.close()

    ms, error = timed(convert)

    rows.append({
        "file": file.name,
        "inSizeBytes": in_size,
        "outSizeBytes": None if error else file_size(out_path),
        "ms": ms,
        "ok": error is None,
        "error": error,
    })

report("pdf-docx-b-pdf2docx", rows)
print(f"Converted files: {OUT_DIR} - open in Word/LibreOffice, check tables/columns/reading order.")
