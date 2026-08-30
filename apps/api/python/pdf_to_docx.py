"""Real PDF -> DOCX conversion for apps/api (spec 005).

Thin wrapper, not the evaluation harness in scripts/engine-check/ - this is
the actual runtime engine, spawned as a child process per request by
apps/api/src/modules/conversion/engines/pdf-to-docx.engine.ts.

Usage: python pdf_to_docx.py <input.pdf> <output.docx>

Exit 0 on success. Exit 1 with a message on stderr on any failure - the
caller only inspects the exit code, not stdout/stderr content.
"""
import sys

from pdf2docx import Converter


def main() -> int:
    if len(sys.argv) != 3:
        print("usage: pdf_to_docx.py <input.pdf> <output.docx>", file=sys.stderr)
        return 1

    input_path, output_path = sys.argv[1], sys.argv[2]

    try:
        cv = Converter(input_path)
    except Exception as error:  # noqa: BLE001 - reported to the caller, not swallowed
        print(f"pdf2docx: failed to open input: {error}", file=sys.stderr)
        return 1

    try:
        cv.convert(output_path)
    except Exception as error:  # noqa: BLE001 - reported to the caller, not swallowed
        print(f"pdf2docx: conversion failed: {error}", file=sys.stderr)
        return 1
    finally:
        cv.close()

    return 0


if __name__ == "__main__":
    sys.exit(main())
