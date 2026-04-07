"""
pdf2txt.py：將 PDF 轉成 UTF-8 文字檔

用法：
  python pdf2txt.py 檔案.pdf
  python pdf2txt.py 檔案.pdf -o 輸出.txt
  python pdf2txt.py 資料夾
  python pdf2txt.py 資料夾 -o 輸出資料夾

相依套件：
  pip install pymupdf
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path


def looks_like_single_char_line(line: str) -> bool:
    stripped = line.strip()
    return bool(stripped) and len(stripped) == 1


def normalize_vertical_text(text: str, min_run: int = 4) -> str:
    """
    將直排 PDF 抽出的「一字一行」內容重新接回較可讀的橫排文字。
    只在連續單字行達到一定數量時才合併，避免誤傷一般條列內容。
    """
    # 去除常見控制字元，但保留換行與 tab
    text = "".join(ch for ch in text if ch in "\n\t" or ord(ch) >= 32)
    lines = text.splitlines()
    out: list[str] = []
    run: list[str] = []

    def flush_run(force_join: bool = False) -> None:
        nonlocal run
        if not run:
            return
        if force_join or len(run) >= min_run:
            out.append("".join(part.strip() for part in run))
        else:
            out.extend(run)
        run = []

    for idx, line in enumerate(lines):
        if looks_like_single_char_line(line):
            run.append(line)
            continue

        prev_is_blank = bool(out) and out[-1] == ""
        next_line = lines[idx + 1] if idx + 1 < len(lines) else ""
        next_is_blank = not next_line.strip()
        force_join = len(run) >= 2 and (prev_is_blank or next_is_blank)
        flush_run(force_join=force_join)
        out.append(line)

    flush_run()

    # 清理過多空白行
    cleaned: list[str] = []
    blank_count = 0
    for line in out:
        if line.strip():
            blank_count = 0
            cleaned.append(line.rstrip())
        else:
            blank_count += 1
            if blank_count <= 1:
                cleaned.append("")

    return "\n".join(cleaned).strip() + "\n"


def extract_pdf_text(pdf_path: Path) -> str:
    try:
        import fitz  # pymupdf
    except ImportError:
        sys.exit("找不到 pymupdf，請先執行：pip install pymupdf")

    doc = fitz.open(pdf_path)
    chunks: list[str] = []

    for i, page in enumerate(doc):
        raw = page.get_text()
        normalized = normalize_vertical_text(raw)
        chunks.append(f"=== 第 {i + 1} 頁 ===\n{normalized}")

    return "\n".join(chunks)


def pdf_to_txt(pdf_path: Path, txt_path: Path) -> None:
    txt_path.parent.mkdir(parents=True, exist_ok=True)
    text = extract_pdf_text(pdf_path)
    txt_path.write_text(text, encoding="utf-8")
    print(f"[完成] {pdf_path.name}  →  {txt_path}")


def main() -> None:
    parser = argparse.ArgumentParser(description="PDF 轉文字檔")
    parser.add_argument("input", help="PDF 檔案或資料夾")
    parser.add_argument("-o", "--output", help="輸出檔案或輸出資料夾", default=None)
    args = parser.parse_args()

    src = Path(args.input)

    if src.is_dir():
        pdfs = sorted(src.glob("*.pdf"))
        if not pdfs:
            sys.exit(f"資料夾內找不到 PDF：{src}")
        out_dir = Path(args.output) if args.output else src
        for pdf in pdfs:
            pdf_to_txt(pdf, out_dir / pdf.with_suffix(".txt").name)
    elif src.is_file() and src.suffix.lower() == ".pdf":
        out = Path(args.output) if args.output else src.with_suffix(".txt")
        pdf_to_txt(src, out)
    else:
        sys.exit(f"找不到可處理的輸入：{src}")


if __name__ == "__main__":
    main()
