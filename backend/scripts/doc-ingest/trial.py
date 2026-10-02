"""
Document extraction trial (Option A: local batch, no DB writes, no model calls).

  python trial.py <folder-of-pdfs> [out-dir] [--lang eng+hin]

Per file and per page (so every chunk keeps its page number for citations):
  - text pages:    MarkItDown for prose, pdfplumber for tables (it keeps tables
                   that sit side by side apart; MarkItDown merges them).
  - scanned pages: OCRmyPDF (Tesseract), then the plain OCR text. MarkItDown is
                   not used here: it turns scattered OCR words into fake tables.
Writes <out>/<name>.json and <out>/<name>.md plus a summary table for scoring
by hand. Byte-identical files are reported and skipped.

Language: default is English. Pass --lang eng+hin only for Hindi documents;
on English artwork the Hindi model invents Devanagari text.
Needs: pip install -r requirements.txt, plus Tesseract (with the language
packs you pass) and Ghostscript on PATH.
"""
import hashlib
import io
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import pdfplumber
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


def table_markdown(rows: list[list[str | None]]) -> str:
    rows = [[(c or "").replace("\n", " ").strip() for c in r] for r in rows]
    rows = [r for r in rows if any(r)]
    if not rows:
        return ""
    head = "| " + " | ".join(rows[0]) + " |"
    sep = "| " + " | ".join("---" for _ in rows[0]) + " |"
    return "\n".join([head, sep] + ["| " + " | ".join(r) + " |" for r in rows[1:]])


def ocr(src: Path, tmp: Path, lang: str) -> tuple[Path | None, str]:
    """Returns (ocr'd pdf or None, warning). --skip-text leaves text pages alone."""
    if not shutil.which("ocrmypdf"):
        return None, "ocrmypdf not on PATH"
    out = tmp / src.name
    r = subprocess.run(["ocrmypdf", "--skip-text", "-l", lang, str(src), str(out)],
                       capture_output=True, text=True, encoding="utf-8", errors="replace")
    if r.returncode == 0:
        return out, ""
    # A damaged source (truncated image streams) still gets a usable text layer,
    # but OCRmyPDF flags the output invalid. Keep it and say so.
    tail = " / ".join(l.strip() for l in r.stderr.splitlines() if "ERROR" in l or "INVALID" in l)[:300]
    return (out if out.exists() else None), f"ocrmypdf exit {r.returncode}: {tail}"


def extract(src: Path, tmp: Path, lang: str) -> dict:
    reader = PdfReader(src)
    plumber = pdfplumber.open(src)
    pages, warnings = [], []
    for i in range(len(reader.pages)):
        text = page_markdown(reader, i)
        tables = [] if len(text) < MIN_CHARS else [
            t for t in (table_markdown(x) for x in plumber.pages[i].extract_tables()) if t]
        pages.append({"page": i + 1, "source": "text", "text": text, "tables": tables})
    plumber.close()

    scanned = [p["page"] for p in pages if len(p["text"]) < MIN_CHARS]
    if scanned:
        ocred, warn = ocr(src, tmp, lang)
        if warn:
            warnings.append(warn)
        if ocred:
            ocr_reader = PdfReader(ocred)
            for n in scanned:
                pages[n - 1].update(source="ocr", text=(ocr_reader.pages[n - 1].extract_text() or "").strip())

    for p in pages:
        p["chars"] = len(p["text"])
    return {
        "file": src.name,
        "page_count": len(pages),
        "scanned_pages": scanned,
        "empty_pages_after": [p["page"] for p in pages if p["chars"] < MIN_CHARS],
        "warnings": warnings,
        "pages": pages,
    }


def main() -> None:
    args = sys.argv[1:]
    lang = "eng"
    if "--lang" in args:
        k = args.index("--lang")
        lang = args[k + 1]
        del args[k:k + 2]
    src_dir = Path(args[0])
    out_dir = Path(args[1] if len(args) > 1 else "doc-trial-out")
    out_dir.mkdir(parents=True, exist_ok=True)

    seen: dict[str, str] = {}
    rows = []
    with tempfile.TemporaryDirectory() as t:
        for f in sorted(src_dir.glob("*.pdf")):
            digest = hashlib.md5(f.read_bytes()).hexdigest()
            if digest in seen:
                print(f"SKIP {f.name}: identical to {seen[digest]}")
                continue
            seen[digest] = f.name
            try:
                r = extract(f, Path(t), lang)
            except Exception as e:  # one bad file must not stop the batch
                print(f"FAIL {f.name}: {e}")
                continue
            (out_dir / f"{f.stem}.json").write_text(json.dumps(r, ensure_ascii=False, indent=1), encoding="utf-8")
            (out_dir / f"{f.stem}.md").write_text("\n\n".join(
                f"<!-- page {p['page']} ({p['source']}) -->\n{p['text']}"
                + "".join(f"\n\n<!-- table -->\n{tb}" for tb in p["tables"])
                for p in r["pages"]), encoding="utf-8")
            rows.append(r)

    print(f"\n{'file':36} pages scanned empty tables warnings")
    for r in rows:
        print(f"{r['file'][:36]:36} {r['page_count']:5} {len(r['scanned_pages']):7} "
              f"{len(r['empty_pages_after']):5} {sum(len(p['tables']) for p in r['pages']):6} "
              f"{'; '.join(r['warnings'])[:80]}")


if __name__ == "__main__":
    main()
