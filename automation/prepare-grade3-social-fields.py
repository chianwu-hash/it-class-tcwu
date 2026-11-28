"""Verify and adapt text-only structured Kang Hsuan social studies worksheets."""
import argparse
from collections import Counter, defaultdict
import importlib.util
import json
from pathlib import Path
import re

from lxml import etree


CIRCLED = "①②③④⑤⑥⑦⑧⑨⑩⑪⑫"
BLANK = r"[（(][\s_＿]+[）)]"
CHOICE_MARKER = "[甲乙丙丁戊己庚辛壬癸]"


def module(path):
    spec = importlib.util.spec_from_file_location(path.stem, path)
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result


def options(values):
    return [{"id": f"o{i}", "content": {"text": value, "media": []}}
            for i, value in enumerate(values, 1)]


def read_original(file, output, native):
    parser = native.Native(file, output)
    require = native.require
    try:
        body = parser.root.find("w:body", native.ns)
        tables = body.findall("w:tbl", native.ns)
        require(len(tables) == 1 and all(
            child is tables[0] or etree.QName(child).localname in ("p", "sectPr")
            and not child.xpath(".//w:t[normalize-space()]|.//w:drawing|.//w:pict", namespaces=native.ns)
            for child in body), "word_body_layout")
        headers, body_row = tables[0].findall("w:tr", native.ns)
        require(["".join(c.xpath(".//w:t/text()", namespaces=native.ns))
                 for c in headers.findall("w:tc", native.ns)] == ["題目", "答案", "解析"], "word_headers")
        prompt, key, solution = [parser.nodes(cell) for cell in body_row.findall("w:tc", native.ns)]
        require(all(native.plain(c) for c in (prompt, key, solution)), "original_media_or_table")
        require(key["text"].startswith("《答案》"), "teacher_key_header")
        return prompt["text"], key["text"], solution["text"]
    finally:
        parser.z.close()


def numbered(text, pattern, require):
    intro, labels, marks = [], [], []
    for raw in text.splitlines():
        line = raw.strip()
        if not line:
            continue
        match = re.fullmatch(pattern, line)
        if match:
            marks.append(match[1])
            labels.append(match[2].strip())
        else:
            require(not labels, "unmatched_word_line")
            intro.append(line)
    require(len(labels) >= 2 and all(labels) and "".join(marks) == CIRCLED[:len(labels)],
            "numbered_positions")
    return intro, labels


def numbered_key(text, require):
    reader = re.compile(r"([" + CIRCLED + r"])([^" + CIRCLED + r"]+)")
    found = list(reader.finditer(text))
    require(found and "".join(match[0] for match in found) == text and
            "".join(match[1] for match in found) == CIRCLED[:len(found)], "teacher_numbered_key")
    return [match[2].strip().rstrip("。") for match in found]


def adapt_sequence(word, raw_key, native):
    require = native.require
    lines = [line.strip() for line in word.splitlines() if line.strip()]
    require(len(lines) >= 4 and "排" in lines[0] and re.fullmatch(
        r"答[：:]\s*" + BLANK + r"(?:\s*→\s*" + BLANK + ")*", lines[-1]), "sequence_word_layout")
    pattern = r"([甲乙丙丁戊己①②③④⑤⑥])(?:[、.．])?\s*(\S.*)"
    items = [re.fullmatch(pattern, line) for line in lines[1:-1]]
    require(all(items) and 2 <= len(items) <= 6, "sequence_word_options")
    marks = [m[1] for m in items]
    require(marks in [list("甲乙丙丁戊己"[:len(items)]), list(CIRCLED[:len(items)])], "sequence_word_options")
    labels = [m[2] for m in items]
    require(len({native.compact(label) for label in labels}) == len(labels), "sequence_word_options")
    typed_slots = len(re.findall(BLANK, lines[-1]))
    require(typed_slots in (1, len(items)), "sequence_word_options")
    key = re.split(r"\s*→\s*", raw_key.strip().rstrip("。"))
    require(len(key) == len(marks) and set(key) == set(marks), "sequence_teacher_key")
    indices = [marks.index(mark) for mark in key]
    field = {"id":"f1","input":"sequence","label":"依序排列","options":options(labels)}
    return "sequence", lines[0], [field], {"f1":[[f"o{i+1}" for i in indices]]}, " → ".join(labels[i] for i in indices)


def adapt_inline_selection(word, raw_key, native):
    require = native.require
    pattern = r"([" + CIRCLED + r"])[（(]([^／/（）()\n]+)[／/]([^／/（）()\n]+)[）)]"
    pairs = list(re.finditer(pattern, word))
    require(2 <= len(pairs) <= 6 and "".join(m[1] for m in pairs) == CIRCLED[:len(pairs)]
            and not re.search("["+CIRCLED+"]", re.sub(pattern, "", word)), "inline_choice_positions")
    keys = numbered_key(raw_key, require)
    require(len(pairs) == len(keys), "inline_choice_teacher_key")
    fields, answers = [], {}
    for i, (match, answer) in enumerate(zip(pairs, keys), 1):
        texts = [v.strip() for v in match.groups()[1:]]
        require(all(texts) and len(set(map(native.compact, texts))) == 2 and answer in texts,
                "inline_choice_teacher_key")
        fid = f"f{i}"
        fields.append({"id":fid,"input":"single","label":f"第 {i} 格","options":options(texts)})
        answers[fid] = [f"o{texts.index(answer)+1}"]
    prompt = re.sub(pattern, lambda m: f"〔{CIRCLED.index(m[1])+1}〕", word)
    return "inline_choice", prompt, fields, answers, "／".join(keys)


def adapt(item, word, raw_key, required, native):
    require = native.require
    code = item["QUES_TYPE"]
    if code == "21":
        return adapt_sequence(word, raw_key, native)
    if code == "22":
        return adapt_inline_selection(word, raw_key, native)
    field_targets = {}
    selected_text = []
    kind = ""
    if code == "44":
        intro, labels = numbered(word, r"[□☐]?\s*([" + CIRCLED + r"])\s*(.+)", require)
        require(int(item["ANS_NUM"]) == len(labels) and "打ˇ" in "".join(intro), "checkbox_structure")
        require(len(labels) <= 8, "checkbox_option_limit")
        key = re.fullmatch(r"([1-9][0-9]?(?:、[1-9][0-9]?)+)打ˇ", native.compact(raw_key))
        require(key, "teacher_checkbox_key")
        selected = [int(s) for s in key[1].split("、")]
        require(len(set(selected)) == len(selected) and all(1 <= i <= len(labels) for i in selected),
                "teacher_checkbox_index")
        fields = [{"id":"f1", "input":"set", "label":"勾選符合的項目", "options":options(labels)}]
        field_targets["f1"] = [[f"o{i}" for i in selected]]
        selected_text = [labels[i-1] for i in selected]
        prompt = "\n".join(intro)
        kind = "checkbox"
    elif code == "45":
        intro, labels = numbered(word, BLANK + r"\s*([" + CIRCLED + r"])\s*(.+)", require)
        keys = numbered_key(raw_key, require)
        require(len(keys) == len(labels) == item["ANS_NUM"], "teacher_boolean_count")
        symbols = [symbol for symbol in ("○","ˇ","╳") if symbol in "".join(intro)]
        require(len(symbols) == 2 and symbols[-1] == "╳" and set(keys) <= set(symbols), "teacher_boolean_symbols")
        fields = [{"id":f"f{i}", "input":"single", "label":label, "options":options(symbols)}
                  for i, label in enumerate(labels, 1)]
        for field, key in zip(fields, keys):
            field_targets[field["id"]] = [f"o{symbols.index(key)+1}"]
        selected_text = [label for label, k in zip(labels, keys) if k != "╳"]
        prompt = "\n".join(intro)
        kind = "boolean_rows"
    elif code == "23":
        lines = [line.strip() for line in word.splitlines() if line.strip()]
        choice = re.compile(r"(" + CHOICE_MARKER + r")[、.．]\s*(.+)")
        candidates = [(i, match[1], match[2]) for i,line in enumerate(lines) if (match := choice.fullmatch(line))]
        require(candidates and [i for i, _, _ in candidates] == list(range(candidates[0][0],candidates[-1][0]+1)),
                "source_option_bank")
        bank = [mark for _, mark, _ in candidates]
        require(len(set(bank)) == len(bank), "source_option_bank_duplicates")
        labels = [mark+"、"+value for _,mark,value in candidates]
        require(len({native.compact(value).rstrip("。") for _, _, value in candidates})==len(labels),
                "source_option_bank_duplicates")
        keys = numbered_key(raw_key, require)
        require(len(keys) >= 2, "matching_answer_count")
        lead = lines[:candidates[0][0]]
        rest = "\n".join(lines[candidates[-1][0]+1:])
        if all(re.match(r"^\s*(?:"+BLANK+r"\s*)?["+CIRCLED+r"]", s) for s in rest.splitlines()):
            _, left = numbered(rest, r"(?:"+BLANK+r"\s*)?(["+CIRCLED+r"])\s*(.+)", require)
            left = [re.sub(BLANK,"",line).rstrip("：: ") for line in left]
            require(all(left) and len(left)==len(keys), "matching_label_count")
        else:
            marks = list(re.finditer(r"(["+CIRCLED+r"])\s*"+BLANK,rest))
            require("".join(m[1] for m in marks)==CIRCLED[:len(keys)] and len(marks)==len(keys), "inline_matching_slots")
            left = [f"第 {i} 格" for i in range(1,len(keys)+1)]
            replace = iter(range(1,len(keys)+1))
            lead.append(re.sub(r"["+CIRCLED+r"]\s*"+BLANK,lambda _:f"〔{next(replace)}〕",rest))
        fields = []
        for i,(label,key) in enumerate(zip(left,keys),1):
            key_values = key.split("、")
            require(len(set(key_values))==len(key_values) and all(k in bank for k in key_values), "teacher_matching_symbols")
            option_ids = [f"o{bank.index(k)+1}" for k in key_values]
            selected_text.extend(labels[bank.index(k)] for k in key_values)
            field = {"id":f"f{i}","input":"set" if len(key_values)>1 else "single","label":label,"options":options(labels)}
            fields.append(field)
            field_targets[field["id"]]=[option_ids] if len(key_values)>1 else option_ids
        prompt = "\n".join(lead)
        kind = "match_columns"
    else:
        text = word.splitlines()
        require(len(text)>=2 and re.search("填入",text[0]), "text_blank_instruction")
        intro = text[0]
        body = "\n".join(text[1:])
        slots = list(re.finditer(BLANK,body))
        require(1<=len(slots)<=8 and not any("（" in m[0][1:-1] for m in slots), "text_blank_positions")
        if re.match(r"^["+CIRCLED+r"]",raw_key):
            keys = numbered_key(raw_key, require)
        else:
            keys = [k.strip().rstrip("。") for k in raw_key.split("、")]
        require(len(keys)==len(slots)==item["ANS_NUM"] and all(
            re.fullmatch(r"[\u3400-\u9fff]{1,20}",key) for key in keys), "teacher_text_blank_key")
        index = iter(range(1,len(slots)+1))
        prompt = intro+"\n"+re.sub(BLANK,lambda _:f"〔{next(index)}〕",body)
        fields = [{"id":f"f{i}","input":"text","label":f"第 {i} 格"} for i in range(1,len(keys)+1)]
        field_targets = {field["id"]:[key] for field,key in zip(fields,keys)}
        selected_text = keys
        kind = "text_blanks"
    require(prompt.strip() and all(f["label"] for f in fields), "empty_native_prompt")
    return kind, prompt, fields, field_targets, "／".join(selected_text)


def main():
    cli=argparse.ArgumentParser(description=__doc__)
    for name in ("native-rules","textbook-rules","metadata","originals","source-screen","book","output"):
        cli.add_argument("--"+name, type=Path, required=True)
    args=cli.parse_args()
    native=module(args.native_rules)
    textbook=module(args.textbook_rules)
    read=lambda p:json.loads(p.read_text(encoding="utf8"))
    md=read(args.metadata)
    screened={r["source"]:r for r in read(args.source_screen)
              if r.get("type_code") in ("21","22","23","39","44","45")}
    by_code={r["QUES_NO"]:r for r in md["QuesMaster"] if r["QUES_NO"] in screened}
    keys, details=defaultdict(list),defaultdict(list)
    for row in md["QuesAnswer"]:
        if row["QUES_NO"] in screened:
            keys[row["QUES_NO"]].append(row["QUES_ANSW"])
    for row in md["QuesDetail"]:
        if row["QUES_NO"] in screened:
            details[row["QUES_NO"]].append(row["QUES_DETL"])
    docs={p.stem:p for p in args.originals.rglob("*.docx") if p.stem in screened}
    assert set(docs)==set(screened)==set(by_code)
    result=[]
    for sid, screen in screened.items():
        item=by_code[sid]
        source=docs[sid]
        require=native.require
        try:
            require(native.sha(source)==screen["source_sha256"],"original_sha")
            word,key,explanation=read_original(source,args.output.parent,native)
            original_key=key.removeprefix("《答案》").strip()
            require(len(keys[sid])==len(details[sid])==1 and
                    native.compact(original_key)==native.compact(keys[sid][0]),"teacher_key_mismatch")
            require(native.compact(word+key+explanation)==native.compact(details[sid][0]),"publisher_detail_mismatch")
            kind,prompt,fields,targets,text=adapt(item,word,original_key,native.compact(original_key),native)
            result.append({"passed":True,"source":sid,"source_file":str(source),"source_sha256":screen["source_sha256"],
                           "lesson":item["LESN_NUM"],"unit":int(item["LESN_NUM"][:2]),"knowledge":item["KNOW_SPOT"],
                           "difficulty":dict(A=-3,B=0,C=3)[item["DIFC_CODE"]],"layout":kind,"prompt":prompt,
                           "options":[text+" "+" ".join(f["label"] for f in fields)],"answer":1,
                           "explanation":explanation.removeprefix("詳解：").strip(),"fields":fields,"field_answer":targets})
        except (ValueError, KeyError) as exc:
            result.append({**screen,"reason":str(exc)})
    mapped=list(textbook.apply(result,read(args.book)))
    args.output.write_text(json.dumps(mapped,ensure_ascii=False,indent=2),encoding="utf8")
    print(Counter(row.get("reason",row.get("layout")) for row in mapped))


if __name__=="__main__":
    main()
