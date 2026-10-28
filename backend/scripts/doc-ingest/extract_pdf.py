"""
Brochure / price-list extraction that is safe on a shared laptop.

  .venv/Scripts/python extract_pdf.py <file.pdf> <out.json> [--min-free-gb 1.0] [--threads 3] [--tables]

Per page:
  - digital page (has a text layer): pypdfium2 native text. Fast and almost no memory. No OCR, no model.
  - image-only page: render ONE page at ~150 DPI, run RapidOCR (PaddleOCR models on ONNX Runtime, CPU, no torch), free it, move on.
  - --tables: also run pdfplumber table extraction on digital pages. Off by default: it was 100x slower on image-heavy brochures
    and mostly returned layout artifacts there.
Memory guard: before every OCR page it checks free RAM and stops cleanly (aborted_low_memory) rather than push the machine into swap.
Writes <out.json> with text per page (page numbers kept for citations), method used, seconds and peak memory.
"""
import gc
import json
import sys
import time

import psutil
import pypdfium2 as pdfium

MIN_TEXT_CHARS = 80  # fewer characters than this on a page means it is an image


def main():
    pdf_path, out_path = sys.argv[1], sys.argv[2]
    min_free = float(sys.argv[sys.argv.index("--min-free-gb") + 1]) if "--min-free-gb" in sys.argv else 1.0
    threads = int(sys.argv[sys.argv.index("--threads") + 1]) if "--threads" in sys.argv else 3
    want_tables = "--tables" in sys.argv
    proc = psutil.Process()
    peak = proc.memory_info().rss
    t0 = time.time()
    ocr = None
    pages = []
    aborted = False

    doc = pdfium.PdfDocument(pdf_path)
    plumber = None
    if want_tables:
        import pdfplumber

        plumber = pdfplumber.open(pdf_path)

    for i in range(len(doc)):
        page = doc[i]
        text = (page.get_textpage().get_text_range() or "").strip()
        entry = {"page": i + 1, "method": "text", "text": text}
        if len(text) >= MIN_TEXT_CHARS:
            if plumber is not None:
                try:
                    tables = [t for t in plumber.pages[i].extract_tables() if t and len(t) > 1]
                    if tables:
                        entry["tables"] = tables
                except Exception:
                    pass
        else:
            free_gb = psutil.virtual_memory().available / 1024**3
            if free_gb < min_free:
                aborted = True
                entry.update(method="skipped_low_memory", text="")
                pages.append(entry)
                break
            if ocr is None:
                from rapidocr import RapidOCR  # imported late: no model memory for fully digital PDFs

                try:
                    ocr = RapidOCR(params={"EngineConfig.onnxruntime.intra_op_num_threads": threads})
                except Exception:
                    ocr = RapidOCR()
            img = page.render(scale=2).to_pil()  # one page at a time
            res = ocr(img)
            entry.update(method="ocr", text="\n".join(list(getattr(res, "txts", None) or [])))
            del img, res
            gc.collect()
        pages.append(entry)
        peak = max(peak, proc.memory_info().rss)

    out = {
        "pdf": pdf_path,
        "pages": pages,
        "page_count": len(pages),
        "digital_pages": sum(1 for p in pages if p["method"] == "text"),
        "ocr_pages": sum(1 for p in pages if p["method"] == "ocr"),
        "aborted_low_memory": aborted,
        "seconds": round(time.time() - t0, 1),
        "peak_rss_mb": round(peak / 1024**2),
    }
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False)
    print({k: v for k, v in out.items() if k != "pages"})


if __name__ == "__main__":
    main()
