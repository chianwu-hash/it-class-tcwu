"""Verify remaining plain social-study topics against their rendered textbook pages."""
import argparse
from collections import Counter, defaultdict
import json
from pathlib import Path
import re


TOPICS = (
    ("0301", 58, ("同學相處", "關係"), r"重要夥伴|彼此珍惜|(?:同學|別人).{0,11}(?:相處|感情更好|待人處事)|尊重別人|彼此尊重",
     "同學是學校生活中的重要夥伴，可以在相處中練習關心、尊重與合作。"),
    ("0301", 59, ("泰國奶奶", "外表、個性、想法"), r"榴槤|外表|高矮胖瘦|自己.{0,7}差別|強迫|不勉強|替別人著想|班級氣氛.{0,3}融洽",
     "同學有不同的外表、能力、生活背景和喜好，可以尊重差異，接受別人的不同想法。"),
    ("0301", 60, ("關懷與協助", "主動提供適"), r"轉學生|個子比較小|行動不方便|家庭.{0,8}變故|家裡生活發生困難|(?:感冒|心情不好)|困難的學生|課業上有問題|幫助其他人",
     "生活或學習遇到困難時，可先關心同學，再在自己能力範圍內提供協助。"),
    ("0301", 61, ("解決爭端", "想法"), r"和氣.{0,3}態度|虛心接受|說明自己的想法|相同的看法",
     "先冷靜說明自己的想法並聽取別人的意見，有助於解決同學間的問題。"),
    ("0302", 68, ("班級自治", "班級的事務"), r"班上常見.{0,5}自治|學校朝會|討論事情.{0,3}解決問題",
     "班級自治是同學共同管理班級事務，班級會議是討論與解決班級問題的一種方式。"),
    ("0302", 69, ("召開班級會", "班會冬流程"), r"班會.{0,18}(?:出現|舉行|主席|發言|討論)|寫回家功課|表決.{0,8}同學",
     "班會用來討論班級事務。發言前先舉手，別人發言時要專心聆聽。"),
    ("0302", 71, ("共同合作", "當選"), r"班級幹部|班長|體育股長|衛生股長|班上.{0,6}打掃",
     "班級幹部各有分工，也需要全班同學配合，共同完成班級事務。"),
    ("0302", 73, ("少數", "多數人的決定"), r"班會.{0,18}表決.{0,18}(?:不同|尊重)",
     "服從多數人的決定，同時也要尊重少數人的意見。"),
    ("0302", 74, ("宣佈開會", "表決"), r"記錄.{0,8}宣布班會",
     "班會由主席宣布開始。記錄負責記下會議內容與表決結果。"),
    ("0302", 75, ("表決方式", "提案"), r"班會.{0,38}成為大家的決定",
     "班會經提案和討論後，可透過表決形成共同決定。"),
    ("0401", 81, ("分工合作", "效率"), r"搬運|按.{0,5}專長分配|團體.{0,9}不分你我|舊衣回收",
     "分工時可以發揮各自長處，彼此配合完成團體工作。"),
    ("0401", 82, ("相互競爭", "公平性"), r"請教技巧|美勞作品.{0,8}稱讚",
     "競爭帶來互相學習的機會，可以向同學請教，並多加練習。"),
    ("0402", 86, ("性別平等", "公平發展"), r"彼此瞭?了解|不同的興趣和想法|不一樣.{0,10}興趣|喜愛畫畫|縫衣服|學芭蕾舞",
     "每個人有不同的能力與興趣，相處時應互相了解與尊重。"),
    ("0402", 87, ("警察", "廚師"), r"受聘|應徵|聘請員工|飛行員|護理師|髮型師|想當一名偵探",
     "各種職業都可以依自己的興趣和能力選擇，不受性別限制。"),
    ("0402", 88, ("祕密", "擅自翻看"), r"日記|偷看.{0,10}考卷|別人的物品|翻.{0,10}(?:抽屜|書包)|同意.{0,12}借走",
     "未經對方同意，不應擅自翻看、拿取或碰觸他人的物品。"),
    ("0402", 90, ("身體的主人", "觸碰"), r"身體的主人|傷害.{0,8}身體|(?:隨意|隨便).{0,4}觸碰.{0,8}身體",
     "每個人都有保護自己身體的權利。相處時要尊重身體的界線。"),
    ("0402", 91, ("受到侵犯", "求協助"), r"突然.{0,6}摸.{0,9}肩膀|摸.{0,8}身體.{0,16}不舒服|表示.{0,6}不喜歡|背後突然抱起",
     "遇到讓自己不舒服的觸碰，可以明確拒絕、離開並尋求協助。"),
    ("0403", 93, ("志工", "資源"), r"表達謝意|寫卡片謝謝|為我們服務的人|小老師",
     "校園分工中有許多服務他人的角色，可以對提供服務的人表達感謝。"),
    ("0403", 94, ("愛惜公物", "使用者的權利"), r"學習環境.{0,8}維護|生活秩序|電腦教室打電動|我們在學校裡不應該",
     "校園環境需要所有人維護。遵守規範並愛惜設施，可保障大家的學習權利。"),
    ("0403", 95, ("校規和班級公", "熱心關懷同學"), r"團隊精神|學校裡應有的行為",
     "在學校生活要遵守校規、關懷同學並學習與他人合作。"),
)


def normalized(text):
    return re.sub(r"\s+", "", text)


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    for name in ("held","spreads","output"):
        parser.add_argument("--"+name,type=Path,required=True)
    args=parser.parse_args()
    read=lambda p:json.loads(p.read_text(encoding="utf8"))
    book={p["page"]:normalized(p["text"]) for spread in read(args.spreads) for p in spread["pages"]}
    rules=defaultdict(list)
    for topic,page,anchors,pattern,explanation in TOPICS:
        assert all(anchor in book[page] for anchor in anchors), (page,anchors)
        rules[topic].append((page,re.compile(pattern),explanation))
    out=[]
    for row in read(args.held):
        if row.get("reason")!="textbook_topic":
            continue
        material=normalized(row["prompt"]+row["options"][row["answer"]-1]+row["explanation"])
        hits=[(len(hit[0]),page,explanation,hit[0]) for page,pattern,explanation in rules[row["lesson"]]
              if (hit:=pattern.search(material))]
        if hits:
            _,page,reason,match=max(hits,key=lambda h:(h[0],-h[1]))
            row={k:v for k,v in row.items() if k!="reason"}
            out.append({**row,"passed":True,"primary":page,"references":[page],"textbook_reason":reason,
                        "textbook_matches":[{"page":page,"cue":match}]})
        else:
            out.append(row)
    args.output.write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding="utf8")
    print(Counter(r.get("reason",r.get("layout")) for r in out))


if __name__=="__main__":
    main()
