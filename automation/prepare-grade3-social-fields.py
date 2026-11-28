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


def read_original_cells(file, output, native):
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
        return [parser.nodes(cell) for cell in body_row.findall("w:tc", native.ns)]
    finally:
        parser.z.close()


def read_original(file, output, native):
    prompt, key, solution = read_original_cells(file, output, native)
    require = native.require
    require(all(native.plain(c) for c in (prompt, key, solution)), "original_media_or_table")
    require(key["text"].startswith("《答案》"), "teacher_key_header")
    return prompt["text"], key["text"], solution["text"]


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


def adapt_text_matching_rows(word, teacher_key, native):
    """Preserve source answer areas when the teacher key groups printed marks."""
    require = native.require
    lines = [line.strip() for line in word.splitlines() if line.strip()]
    require(len(lines)>=4, "word_matching_layout")
    word_bank = r"([甲乙丙丁戊己庚辛])[、.．]\s*(.+)"
    numbered_bank = r"([" + CIRCLED + r"])\s*(.+)"
    key = re.sub(r"\s+","",teacher_key)
    groups = list(re.finditer(r"([甲乙丙丁戊己庚辛])[:：]([^;；]+)(?:[;；]|$)",key))
    if groups:
        require("".join(m[0] for m in groups)==key,"teacher_matching_symbols")
        start = next((i for i,line in enumerate(lines) if re.fullmatch(word_bank,line)),len(lines))
        choices = [re.fullmatch(numbered_bank,line) for line in lines[1:start]]
        fields = [re.fullmatch(word_bank,line) for line in lines[start:]]
        require(len(choices)>=2 and len(groups)==len(fields) and all(choices) and all(fields)
                and "".join(m[1] for m in choices)==CIRCLED[:len(choices)]
                and [m[1] for m in fields]==[m[1] for m in groups]
                and all(re.search(BLANK,m[2]) for m in fields),"word_matching_layout")
        labels = [re.sub(BLANK,"",m[2]).rstrip("：: ") for m in fields]
        selected = [m[2].split("、") for m in groups]
        counted = [code for field in selected for code in field]
        require(len(counted)==len(choices) and set(counted)=={m[1] for m in choices},"teacher_matching_symbols")
        return matching_rows_question(lines[0],choices,labels,selected,require)

    # Normalize separators and split two complete rows whenever Word combines them in one paragraph.
    key = re.sub(r"[ˉ;；](?=["+CIRCLED+"])", "", key)
    checks = numbered_key(key,require)
    per_row = [i for i,line in enumerate(lines) if re.match(r"^(?:"+BLANK+r"\s*)?["+CIRCLED+"]",line)]
    if len(per_row)==len(checks) and per_row[0]==1:
        ends = per_row[1:]+[len(lines)]
        pairs = []
        for i,(start,stop) in enumerate(zip(per_row,ends,strict=True)):
            match = re.fullmatch(r"(?:"+BLANK+r"\s*)?(["+CIRCLED+r"])\s*(.+)",lines[start])
            bank = [re.fullmatch(word_bank,v) for v in lines[start+1:stop]]
            require(match and match[1]==CIRCLED[i] and len(bank)>=2 and all(bank),"word_matching_layout")
            pairs.append((match[2],bank,[checks[i]]))
        return matching_rows_question(lines[0],None,[p[0] for p in pairs],[p[2] for p in pairs],require,[p[1] for p in pairs])

    normalized = "\n".join(re.sub(r"(?<=[）)])(?=["+CIRCLED+r"])", "\n", line)
                           if sum(mark in line for mark in CIRCLED)>1 else line for line in word.splitlines())
    shape,prompt,fields,answers,_ = adapt({"QUES_TYPE":"23"},normalized,key,native.compact(key),native)
    require(shape=="match_columns","word_matching_layout")
    return {"type":"fields","prompt":{"text":prompt,"media":[]},"fields":fields,
            "answer":{"format":"fields-v1","fields":answers}}


def matching_rows_question(prompt, bank, labels, selected, require, separate=None):
    fields,answers = [],{}
    for i,(label,selection) in enumerate(zip(labels,selected,strict=True),1):
        choices = separate[i-1] if separate is not None else bank
        codes = [m[1] for m in choices]
        require(len(codes)==len(set(codes)) and selection and len(selection)==len(set(selection))
                and all(v in codes for v in selection),"teacher_matching_symbols")
        name = f"f{i}"
        ids = [f"o{codes.index(v)+1}" for v in selection]
        multiple = len(ids)>1
        fields.append({"id":name,"input":"set" if multiple else "single","label":label,
                       "options":options([f"{m[1]} {m[2]}" for m in choices])})
        answers[name] = [ids] if multiple else ids
    return {"type":"fields","prompt":{"text":prompt,"media":[]},"fields":fields,
            "answer":{"format":"fields-v1","fields":answers}}


def adapt_text_checklists(word, teacher_key, native, symbol_labels=None):
    require = native.require
    lines = [line.strip() for line in word.splitlines() if line.strip()]
    key = re.sub(r"\s+","",teacher_key)
    require(len(lines)>=3,"word_checklist_layout")
    box = r"[□☐]?\s*"
    choice_pattern = box+r"(["+CIRCLED+r"])\s*(.+)"
    key_marks = key.removesuffix("打ˇ").split("、")
    if key.endswith("打ˇ") and all(v and (v in CIRCLED or v.isdecimal()) for v in key_marks):
        lead, labels = numbered(word,choice_pattern,require)
        positions = [CIRCLED.index(k)+1 if k in CIRCLED else int(k) for k in key_marks]
        require("打ˇ" in "".join(lead) and positions==sorted(set(positions))
                and 2<=len(labels)<=len(CIRCLED) and 1<=min(positions)<=max(positions)<=len(labels),
                "teacher_checkbox_key")
        fields,answers = [],{}
        bounds = [(0,len(labels))] if len(labels)<=8 else [(0,5),(5,len(labels))]
        for offset,end in bounds:
            name = f"f{len(fields)+1}"
            labels_in_range = [f"{CIRCLED[i]} {labels[i]}" for i in range(offset,end)]
            title = "勾選符合的項目" if len(bounds)==1 else f"{CIRCLED[offset]} 至 {CIRCLED[end-1]}"
            fields.append({"id":name,"input":"set","label":title,"options":options(labels_in_range)})
            answers[name] = [[f"o{i-offset}" for i in positions if offset<i<=end]]
        return {"type":"fields","prompt":{"text":"\n".join(lead),"media":[]},"fields":fields,
                "answer":{"format":"fields-v1","fields":answers}}

    if symbol_labels:
        lead,labels = numbered(word,BLANK+r"\s*(["+CIRCLED+r"])\s*(.+)",require)
        keys = numbered_key(key,require)
        symbols = list(symbol_labels)
        require(len(symbols)==2 and all(v in "".join(lead) for v in symbols)
                and len(keys)==len(labels) and set(keys)<=set(symbols),"teacher_symbol_columns")
        fields = [{"id":f"f{i}","input":"single","label":label,
                   "options":options([symbol_labels[s] for s in symbols])} for i,label in enumerate(labels,1)]
        answers = {field["id"]:[f"o{symbols.index(mark)+1}"] for field,mark in zip(fields,keys,strict=True)}
        return {"type":"fields","prompt":{"text":"\n".join(lead),"media":[]},"fields":fields,
                "answer":{"format":"fields-v1","fields":answers}}

    if re.search(r"[甲乙丙丁][、.．]",word) and re.fullmatch(r"(?:["+CIRCLED+r"][甲乙丙丁])+",key):
        return adapt_text_matching_rows(word,teacher_key,native)

    row_pattern = re.compile(r"(?:(["+CIRCLED+r"])\s*|([1-8１-８])[.．]\s*)(.+)")
    choices_letter = box+r"([甲乙丙丁戊己])[、.．]\s*(.+)"
    calls = [(index,m) for index,line in enumerate(lines[1:],1) if (m:=row_pattern.fullmatch(line))]
    groups = list(re.finditer(r"(?:(["+CIRCLED+r"])|([1-8１-８])[.．])([甲乙丙丁戊己"+CIRCLED+r"])打ˇ",key))
    indexes = [CIRCLED.index(m[1])+1 if m[1] else int(m[2]) for m in groups]
    require(groups and "".join(m[0] for m in groups)==key and len(calls)==len(groups)
            and indexes==list(range(1,len(groups)+1)) and calls[0][0]==1,"teacher_group_selection")
    ends = [i for i,_ in calls[1:]]+[len(lines)]
    parts = []
    for i,((idx,match),end,mark) in enumerate(zip(calls,ends,groups,strict=True),1):
        printed_number = CIRCLED.index(match[1])+1 if match[1] else int(match[2])
        require(printed_number==i,"word_choice_alignment")
        pattern = choices_letter if mark[3] not in CIRCLED else choice_pattern
        bank = [re.fullmatch(pattern,v) for v in lines[idx+1:end]]
        require(2<=len(bank)<=8 and all(bank),"word_choice_alignment")
        parts.append((match[3],bank,[mark[3]]))
    return matching_rows_question(lines[0],None,[p[0] for p in parts],[p[2] for p in parts],require,[p[1] for p in parts])


def adapt_reviewed_plain_social(prompt, teacher, item, review, native):
    require = native.require
    require(native.plain(prompt),"original_text_only")
    word = prompt["text"]
    code = item["QUES_TYPE"]
    if code=="39":
        slots = list(re.finditer(BLANK,word))
        lead, separator, tail = word.partition("\n")
        if separator and re.search(BLANK,lead) and "填入" in lead:
            word = tail
            slots = list(re.finditer(BLANK,word))
        raw = teacher.rstrip("。").strip()
        flexible = raw.endswith("（答案可不照順序）")
        if flexible:
            raw = raw.removesuffix("（答案可不照順序）").rstrip("。")
        keys = [v.strip() for v in raw.split("、")]
        require(len(slots)==len(keys)>0 and len(keys)<=8
                and all(re.fullmatch(r"[\u3400-\u9fff]{1,20}",k) for k in keys),"teacher_text_blank_key")
        answers,fields = {},[]
        for i,value in enumerate(keys,1):
            name = f"f{i}"
            fields.append({"id":name,"input":"text","label":f"第 {i} 格"})
            answers[name] = [value]
        if flexible:
            from itertools import permutations
            require(len(keys)<=3 and len(set(keys))==len(keys),"teacher_text_blank_key")
            names = list(answers)
            for name in names:
                answers[name] = list(keys)
            variants = [dict(zip(names,values,strict=True)) for values in permutations(keys)]
        rendered = iter(range(1,len(keys)+1))
        text = re.sub(BLANK,lambda _:f"〔{next(rendered)}〕",word)
        answer = {"format":"fields-v1","fields":answers}
        if flexible:
            answer["tuples"]=[{"fields":names,"accepted":variants}]
        return {"type":"fields","prompt":{"text":text,"media":[]},"fields":fields,"answer":answer}

    if code=="37":
        require(teacher in native.SYMBOLS,"teacher_boolean_symbols")
        labels,selected = ["○","╳"],"o1" if native.SYMBOLS[teacher] else "o2"
    else:
        chunks = re.split(f"([{CIRCLED}])",word)
        word = chunks[0].strip()
        markers,labels = chunks[1::2],[s.strip() for s in chunks[2::2]]
        require("".join(markers)==CIRCLED[:len(labels)] and 2<=len(labels)<=8 and all(labels),"word_choice_alignment")
        index = int(native.compact(teacher))-1
        require(0<=index<len(labels),"teacher_choice_key")
        duplicate = review.get("duplicate_distractor")
        if duplicate:
            keep,drop = duplicate
            require(0<=keep<drop<len(labels) and index not in (keep,drop)
                    and native.compact(labels[keep])==native.compact(labels[drop]),"word_duplicate_choice")
            del labels[drop]
            index -= int(drop<index)
        require(len({native.compact(v).rstrip("。") for v in labels})==len(labels),"word_duplicate_choice")
        selected = f"o{index+1}"
    return {"type":"single","prompt":{"text":word.strip(),"media":[]},"options":options(labels),
            "answer":{"option_id":selected}}


def adapt_reviewed_social_media(prompt, teacher, review, native):
    require = native.require
    from quiz_native_docx import compact
    mode = review["media_mode"]
    if mode=="ordered_images":
        images = [r for b in prompt["layout"] for r in b["runs"] if r["type"]=="image"]
        nonempty = [line.strip() for line in prompt["text"].splitlines() if line.strip()]
        choices = review["image_labels"]
        labels = list(CIRCLED[:len(choices)])
        keys = [token.strip() for token in teacher.split("→")]
        require(len(nonempty)==2 and re.fullmatch(r"答[：:]\s*"+BLANK+r"(?:\s*→\s*"+BLANK+")*",nonempty[1])
                and len({r["media_index"] for r in images})==len(images)==len(choices)==len(keys)
                and list(sorted(keys))==labels,"teacher_sequence_key")
        require([Path(prompt["media"][r["media_index"]]["url"]).stem for r in images]==review["image_hashes"],
                "original_media_sha")
        show = [{"type":"paragraph","runs":[{"type":"text","text":review["instruction"]}]}]
        for code,label,img in zip(labels,choices,images,strict=True):
            show.append({"type":"paragraph","runs":[{"type":"text","text":f"圖 {code} {label}"},img]})
        field = {"id":"sequence","input":"sequence","label":"依流程排列","options":options([f"圖 {c} {v}" for c,v in zip(labels,choices,strict=True)])}
        return {"type":"fields","prompt":compact(show,prompt["media"]),"fields":[field],
                "answer":{"format":"fields-v1","fields":{"sequence":[[f"o{labels.index(v)+1}" for v in keys]]}}}

    first = prompt["text"].splitlines()[0]
    if mode=="image_fill_fields":
        texts = [line.strip() for line in prompt["text"].splitlines() if line.strip()][1:]
        keys = numbered_key(re.sub(r"\s+","",teacher),require)
        require(len(keys)==len(texts)==3 and len(prompt["media"])==3
                and all(line.startswith(code) and len(re.findall(BLANK,line))==1 for code,line in zip(CIRCLED,texts)),
                "word_picture_blank")
        fields,answers = [],{}
        for i,v in enumerate(keys,1):
            name=f"f{i}"
            fields.append({"id":name,"input":"text","label":f"第 {i} 格"})
            answers[name]=[v]
        return {"type":"fields","prompt":prompt,"fields":fields,"answer":{"format":"fields-v1","fields":answers}}

    require(mode=="parallel_image_choices" and len(prompt["media"])==1,"word_image_position")
    # This source placed the next numbered subquestion on the last option line.
    word = re.sub(r"(?<=[。！？])(?=["+CIRCLED+r"])", "\n", prompt["text"])
    q = adapt_text_checklists(word,teacher,native)
    img = [r for b in prompt["layout"] for r in b["runs"] if r["type"]=="image"]
    require(len(img)==1 and q["prompt"]["text"]==first.strip(),"word_image_position")
    q["prompt"] = compact([{"type":"paragraph","runs":[{"type":"text","text":first},img[0]]}],prompt["media"])
    return q


def adapt_illustrated_selection(prompt, teacher_key, native):
    """Reconstruct a single Word question with an ordered choice list and its illustrations."""
    require = native.require
    lead, choices, labels, caption_positions = [], [], [], []
    marker = r"(?:" + BLANK + r"\s*)?([①②③④⑤⑥⑦⑧甲乙丙丁戊己庚辛])(?:[、.．])?\s*(.+)"
    blank_answer = r"答[：:]\s*" + BLANK
    found_answer_area = False
    option_images = False
    for block in prompt["layout"]:
        require(block["type"]=="paragraph", "word_selection_layout")
        for run in block["runs"]:
            if run["type"]=="image":
                require(not found_answer_area, "word_answer_area")
                lead.append({"type":"paragraph","runs":[run]})
                option_images |= bool(choices)
                continue
            require(run["type"]=="text", "word_selection_layout")
            for line in run["text"].splitlines():
                line = line.strip()
                if not line:
                    continue
                require(not found_answer_area, "word_answer_area")
                if re.fullmatch(blank_answer,line):
                    found_answer_area = True
                    continue
                match = re.fullmatch(marker,line)
                if match:
                    labels.append(match[1])
                    choices.append(match[2])
                    caption_positions.append(len(lead))
                else:
                    require(not choices, "unmatched_word_line")
                retain = line if not match else f"{match[1]} {match[2]}"
                lead.append({"type":"paragraph","runs":[{"type":"text","text":retain}]})
    require(2<=len(choices)<=8 and len(set(map(native.compact,choices)))==len(choices)
            and "".join(labels) in (CIRCLED[:len(choices)],"甲乙丙丁戊己庚辛"[:len(choices)]), "word_choice_alignment")
    keys = re.split(r"[、,，]",teacher_key.strip().removesuffix("打ˇ"))
    keys = [k.strip().rstrip("。") for k in keys]
    if all(key.isdecimal() for key in keys):
        require(all(1<=int(key)<=len(choices) for key in keys),"teacher_choice_key")
        keys = [labels[int(key)-1] for key in keys]
    require(keys and keys==[label for label in labels if label in keys],"teacher_choice_key")
    selected = [f"o{labels.index(key)+1}" for key in keys]
    from quiz_native_docx import compact
    content = compact(lead if option_images else [b for i,b in enumerate(lead) if i not in caption_positions],prompt["media"])
    media = content["media"]
    require(media and len(media)==len(prompt["media"]), "word_image_position")
    # Production signs all prompt images; answer choices under a set field are text.
    opts = options([f"{label} {choice}" for label,choice in zip(labels,choices,strict=True)])
    if len(selected)==1:
        return {"type":"single","prompt":content,"options":opts,"answer":{"option_id":selected[0]}}
    return {"type":"fields","prompt":content,
            "fields":[{"id":"selected","input":"set","label":"勾選符合題意的項目","options":opts}],
            "answer":{"format":"fields-v1","fields":{"selected":[selected]}}}


def adapt_illustrated_matching(prompt, teacher_key, review, native):
    require = native.require
    media = prompt["media"]
    require(len(media)==1 and len(prompt["layout"])==1 and
            [r["type"] for r in prompt["layout"][0]["runs"]]==["text","image"], "word_matching_layout")
    require(Path(media[0]["url"]).stem==review["image_sha256"], "original_media_sha")
    left,right = review["numbered_lines"],review["letter_lines"]
    require(2<=len(left)<=8 and 2<=len(right)<=8 and all(v.strip() for v in [*left,*right])
            and len(left)==len(set(map(native.compact,left)))
            and len(right)==len(set(map(native.compact,right))), "word_matching_layout")
    numbers = CIRCLED[:len(left)]
    letters = "甲乙丙丁戊己庚辛"[:len(right)]
    key = re.sub(r"\s+","",teacher_key)
    if key.startswith(numbers[0]):
        pairs = re.findall(f"([{numbers}])([{letters}])",key)
        require("".join(a+b for a,b in pairs)==key and "".join(a for a,b in pairs)==numbers,
                "teacher_matching_symbols")
        answer = dict(pairs)
    else:
        matches = list(re.finditer(f"([{letters}])[:：]([{numbers}](?:[、,，][{numbers}])*)",key))
        require("".join(m[0] for m in matches)==key and "".join(m[1] for m in matches)==letters,
                "teacher_matching_symbols")
        groups = [m.groups() for m in matches]
        pairs = [(number,letter) for letter,codes in groups for number in re.split(r"[、,，]",codes)]
        require(len(pairs)==len(numbers) and {n for n,_ in pairs}==set(numbers),"teacher_matching_symbols")
        answer = dict(pairs)
    fields, keys = [], {}
    variants = options([f"{letter} {caption}" for letter,caption in zip(letters,right,strict=True)])
    for i,(number,caption) in enumerate(zip(numbers,left,strict=True),1):
        name=f"pair{i}"
        fields.append({"id":name,"input":"single","label":f"{number} {caption}","options":variants})
        keys[name] = [f"o{letters.index(answer[number])+1}"]
    heading = prompt["layout"][0]["runs"][0]["text"].strip()
    require(heading==review["original_instruction"] and review["instruction"].strip(),"original_prompt_mismatch")
    from quiz_native_docx import compact
    lead = {"type":"paragraph","runs":[{"type":"text","text":review["instruction"]},prompt["layout"][0]["runs"][1]]}
    return {"type":"fields","prompt":compact([lead],media),"fields":fields,
            "answer":{"format":"fields-v1","fields":keys}}


def reviewed_illustrated_row(source, screen, item, metadata_keys, metadata_details, book, reviews, output, native):
    require = native.require
    sid = screen["source"]
    review = reviews[sid]
    require(screen.get("type_code",item["QUES_TYPE"])==item["QUES_TYPE"],"publisher_question_type")
    require(native.sha(source)==screen["source_sha256"]==review["word_sha256"], "original_sha")
    target_path = output/sid
    target_path.mkdir(parents=True, exist_ok=True)
    prompt, key, solution = read_original_cells(source,target_path,native)
    require(native.plain(key) and native.plain(solution) and key["text"].startswith("《答案》"), "teacher_key_header")
    teacher = key["text"].removeprefix("《答案》").strip()
    require(len(metadata_keys)==len(metadata_details)==1 and native.compact(teacher)==native.compact(metadata_keys[0])
            and native.compact(prompt["text"]+key["text"]+solution["text"])==native.compact(metadata_details[0]), "publisher_detail_mismatch")
    require(review["source_answer"]==teacher and review["student_explanation"].strip(), "reviewed_teacher_key")
    pages = review["pages"]
    require(pages and len({p["page"] for p in pages})==len(pages),"original_textbook_missing")
    for reference in pages:
        matches = [(row, page) for row in book for page in row["pages"] if page["page"]==reference["page"]]
        require(len(matches)==1,"original_textbook_missing")
        spread,p = matches[0]
        require(spread["unit"]==int(item["LESN_NUM"][:2])
                and native.sha(Path(spread["path"]))==spread["sha256"]==reference["spread_sha256"]
                and native.compact(reference["anchor"])
                and native.compact(reference["anchor"]) in native.compact(p["text"]), "original_textbook_mismatch")
    layout = {"23":"text_matching_rows","40":"illustrated_matching","41":"illustrated_selection","44":"text_checklist","45":"text_checklist","37":"reviewed_plain","38":"reviewed_plain","39":"reviewed_plain"}[item["QUES_TYPE"]]
    if layout=="illustrated_matching":
        question = adapt_illustrated_matching(prompt,teacher,review,native)
    elif layout=="text_matching_rows":
        require(native.plain(prompt),"original_text_only")
        question = adapt_text_matching_rows(prompt["text"],teacher,native)
    elif layout=="text_checklist":
        require(native.plain(prompt),"original_text_only")
        question = adapt_text_checklists(prompt["text"],teacher,native,review.get("symbol_labels"))
    elif layout=="reviewed_plain":
        question = adapt_reviewed_plain_social(prompt,teacher,item,review,native)
    elif review.get("media_mode"):
        question = adapt_reviewed_social_media(prompt,teacher,review,native)
        layout = review["media_mode"]
    else:
        question = adapt_illustrated_selection(prompt,teacher,native)
    assets = {}
    for img in question["prompt"]["media"]:
        name = img["url"].rsplit("/",1)[-1]
        original = target_path/"original-images"/name
        display = target_path/"web-images"/name
        require(name.endswith(".jpeg") and native.sha(original)==native.sha(display)==Path(name).stem,"original_media_sha")
        h = Path(name).stem
        assets[img["url"]] = {"sha256":h,"mime":"image/jpeg","bytes":display.stat().st_size,
                             "path":display.as_posix(),"original_file":original.as_posix(),"original_sha256":h}
    question["explanation"]={"text":review["student_explanation"],"media":[]}
    return {"passed":True,"source":sid,"source_file":source.as_posix(),"source_sha256":screen["source_sha256"],
            "lesson":item["LESN_NUM"],"unit":int(item["LESN_NUM"][:2]),"knowledge":item["KNOW_SPOT"],
            "difficulty":dict(A=-3,B=0,C=3)[item["DIFC_CODE"]],"layout":layout,"question":question,
            "references":[p["page"] for p in pages],"source_answer":teacher,"assets":assets}


def main():
    cli=argparse.ArgumentParser(description=__doc__)
    for name in ("native-rules","textbook-rules","metadata","originals","source-screen","book","output"):
        cli.add_argument("--"+name, type=Path, required=True)
    cli.add_argument("--illustrated-selection-reviews", type=Path)
    args=cli.parse_args()
    native=module(args.native_rules)
    textbook=module(args.textbook_rules)
    read=lambda p:json.loads(p.read_text(encoding="utf8"))
    md=read(args.metadata)
    if args.illustrated_selection_reviews:
        reviews = read(args.illustrated_selection_reviews)
        screened = {r["source"]:r for r in read(args.source_screen) if r["source"] in reviews}
        assert screened.keys()==reviews.keys()
        book = read(args.book)
    else:
        screened = {r["source"]:r for r in read(args.source_screen) if r.get("type_code") in ("21","22","23","39","44","45")}
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
            if args.illustrated_selection_reviews:
                result.append(reviewed_illustrated_row(source,screen,item,keys[sid],details[sid],book,reviews,args.output.parent,native))
                continue
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
    mapped=result if args.illustrated_selection_reviews else list(textbook.apply(result,read(args.book)))
    args.output.write_text(json.dumps(mapped,ensure_ascii=False,indent=2),encoding="utf8")
    print(Counter(row.get("reason",row.get("layout")) for row in mapped))


if __name__=="__main__":
    main()
