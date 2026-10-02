"""
Document extraction trial (Option A: local batch, no DB writes, no model calls).

  python trial.py <folder-of-pdfs> [out-dir]

Per file: split into pages (pypdf), OCR scanned files (OCRmyPDF, if installed),
convert each page to Markdown (MarkItDown) so every chunk keeps its page number
for citations. Writes <out>/<name>.json and <out>/<name>.md plus a summary table
for scoring extraction quality by hand.
"""
import io
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from markitdown import MarkItDown
from pypdf import PdfReader, PdfWriter

MIN_CHARS = 40  # a page with less text than this is treated as scanned
md = MarkItDown()


def page_markdown(reader: PdfReader, i: int) -> str:
    w = PdfWriter()
    w.add_page(reader.pages[i])
    buf = io.BytesIO()
    w.write(buf)
    buf.seek(0)
    return md.convert_stream(buf, file_extension=".pdf").text_content.strip()


def ocr(src: Path, tmp: Path) -> Path | None:
    # --skip-text leaves pages that already have text untouched.
    if not shutil.which("ocrmypdf"):
        return None
    out = tmp / src.name
    r = subprocess.run(["ocrmypdf", "--skip-text", "-l", "eng+hin", str(src), str(out)],
                       capture_output=True, text=True)
    return out if r.returncode == 0 else None


def extract(src: Path, tmp: Path) -> dict:
    reader = PdfReader(src)
    pages = [page_markdown(reader, i) for i in range(len(reader.pages))]
    scanned = [i + 1 for i, t in enumerate(pages) if len(t) < MIN_CHARS]
    ocr_used = False
    if scanned:
        ocred = ocr(src, tmp)
        if ocred:
            reader = PdfReader(ocred)
            pages = [page_markdown(reader, i) for i in range(len(reader.pages))]
            ocr_used = True
    return {
        "file": src.name,
        "page_count": len(pages),
        "scanned_pages": scanned,
        "ocr_used": ocr_used,
        "empty_pages_after": [i + 1 for i, t in enumerate(pages) if len(t) < MIN_CHARS],
        "pages": [{"page": i + 1, "chars": len(t), "has_table": "| ---" in t, "text": t}
                  for i, t in enumerate(pages)],
    }


def main() -> None:
    src_dir = Path(sys.argv[1])
    out_dir = Path(sys.argv[2] if len(sys.argv) > 2 else "doc-trial-out")
    out_dir.mkdir(parents=True, exist_ok=True)
    if not shutil.which("ocrmypdf"):
        print("note: ocrmypdf not on PATH, scanned pages will stay empty\n")
    rows = []
    with tempfile.TemporaryDirectory() as t:
        for f in sorted(src_dir.glob("*.pdf")):
            try:
                r = extract(f, Path(t))
            except Exception as e:  # one bad file must not stop the batch
                print(f"FAIL {f.name}: {e}")
                continue
            (out_dir / f"{f.stem}.json").write_text(json.dumps(r, ensure_ascii=False, indent=1), encoding="utf-8")
            (out_dir / f"{f.stem}.md").write_text(
                "\n\n".join(f"<!-- page {p['page']} -->\n{p['text']}" for p in r["pages"]), encoding="utf-8")
            rows.append(r)
    print(f"{'file':40} pages scanned ocr empty tables")
    for r in rows:
        print(f"{r['file'][:40]:40} {r['page_count']:5} {len(r['scanned_pages']):7} "
              f"{'yes' if r['ocr_used'] else 'no':3} {len(r['empty_pages_after']):5} "
              f"{sum(p['has_table'] for p in r['pages']):6}")


if __name__ == "__main__":
    main()
