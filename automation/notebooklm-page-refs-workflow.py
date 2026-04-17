#!/usr/bin/env python3
from __future__ import annotations

import argparse
import html
import json
import re
import sys
from pathlib import Path


LESSON_MARKER_START = "<!-- PAGE_REFS:START -->"
LESSON_MARKER_END = "<!-- PAGE_REFS:END -->"
HTML_MARKER_START = "<!-- PAGE_REFS:START -->"
HTML_MARKER_END = "<!-- PAGE_REFS:END -->"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Parse NotebookLM raw page-ref output into reusable snippets and optional write-back."
    )
    parser.add_argument("--input", required=True, help="Raw NotebookLM text export path.")
    parser.add_argument("--json-out", help="Output JSON path.")
    parser.add_argument("--markdown-out", help="Output markdown snippet path.")
    parser.add_argument("--html-out", help="Output HTML snippet path.")
    parser.add_argument("--lesson-target", help="Markdown lesson plan target with PAGE_REFS markers.")
    parser.add_argument("--html-target", help="HTML week page target with PAGE_REFS markers.")
    return parser.parse_args()


def read_text(path_str: str) -> str:
    return Path(path_str).expanduser().resolve().read_text(encoding="utf-8")


def clean_line(line: str) -> str:
    return re.sub(r"\s+", " ", line).strip()


def warn(message: str) -> None:
    print(f"[WARN] {message}", file=sys.stderr)


def extract_structured_block(raw_text: str) -> tuple[list[dict[str, str]], list[str]]:
    lines = [clean_line(line) for line in raw_text.splitlines()]
    header_index = None
    for idx in range(len(lines) - 3, -1, -1):
        header_window = "".join(lines[idx : idx + 4])
        if "技能" in header_window and "可參考頁碼" in header_window and "頁碼重點" in header_window:
            header_index = idx
            break
    if header_index is None:
        raise ValueError("Could not find NotebookLM table header in raw text.")

    rows: list[dict[str, str]] = []
    reminder_heading_index = None
    data_lines: list[str] = []
    for offset, line in enumerate(lines[header_index + 1 :], start=header_index + 1):
        if not line:
            continue
        if "給老師的 3 點課堂提醒摘要" in line or line.startswith("💡"):
            reminder_heading_index = offset
            break
        if line in {"keep_pin", "儲存至記事", "copy_all", "thumb_up", "thumb_down"}:
            break
        data_lines.append(line)

    page_pattern = re.compile(r"^(P\.\d+(?:\s*,\s*P\.\d+)*)$|^未明確對應$")
    index = 0
    while index < len(data_lines) - 2:
        if data_lines[index] in {"技能", "可參考頁碼", "頁碼重點"}:
            index += 1
            continue
        skill = data_lines[index]
        pages = data_lines[index + 1]
        note = data_lines[index + 2]
        if page_pattern.match(pages):
            rows.append({"skill": skill, "pages": pages.replace(", ", "、"), "note": note})
            index += 3
            continue
        if "P." in pages or "p." in pages or "第" in pages or "頁" in pages:
            warn(
                "Skipped a candidate row because page format did not match the current pattern: "
                f"skill={skill!r}, pages={pages!r}"
            )
        index += 1

    if not rows:
        raise ValueError("Could not parse any page-ref rows from NotebookLM output.")

    reminders: list[str] = []
    if reminder_heading_index is not None:
        for line in lines[reminder_heading_index + 1 :]:
            if not line:
                continue
            if line in {"keep_pin", "儲存至記事", "copy_all", "thumb_up", "thumb_down"}:
                break
            reminders.append(line)
            if len(reminders) == 3:
                break

    if not reminders:
        reminders = [
            f"**{row['pages']}**：{row['note']}" for row in rows[:3]
        ]

    return rows, reminders


def render_markdown(rows: list[dict[str, str]], reminders: list[str]) -> str:
    table_lines = [
        "| 技能 | 可參考頁碼 | 頁碼重點 |",
        "|------|------------|----------|",
    ]
    for row in rows:
        table_lines.append(f"| {row['skill']} | {row['pages']} | {row['note']} |")

    reminder_lines = ["### 本週最值得先提醒學生翻的頁碼"]
    reminder_lines.extend(f"- {item}" for item in reminders[:3])
    return "\n".join(table_lines) + "\n\n" + "\n".join(reminder_lines) + "\n"


def render_html(rows: list[dict[str, str]], reminders: list[str]) -> str:
    cards: list[str] = ['<div class="grid md:grid-cols-2 xl:grid-cols-4 gap-4">']
    for index, row in enumerate(rows, start=1):
        cards.append(
            "\n".join(
                [
                    '    <div class="info-card bg-slate-50 border border-slate-200 rounded-2xl p-5">',
                    f'        <div class="text-sm font-black text-sky-700 mb-2">技能 {index}</div>',
                    f'        <h4 class="text-xl font-black text-slate-900 mb-2">{html.escape(row["skill"])}</h4>',
                    f'        <p class="text-lg font-black text-sky-800 mb-3">{html.escape(row["pages"])}</p>',
                    f'        <p class="font-bold text-slate-700 leading-relaxed">{html.escape(row["note"])}</p>',
                    "    </div>",
                ]
            )
        )
    cards.append("</div>")

    reminder_list = "\n".join(
        f'        <li><i class="fa-solid fa-circle-check text-amber-500 mr-2"></i>{html.escape(item)}</li>'
        for item in reminders[:3]
    )
    reminder_box = "\n".join(
        [
            '<div class="bg-amber-50 border border-amber-200 rounded-2xl p-5">',
            '    <div class="text-sm font-black text-amber-700 mb-2">先翻哪幾頁最有幫助</div>',
            '    <ul class="space-y-2 text-lg font-black text-slate-800">',
            reminder_list,
            "    </ul>",
            "</div>",
        ]
    )
    return "\n".join(cards) + "\n" + reminder_box + "\n"


def write_text(path_str: str | None, content: str) -> None:
    if not path_str:
        return
    path = Path(path_str).expanduser().resolve()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def replace_between_markers(file_path: Path, start_marker: str, end_marker: str, replacement: str) -> None:
    original = file_path.read_text(encoding="utf-8")
    start = original.find(start_marker)
    end = original.find(end_marker)
    if start == -1 or end == -1 or end < start:
        raise ValueError(f"Markers not found in {file_path}")
    start_content = start + len(start_marker)
    new_text = original[:start_content] + "\n" + replacement.rstrip() + "\n" + original[end:]
    file_path.write_text(new_text, encoding="utf-8")


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    args = parse_args()
    raw_text = read_text(args.input)
    rows, reminders = extract_structured_block(raw_text)
    data = {"items": rows, "reminders": reminders[:3]}

    markdown = render_markdown(rows, reminders)
    html_snippet = render_html(rows, reminders)

    write_text(args.json_out, json.dumps(data, ensure_ascii=False, indent=2))
    write_text(args.markdown_out, markdown)
    write_text(args.html_out, html_snippet)

    if args.lesson_target:
        replace_between_markers(
            Path(args.lesson_target).expanduser().resolve(),
            LESSON_MARKER_START,
            LESSON_MARKER_END,
            markdown,
        )
    if args.html_target:
        replace_between_markers(
            Path(args.html_target).expanduser().resolve(),
            HTML_MARKER_START,
            HTML_MARKER_END,
            html_snippet,
        )

    print(json.dumps(data, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
