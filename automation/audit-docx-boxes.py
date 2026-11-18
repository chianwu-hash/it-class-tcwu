"""Inspect publisher question-cell run borders without reading the answer cell.

Usage: python -X utf8 automation/audit-docx-boxes.py manifest.private.json report.private.json
Manifest: [{id, path, sha256, ...}]. The report contains private source snippets.
"""
import hashlib
import json
from pathlib import Path
import sys
import zipfile
from xml.etree import ElementTree as ET

NS = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
W = '{' + NS['w'] + '}'


def source_boxes(path):
    with zipfile.ZipFile(path) as doc:
        root = ET.fromstring(doc.read('word/document.xml'))
    rows = root.findall('./w:body/w:tbl/w:tr', NS)
    cells = rows[1].findall('w:tc', NS) if len(rows) > 1 else []
    headers = rows[0].findall('w:tc', NS) if rows else []
    first_header = ''.join(n.text or '' for n in headers[0].findall('.//w:t', NS)) if headers else ''
    if len(cells) < 2 or first_header.strip() != '題目':
        raise ValueError('unsupported_publisher_question_table')
    boxes = []
    for paragraph in cells[0].findall('.//w:p', NS):
        active = ''
        for run in paragraph.findall('w:r', NS):
            text = ''.join(node.text or '' for node in run.findall('w:t', NS))
            border = run.find('w:rPr/w:bdr', NS)
            marked = border is not None and border.get(W + 'val') not in ('nil', 'none')
            if marked:
                active += text
            elif text or run.find('w:br', NS) is not None or run.find('w:tab', NS) is not None:
                if active:
                    boxes.append(active)
                    active = ''
        if active:
            boxes.append(active)
    return boxes


def audit(rows):
    found = []
    for row in rows:
        path = Path(row['path'])
        if hashlib.sha256(path.read_bytes()).hexdigest() != row['sha256']:
            raise ValueError('source_sha_mismatch: ' + row['id'])
        boxes = source_boxes(path)
        if boxes:
            found.append({**row, 'boxes': boxes})
    return {'scanned': len(rows), 'found': found}


if __name__ == '__main__':
    result = audit(json.loads(Path(sys.argv[1]).read_text(encoding='utf-8')))
    Path(sys.argv[2]).write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps({'scanned': result['scanned'], 'border_sources': len(result['found'])}))
