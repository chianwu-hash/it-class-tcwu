"""國語題庫的已核對純注音字型轉換；不依答案或一般字典猜讀音。"""
import re
import json
from pathlib import Path

W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
# 以康軒光碟 SetupFont.exe 中原始字型逐字渲染核對。這是字型的
# 特定字碼對應，不是漢字通用讀音；未知字碼必須中止而不是回退國字。
READINGS = {
    '書法居中（注音一）': dict(zip(
        '七亂位使來修刺嗅在妒宰實少己已市常平廠德感懷摸末案楊洋港為獅的盧紹葵賽鉤長韶飭',
        ['ㄑㄧ','ㄌㄨㄢˋ','ㄨㄟˋ','ㄕˇ','ㄌㄞˊ','ㄒㄧㄡ','ㄘˋ','ㄒㄧㄡˋ',
         'ㄗㄞˋ','ㄉㄨˋ','ㄗㄞˇ','ㄕˊ','ㄕㄠˇ','ㄐㄧˇ','ㄧˇ','ㄕˋ',
         'ㄔㄤˊ','ㄆㄧㄥˊ','ㄔㄤˇ','ㄉㄜˊ','ㄍㄢˇ','ㄏㄨㄞˊ','ㄇㄛ','ㄇㄛˋ',
         'ㄢˋ','ㄧㄤˊ','ㄧㄤˊ','ㄍㄤˇ','ㄨㄟˋ','ㄕ','˙ㄉㄜ','ㄌㄨˊ',
         'ㄕㄠˋ','ㄎㄨㄟˊ','ㄙㄞˋ','ㄍㄡ','ㄓㄤˇ','ㄕㄠˊ','ㄔˋ'], strict=True)),
    '書法居中（注音三）': {'得': 'ㄉㄟˇ'},
}

# 2026-10-29：完整可抽國語池逐字對照原光碟字形；包含故意錯讀的干擾項。
# 對照資料只存標準注音，不分發書商字型。舊有已核對讀音不可被靜默覆蓋。
for _font, _mapping in json.loads(Path(__file__).with_name('quiz_chinese_font_readings.json').read_text(encoding='utf-8')).items():
    for _char, _reading in _mapping.items():
        if _char in READINGS.get(_font, {}) and READINGS[_font][_char] != _reading:
            raise ValueError('已核對注音字碼衝突：' + _font + ' / ' + _char)
        READINGS.setdefault(_font, {})[_char] = _reading


def convert_zhuyin_tree(root):
    """在 XML 抽取前轉換直接指定的純注音 run，回傳可稽核變更。"""
    changes = []
    for run in root.iter(W + 'r'):
        fonts = run.find(W + 'rPr/' + W + 'rFonts')
        if fonts is None:
            continue
        font = fonts.get(W + 'eastAsia', '')
        if '居中' not in font or '注音' not in font:
            continue
        if font not in READINGS:
            raise ValueError('尚未核對的純注音字型：' + font)
        for text in run.iter(W + 't'):
            before = text.text or ''
            def replace(match):
                char = match[0]
                if char not in READINGS[font]:
                    raise ValueError('尚未核對的注音字碼：' + font + ' / ' + char)
                return READINGS[font][char]
            after = re.sub(r'[\u3400-\u9fff]', replace, before)
            if before != after:
                changes.append({'font': font, 'before': before, 'after': after})
                text.text = after
    return changes
