from __future__ import annotations

import re
from pathlib import Path

from docx import Document
from pypdf import PdfReader


ROOT = Path(r"C:\Users\user\projects\it-class-tcwu\docs\references\school-exams\grade6")
SUPPORTED_SUFFIXES = {".pdf", ".docx"}


def safe_stem(name: str) -> str:
    cleaned = re.sub(r"[\\/:*?\"<>|]+", "-", name)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned


def extract_pdf_text(path: Path) -> str:
    reader = PdfReader(str(path))
    chunks: list[str] = []
    for index, page in enumerate(reader.pages, start=1):
        text = (page.extract_text() or "").strip()
        chunks.append(f"--- PAGE {index} ---\n{text}\n")
    return "\n".join(chunks).strip() + "\n"


def extract_docx_text(path: Path) -> str:
    doc = Document(str(path))
    paragraphs = [p.text.strip() for p in doc.paragraphs if p.text.strip()]
    return "\n".join(paragraphs).strip() + "\n"


def extract_text(path: Path) -> str:
    suffix = path.suffix.lower()
    if suffix == ".pdf":
        return extract_pdf_text(path)
    if suffix == ".docx":
        return extract_docx_text(path)
    raise ValueError(f"Unsupported file type: {path}")


def main() -> None:
    raw_dirs = sorted(ROOT.glob("*/*/raw"))
    for raw_dir in raw_dirs:
        text_dir = raw_dir.parent / "text"
        text_dir.mkdir(parents=True, exist_ok=True)
        for path in sorted(raw_dir.iterdir()):
            if not path.is_file():
                continue
            if path.name == ".gitkeep":
                continue
            if path.suffix.lower() not in SUPPORTED_SUFFIXES:
                continue
            target = text_dir / f"{safe_stem(path.stem)}.txt"
            print(f"Extracting {path} -> {target}")
            target.write_text(extract_text(path), encoding="utf-8")
    print("Done.")


if __name__ == "__main__":
    main()
