"""從官方已明載的稿件建立聽力改版計畫。只寫本機，不發布。"""
from pathlib import Path
import copy,json,hashlib
ROOT=Path('automation/output/past-exams-audio');ROOT.mkdir(exist_ok=True)
def read(p):return json.loads(Path(p).read_text(encoding='utf-8-sig'))
def write(p,v):Path(p).write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
ids=[f'dingxi-{y}-1-g{g}-exam1-english' for y in [113,114] for g in [3,6]]
VOICE='en-US-JennyNeural';MALE='en-US-GuyNeural';papers=[];tracks=[]
for pid in ids:
 folder=next(Path('automation/output')/x/pid for x in ['past-exams-midterms','past-exams-batch'] if (Path('automation/output')/x/pid/'bundle.private.json').exists())
 b=read(folder/'bundle.private.json');p=ROOT/pid;p.mkdir(exist_ok=True)
 if not (p/'before-bundle.private.json').exists():write(p/'before-bundle.private.json',b)
 assert read(p/'before-bundle.private.json')['sha256']==b['sha256'],'既有本機版本改變，先確認基準'
 write(p/'source-pages.private.json',read(folder/'source-pages.private.json'))
 paper={'paperId':pid,'oldSha256':b['sha256'],'groups':[],'crops':[],'restoreIds':[]};papers.append(paper)
 blocked={f['id']:f for f in b['document']['blocked']};entries={e['id']:e for e in b['provenance']['entries']}
 def crop(cid,box=None,xref=None,alt='原卷聽力題圖',role='choice'):
  c={'id':cid,'source':'paper','page':1,'role':role,'alt':alt}
  if box:c['bbox']=box
  if xref:c['imageXref']=xref
  paper['crops'].append(c);return cid
 def field(qid,answer,text=None):
  f=blocked[qid];paper['restoreIds'].append(qid)
  return {'id':qid,'text':text or f['text'],'label':qid.split('q')[-1],'points':f['points'],'answer':answer,'paperPage':entries[qid]['source']['page'],'keyPage':entries[qid]['answerSource']['page'],'officialRaw':entries[qid]['answerSource']['raw']}
 def track(tid,utterances,page,sourceDescription,repeat=2):
  fullid=pid+'__'+tid
  segments=[{'text':v,'voice':VOICE,'gapAfter':.8} if isinstance(v,str) else {'text':v[1],'voice':v[0],'gapAfter':.8} for v in utterances]
  tracks.append({'id':fullid,'paperId':pid,'source':{'fileId':'key','page':page,'sha256':next(s['sha256'] for s in b['provenance']['sourceFiles'] if s['fileId']=='key'),'description':sourceDescription},'segments':segments,'repeat':repeat,'repeatGap':2,'rate':'-12%','label':'依官方文字稿製作的合成語音練習版；每段播讀兩次，可重播。'})
  return fullid
 def group(gid,title,material,fields,choices=None,assets=None,kind='single',audio=None,codes=None):
  out={'id':gid,'kind':kind,'title':title,'sourceLabel':title,'material':material,'fields':fields,'choices':choices or [],'assets':assets or [],'codes':codes or [],'audioTrack':audio,'notice':'合成語音練習版｜依官方聽力文字製作，每段播讀兩次，可自行重播。'}
  paper['groups'].append(out);return out
 def options(texts):return [{'id':str(i+1),'text':v,'assets':[]} for i,v in enumerate(texts)]
 def pic_options(boxes,prefix):return [{'id':str(i+1),'text':'','assets':[crop(f'{prefix}-opt{i+1}',box,alt=f'原卷選項{i+1}圖')]} for i,box in enumerate(boxes)]
 year=int(pid.split('-')[1]);grade=int(pid.split('-')[3][1:])
 if grade==3:
  pairs=[['bag','bat'],['cat','cake'],['ink','egg'],['get','jet'],['net','name']] if year==113 else [['fish','fan'],['boy','bat'],['lamp','goat'],['ox','ant'],['hat','hot']]
  for i,words in enumerate(pairs,1):
   qid=f'b-q{i:02}' if year==113 else f's2-q{i:02}'
   t=track('B'+str(i),words,1,'B題紅字明列的兩個單字；依序朗讀，不朗讀答案O/X。')
   group(qid,f'B 聽力・字首音 {i}','仔細聽，字首音相同選O，不同選X。',[field(qid,'O' if i in [1,2,5] else 'X','這兩個單字的字首音是否相同？')],[{'id':x,'text':x,'assets':[]} for x in ['O','X']],audio=t)
  if year==113:
   lines=['Line up.','How old are you?','Thank you.','My name is Abu.'];answers=['1','3','2','3']
   boxes=[[[627,142,733,226],[761,142,861,229],[895,145,999,220]],[[627,229,733,322],[761,226,870,322],[876,217,1012,322]],[[627,321,733,412],[748,321,870,412],[890,318,1007,412]],[[625,412,737,513],[738,414,865,513],[887,414,1006,513]]]
   for i,(line,answer) in enumerate(zip(lines,answers),1):
    qid=f'd-q{i:02}';t=track('D'+str(i),[line],1,'D題旁官方紅字列出的朗讀句。')
    choices=pic_options(boxes[i-1],'D'+str(i))
    # 單一內嵌圖直接取原圖，避免裁入相鄰題的文字、框線與圖片。
    native={1:[56,58,60]}
    if i in native:
     for c,xref in zip(paper['crops'][-3:],native[i]):c.pop('bbox');c['imageXref']=xref
    elif i==2:
     # 本題每格由對話框與人物兩張圖組成，保留整格但避開上列底部。
     for c in paper['crops'][-3:-1]:c['bbox'][1]=230
     paper['crops'][-1]['bbox'][1]=224
    group(qid,f'D 聽力・選圖 {i}','仔細聽，選出最符合的圖片。',[field(qid,answer,'請選出與聽到的句子最符合的圖片。')],choices,audio=t)
  else:
   t=track('D-order',['Quiet. please.','Line up, please.','Stand up.','Sit down.'],1,'D題官方紅字句子及1→4順序：右上、左下、左上、右下；不另造句。')
   c=crop('D-grid',[512,141,1002,407],role='stem',alt='原卷四張課堂指令圖，由左上、右上、左下、右下作答')
   group('s4-audio','D 聽力・圖片排序','仔細聽，依照聽到的順序寫下1234。請依左上、右上、左下、右下的位置選擇順序；每個數字使用一次。',[field(f's4-q{i:02}',v,f'{pos}圖片是第幾段？') for i,(pos,v) in enumerate(zip(['左上','右上','左下','右下'],['3','1','2','4']),1)],options(['第1段','第2段','第3段','第4段']),[c],kind='code',audio=t)
 elif year==113:
  words=['burn','herd','noise','dirt','sea'];choices=[['but','bad','burn','boil'],['herd','hide','heal','hope'],['nurse','noise','nose','niece'],['dot','doubt','don’t','dirt'],['soy','say','sir','sea']]
  for i,(word,opts,answer) in enumerate(zip(words,choices,['3','1','2','4','4']),1):
   qid=f's1-q{i:02}';t=track('A'+str(i),[word],5,'A. Listen and Choose 官方錄音內容，移除答案圈號後朗讀。')
   group(qid,f'A 聽力・單字 {i}','仔細聽，選出正確發音的單字。',[field(qid,answer,'請選出聽到的單字。')],options(opts),audio=t)
  lines={1:'I’m from Australia.',2:'Billie is from France.',3:'Anna can make some dumplings.',5:'I’d like a hamburger, please.'}
  boxes={1:[[126,366,189,402],[233,366,291,402],[335,366,398,402]],2:[[112,403,193,444],[225,403,306,444],[335,404,397,444]],3:[[121,443,188,484],[230,443,287,484],[333,443,399,483]],5:[[129,526,177,566],[234,526,282,567],[334,526,397,567]]}
  for i,line in lines.items():
   qid=f's2-q{i:02}';t=track('B'+str(i),[line],5,'B官方錄音內容；第4題dolphin／鯨魚矛盾維持暫停，沒有納入。')
   group(qid,f'B 聽力・選圖 {i}','仔細聽，選出與敘述相符的圖片。',[field(qid,{1:'1',2:'1',3:'2',5:'1'}[i],'請選出與聽到的敘述相符的圖片。')],pic_options(boxes[i],'B'+str(i)),audio=t)
  ab=[['We’d like some pizza and French fries, please.','We’d like some rice and noodles, please.'],['I’m so hungry. I’d like some soup, please.','I’m starving. I’d like some steak, please.'],['Would you like some tacos? Yes, please.','Would you like some noodles? No, thank you.'],['Is she from India? Yes, she is.','Is he from Canada? Yes, he is.'],['He’s from Taiwan. He can make bubble tea.','He’s from Japan. He can make sushi.'],['Are you from Italy? No, I’m not. I’m from Australia.','Are you from Australia? No, I’m not. I’m from Brazil.']]
  boxes=[[430,163,551,233],[556,163,677,233],[683,162,806,233],[430,256,551,325],[556,256,678,325],[682,253,806,325]]
  for i,(sentences,answer) in enumerate(zip(ab,['A','B','B','A','B','A']),1):
   qid=f's3-q{i:02}';t=track('C'+str(i),['A. '+sentences[0],'B. '+sentences[1]],5,'C官方A、B兩句均朗讀；不只讀正確句。')
   c=crop('C'+str(i),boxes[i-1],role='stem',alt=f'原卷C第{i}題情境圖')
   group(qid,f'C 聽力・句子配圖 {i}','仔細聽，填入與圖片相符的句子A或B。',[field(qid,answer,'與圖片相符的是句子A或B？')],[{'id':x,'text':x,'assets':[]} for x in ['A','B']],[c],audio=t)
  countries=[crop('D-C'+str(i),xref=x,alt='原卷國旗代號C'+str(i)) for i,x in enumerate([51,53,55,57],1)]
  foods=[crop('D-F'+str(i),xref=x,alt='原卷食物代號F'+str(i)) for i,x in enumerate([52,54,56,58],1)]
  bank=[{'id':f'C{i+1}','text':'國旗','assets':[v]} for i,v in enumerate(countries)]+[{'id':f'F{i+1}','text':'食物','assets':[v]} for i,v in enumerate(foods)]
  lines=['Kate is from Taiwan. She likes to eat noodles.','Eric is from the USA. He likes to have steak for dinner.','May is from India. Her favorite food is pizza.','Dan is from Japan. He makes sandwiches on Mondays.']
  for i,(name,line,answer) in enumerate(zip(['Kate','Eric','May','Dan'],lines,[['C4','F4'],['C1','F3'],['C2','F2'],['C3','F1']]),1):
   qid=f's4-q{i:02}';t=track('D'+str(i),[line],5,'D官方錄音內容，並逐條核對解答頁紅線；每人整組2分，未擅拆國旗／食物配分。')
   group(qid,f'D 聽力・連線 {i} {name}','仔細聽，將正確的國家及食物連起來。線上請選一個國旗代號與一個食物代號（共2個）。',[field(qid,answer,f'{name}應連到哪面國旗及哪種食物？')],copy.deepcopy(bank),kind='set',audio=t,codes=[v['id'] for v in bank])
 else:
  opts=[['skit','skirt','skate','sky'],['clark','clock','clerk','click'],['corn','cone','cool','coin'],['joy','Jay','juice','joke'],['bun','boil','born','burn']]
  for i,(word,answer,choices) in enumerate(zip(['skirt','clerk','coin','joy','burn'],['2','3','4','1','4'],opts),1):
   qid=f's1-q{i:02}';t=track('A'+str(i),[word],5,'第一大題官方聽力稿的單字，原稿重複兩次，練習版亦兩次。')
   group(qid,f'一 聽力・單字 {i}','請仔細聽，選出正確的發音單字代號。',[field(qid,answer,'請選出聽到的單字。')],options(choices),audio=t)
  dialogues=[['What would you like to eat, Jenny?','I’d like some rice, please. How about you Jim?','I’d like some dumplings, please.'],['Are Kerry and Ruby from Australia?','No, they aren’t. They are from France.'],['Would you like some French fries?','No, thanks. I’d like some steak.'],['Where are you from?','We are from India.'],['I’m from the country that has Big Ben in London, the UK.']]
  boxes=[[[125,346,200,414],[258,348,331,412],[388,353,455,412]],[[128,418,207,481],[255,421,338,482],[380,421,459,482]],[[122,486,200,553],[251,487,328,551],[378,486,454,551]],[[123,560,206,625],[250,559,333,626],[378,558,467,625]],[[122,627,226,694],[253,629,342,696],[355,629,477,696]]]
  for i,(lines,answer) in enumerate(zip(dialogues,['1','3','3','1','2']),1):
   qid=f's2-q{i:02}';t=track('B'+str(i),[(MALE if n%2==0 else VOICE,s) for n,s in enumerate(lines)],5,'第二大題官方逐字對話；不同說話者用不同聲音。')
   group(qid,f'二 聽力・選圖 {i}','請仔細聽句子或對話，選出正確的圖片。',[field(qid,answer,'請選出與聽到的句子或對話相符的圖片。')],pic_options(boxes[i-1],'B'+str(i)),audio=t)
  ab=[['We have moon cakes and pomelos on Moon festival.','We have pizza and bubble tea on Moon Festival.'],['We’d like some sandwiches and steak, please.','We’d like some soup and steak, please.'],['The Sydney Opera House is a famous landmark in Australia.','Taipei 101 is a famous landmark in Taiwan.'],['I can make some french fries.','I can make some pizza.'],['The Eiffel Tower is in Paris, France.','We are from Canada.'],['We watch the full moon and eat moon cakes on my birthday.','We have a barbecue party on my birthday.']]
  boxes=[[519,130,679,199],[695,132,835,198],[905,112,981,198],[578,201,674,284],[751,200,833,284],[905,201,1001,284]]
  for i,(sentences,answer) in enumerate(zip(ab,['A','B','B','A','A','B']),1):
   qid=f's3-q{i:02}';t=track('C'+str(i),['A. '+sentences[0],'B. '+sentences[1]],5,'第三大題官方A、B兩句完整朗讀；Australia前原稿inAustralia排版連字已按單字空格製播。')
   c=crop('C'+str(i),boxes[i-1],role='stem',alt=f'原卷第三大題第{i}題情境圖')
   group(qid,f'三 聽力・句子配圖 {i}','仔細聽，按照圖片寫出正確描述的句子代號A或B。',[field(qid,answer,'與圖片相符的是句子A或B？')],[{'id':x,'text':x,'assets':[]} for x in ['A','B']],[c],audio=t)
  dialogue=['Good morning everyone. We have a new student. Her name is Joy.',"Hi, everyone. My name is Joy. I'm 12 years old. Nice to meet you.",'Joy, are you from the UK?',"No, I'm not.","What's your favorite food?",'I like French fries and noodles.','Do you like English?',"Um... My favorite subject is math.",'What do you like to do after school?','I like cooking and playing baseball.','So Joy, where are you from?',"Hehe, I'm from the country that is famous for curry rice and Taj Mahal."]
  t=track('D-common',[(MALE if i%2==0 else VOICE,s) for i,s in enumerate(dialogue)],5,'第四大題官方完整對話，4小題共用；提問在原卷已印，未把答案或國家名稱另行朗讀。')
  qs=['What food does Joy like to eat?','What’s Joy’s favorite subject?','What does Joy like to do?','Where is Joy from?']
  boxes=[[[620,335,724,403],[751,335,859,403],[888,336,991,404]],[[627,431,710,495],[771,435,837,491],[899,431,973,498]],[[639,534,695,590],[769,530,849,595],[902,531,979,597]],[[631,629,716,689],[763,627,853,689],[895,627,989,688]]]
  for i,(q,answer) in enumerate(zip(qs,['1','2','3','3']),1):
   qid=f's4-q{i:02}';group(qid,f'四 聽力・對話理解 {i}','根據對話內容，選出正確答案。本段4小題共用同一段對話，可依需要重播。',[field(qid,answer,q)],pic_options(boxes[i-1],'D'+str(i)),audio=t)
 assert len(set(paper['restoreIds']))==len(paper['restoreIds'])
 assert all(q in blocked for q in paper['restoreIds'])
write(ROOT/'plan.private.json',{'policy':'2026-10-30使用者核准：有官方聽力稿可自行製播；答案矛盾另確認，先上線無疑義部分。','papers':papers,'tracks':tracks})
print(json.dumps({'papers':len(papers),'tracks':len(tracks),'restoredFields':sum(len(p['restoreIds']) for p in papers),'groups':sum(len(p['groups']) for p in papers),'images':sum(len(p['crops']) for p in papers)}))
