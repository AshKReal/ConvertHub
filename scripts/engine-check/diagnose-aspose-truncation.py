"""One-off diagnostic: is candidate C's (Aspose trial) low text/table count on long PDFs a real
quality gap, or the trial's page-count cap silently truncating output? Compares the source PDF's
real page count against each candidate docx's self-reported page/word count (docProps/app.xml).
"""
import zipfile
from xml.etree import ElementTree as ET

import pymupdf

from lib import HERE

NS = {"ep": "http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"}


def docx_app_props(path):
    with zipfile.ZipFile(path) as z:
        if "docProps/app.xml" not in z.namelist():
            return None
        xml = z.read("docProps/app.xml")
    root = ET.fromstring(xml)
    pages = root.find("ep:Pages", NS)
    words = root.find("ep:Words", NS)
    return {
        "pages": pages.text if pages is not None else None,
        "words": words.text if words is not None else None,
    }


targets = ["arxiv-2511.22036", "arxiv-2306.07968", "arxiv-2311.18248"]
for name in targets:
    pdf_path = HERE / "samples" / "pdf-docx" / f"{name}.pdf"
    with pymupdf.open(pdf_path) as doc:
        real_pages = doc.page_count
    print(f"\n{name}.pdf - real page count: {real_pages}")
    for label, out_dir in [
        ("A (libreoffice)", HERE / "results" / "pdf-docx-a-out"),
        ("B (pdf2docx)", HERE / "results" / "pdf-docx-b-out"),
        ("C (aspose)", HERE / "results" / "pdf-docx-c-out"),
    ]:
        props = docx_app_props(out_dir / f"{name}.docx")
        print(f"  {label:<20} {props}")
