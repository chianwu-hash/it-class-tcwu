from __future__ import annotations

import datetime as dt
import re
import ssl
from dataclasses import dataclass
from html import unescape
from pathlib import Path
from urllib.request import urlopen
from zipfile import ZipFile

from pypdf import PdfReader


ROOT = Path(r"C:\Users\user\projects\it-class-tcwu\docs\references\108-curriculum")
TODAY = dt.date.today().isoformat()


@dataclass(frozen=True)
class DownloadItem:
    key: str
    label: str
    target: Path
    url: str
    note_path: Path | None = None
    extraction_format: str = "pdf"
    anomaly_note: str | None = None


FILES: list[DownloadItem] = [
    DownloadItem(
        key="framework",
        label="Curriculum framework",
        target=ROOT / "general" / "curriculum-framework.pdf",
        url="https://stv.naer.edu.tw/data/course_outline/%28111%E5%AD%B8%E5%B9%B4%E5%BA%A6%E5%AF%A6%E6%96%BD%29%E5%8D%81%E4%BA%8C%E5%B9%B4%E5%9C%8B%E6%95%99%E8%AA%B2%E7%A8%8B%E7%B6%B1%E8%A6%81%E7%B8%BD%E7%B6%B1.pdf",
    ),
    DownloadItem(
        key="chinese_outline",
        label="Chinese outline",
        target=ROOT / "subjects" / "chinese" / "curriculum-outline.pdf",
        url="https://stv.naer.edu.tw/data/course_outline/pta_18510_4703638_59125.pdf",
        note_path=ROOT / "subjects" / "chinese" / "notes.md",
    ),
    DownloadItem(
        key="english_outline",
        label="English outline",
        target=ROOT / "subjects" / "english" / "curriculum-outline.pdf",
        url="https://stv.naer.edu.tw/data/course_outline/pta_18518_3555074_59836.pdf",
        note_path=ROOT / "subjects" / "english" / "notes.md",
    ),
    DownloadItem(
        key="math_outline",
        label="Math outline",
        target=ROOT / "subjects" / "math" / "curriculum-outline.odt",
        url="https://stv.naer.edu.tw/data/course_outline/212882526.odt",
        note_path=ROOT / "subjects" / "math" / "notes.md",
        extraction_format="odt",
        anomaly_note=(
            "The official NAER outline page currently links the math PDF slot to a "
            "course-manual PDF. This workflow uses the same row's ODT file as the "
            "authoritative math outline source."
        ),
    ),
    DownloadItem(
        key="science_outline",
        label="Science outline",
        target=ROOT / "subjects" / "science" / "curriculum-outline.pdf",
        url="https://stv.naer.edu.tw/data/course_outline/pta_18538_240851_60502.pdf",
        note_path=ROOT / "subjects" / "science" / "notes.md",
    ),
    DownloadItem(
        key="social_outline",
        label="Social outline",
        target=ROOT / "subjects" / "social" / "curriculum-outline.pdf",
        url="https://stv.naer.edu.tw/data/course_outline/pta_18535_6408773_60398.pdf",
        note_path=ROOT / "subjects" / "social" / "notes.md",
    ),
    DownloadItem(
        key="chinese_manual",
        label="Chinese manual",
        target=ROOT / "subjects" / "chinese" / "curriculum-manual.pdf",
        url="https://www.naer.edu.tw/upload/1/16/doc/2012/%E8%AA%9E%E6%96%87%E9%A0%98%E5%9F%9F-%E5%9C%8B%E8%AA%9E%E6%96%87%E8%AA%B2%E7%A8%8B%E6%89%8B%E5%86%8A%28%E5%AE%9A%E7%A8%BF%E7%89%88%29.pdf",
        note_path=ROOT / "subjects" / "chinese" / "notes.md",
    ),
    DownloadItem(
        key="english_manual",
        label="English manual",
        target=ROOT / "subjects" / "english" / "curriculum-manual.pdf",
        url="https://www.naer.edu.tw/upload/1/16/doc/2017/%E8%AA%9E%E6%96%87%E9%A0%98%E5%9F%9F-%E8%8B%B1%E8%AA%9E%E6%96%87%E8%AA%B2%E7%A8%8B%E6%89%8B%E5%86%8A%EF%BC%88%E5%AE%9A%E7%A8%BF%E7%89%88%EF%BC%89.pdf",
        note_path=ROOT / "subjects" / "english" / "notes.md",
    ),
    DownloadItem(
        key="math_manual",
        label="Math manual",
        target=ROOT / "subjects" / "math" / "curriculum-manual.pdf",
        url="https://www.naer.edu.tw/upload/1/9/doc/2021/%E6%95%B8%E5%AD%B8%E9%A0%98%E5%9F%9F%E8%AA%B2%E7%A8%8B%E6%89%8B%E5%86%8A%EF%BC%88114%E5%B9%B41%E6%9C%88%E6%9B%B4%E6%96%B0%E7%89%88%EF%BC%89.pdf",
        note_path=ROOT / "subjects" / "math" / "notes.md",
    ),
    DownloadItem(
        key="science_manual",
        label="Science manual",
        target=ROOT / "subjects" / "science" / "curriculum-manual.pdf",
        url="https://www.naer.edu.tw/upload/1/16/doc/2025/%E8%87%AA%E7%84%B6%E7%A7%91%E5%AD%B8%E9%A0%98%E5%9F%9F%E8%AA%B2%E7%A8%8B%E6%89%8B%E5%86%8A%28%E5%AE%9A%E7%A8%BF%E7%89%88%29.pdf",
        note_path=ROOT / "subjects" / "science" / "notes.md",
    ),
    DownloadItem(
        key="social_manual",
        label="Social manual",
        target=ROOT / "subjects" / "social" / "curriculum-manual.pdf",
        url="https://www.naer.edu.tw/upload/1/16/doc/2026/%E7%A4%BE%E6%9C%83%E9%A0%98%E5%9F%9F%E8%AA%B2%E7%A8%8B%E6%89%8B%E5%86%8A%EF%BC%88%E5%AE%9A%E7%A8%BF%E7%89%88%EF%BC%89.pdf",
        note_path=ROOT / "subjects" / "social" / "notes.md",
    ),
]


NOTES_BY_SUBJECT = {
    "chinese": {
        "title": "# 國語文 108 課綱參考摘要",
        "focus": "- 易出成後設題或超綱題的區域",
    },
    "english": {
        "title": "# 英語文 108 課綱參考摘要",
        "focus": "- 易出成文法術語題、教學目標題或脫離語用情境的區域",
    },
    "math": {
        "title": "# 數學 108 課綱參考摘要",
        "focus": "- 哪些題型屬於年段可考，哪些已偏向超綱",
    },
    "science": {
        "title": "# 自然科學 108 課綱參考摘要",
        "focus": "- 容易混入生活常識題、但教材證據不足的區域",
    },
    "social": {
        "title": "# 社會 108 課綱參考摘要",
        "focus": "- 易變成背誦瑣碎名詞、但未真正對應學習重點的區域",
    },
}


def download_file(url: str, target: Path) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    context = ssl.create_default_context()
    with urlopen(url, context=context) as response:
        target.write_bytes(response.read())


def extract_pdf_text(pdf_path: Path) -> str:
    reader = PdfReader(str(pdf_path))
    chunks: list[str] = []
    for index, page in enumerate(reader.pages, start=1):
        text = page.extract_text() or ""
        chunks.append(f"--- PAGE {index} ---\n{text.strip()}\n")
    return "\n".join(chunks).strip() + "\n"


def extract_odt_text(odt_path: Path) -> str:
    with ZipFile(odt_path) as archive:
        xml = archive.read("content.xml").decode("utf-8", errors="ignore")
    xml = re.sub(r"</text:(?:p|h|list-item|tab|line-break)>", "\n", xml)
    xml = re.sub(r"<text:s[^>]*/>", " ", xml)
    xml = re.sub(r"<[^>]+>", " ", xml)
    xml = unescape(xml)
    xml = re.sub(r"[ \t]+\n", "\n", xml)
    xml = re.sub(r"\n{3,}", "\n\n", xml)
    xml = re.sub(r"[ \t]{2,}", " ", xml)
    return xml.strip() + "\n"


def extract_text(item: DownloadItem) -> str:
    if item.extraction_format == "pdf":
        return extract_pdf_text(item.target)
    if item.extraction_format == "odt":
        return extract_odt_text(item.target)
    raise ValueError(f"Unsupported extraction format: {item.extraction_format}")


def subject_from_path(note_path: Path) -> str:
    return note_path.parent.name


def build_download_section(subject: str, items: list[DownloadItem]) -> str:
    lines = ["## 已下載文件", ""]
    for item in items:
        lines.append(f"### {item.label}")
        lines.append(f"- 本地檔案：`{item.target.name}`")
        lines.append(f"- 來源 URL：{item.url}")
        lines.append(f"- 下載日期：{TODAY}")
        lines.append(f"- 轉檔日期：{TODAY}")
        if item.anomaly_note:
            lines.append(f"- 備註：{item.anomaly_note}")
        lines.append("")
    return "\n".join(lines).rstrip() + "\n"


def build_notes(subject: str, items: list[DownloadItem]) -> str:
    meta = NOTES_BY_SUBJECT[subject]
    body = [
        meta["title"],
        "",
        "待依實際命題需求，補充六年級最常用的學習重點與命題提醒。",
        "",
        "建議記錄：",
        "- 官方文件名稱",
        "- 來源 URL",
        "- 下載日期",
        "- 轉檔日期",
        "- 六年級題庫最常用的學習重點",
        meta["focus"],
        "",
        build_download_section(subject, items).rstrip(),
        "",
    ]
    return "\n".join(body)


def write_notes() -> None:
    items_by_note: dict[Path, list[DownloadItem]] = {}
    for item in FILES:
        if item.note_path is None:
            continue
        items_by_note.setdefault(item.note_path, []).append(item)

    for note_path, items in items_by_note.items():
        subject = subject_from_path(note_path)
        note_path.write_text(build_notes(subject, items), encoding="utf-8")


def cleanup_math_anomaly_files() -> None:
    math_dir = ROOT / "subjects" / "math"
    for name in ("curriculum-outline.pdf", "curriculum-outline.txt"):
        path = math_dir / name
        if path.exists():
            path.unlink()


def main() -> None:
    cleanup_math_anomaly_files()
    for item in FILES:
        txt_path = item.target.with_suffix(".txt")
        print(f"Downloading {item.label} -> {item.target}")
        download_file(item.url, item.target)
        print(f"Extracting text -> {txt_path}")
        txt_path.write_text(extract_text(item), encoding="utf-8")
    write_notes()
    print("Done.")


if __name__ == "__main__":
    main()
