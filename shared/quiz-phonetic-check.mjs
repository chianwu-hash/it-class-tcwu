import {moeReadings} from './quiz-moe-readings.mjs';

// Fixed MOE 20260929 data, not a live AI judgment. Only assess the phonetic
// field; neither the student's word nor the whole open response is graded.
// 小字典: https://language.moe.gov.tw/001/Upload/Files/site_content/M0001/respub/dict_mini_download.html
// 簡編本: https://language.moe.gov.tw/001/Upload/Files/site_content/M0001/respub/dict_concised_download.html
// 重編本: https://language.moe.gov.tw/001/Upload/Files/site_content/M0001/respub/dict_reviseddict_download.html
export function normalizePhonetic(value){
 if(typeof value!=='string')return null;
 let s=value.trim().replace(/[\s\u3000]/gu,'');
 if(!/^(?:˙[ㄅ-ㄩ]{1,3}|[ㄅ-ㄩ]{1,3}[ˉˊˇˋ˙]?)$/u.test(s))return null;
 if(s.startsWith('˙'))s=s.slice(1)+'˙';
 return s.replace(/ˉ$/u,'');
}
const result=(status,label,detail,readings=[])=>({status,label,detail,readings});
export function checkPhonetic(character,entry,{data=moeReadings,splitReading=false}={}){
 if(!entry.student)return null;
 const raw=entry.student.phonetic,reading=normalizePhonetic(raw);
 if(!raw.trim())return result('pending','尚未填注音','請先填寫本字的一個讀音。');
 if(!reading)return result('incorrect','注音格式需修正','請填一個完整音節及聲調；不要在注音格填國字、標點或多個讀音。');
 const row=data.characters[character];
 if(!row)return result('pending','注音待核對','本字尚未納入已核定字音資料，不依原例答直接判錯。');
 const modern=[...new Set([...row.mini,...row.concised].map(normalizePhonetic).filter(Boolean))];
 const all=[...new Set([...modern,...row.revised.map(normalizePhonetic).filter(Boolean)])];
 if(!modern.length)return result('pending','注音待核對','缺少國小教學字音資料，請核對原題及字典。');
 if(!all.includes(reading))return result('incorrect','注音不符','教育部三部字辭典的本字音讀均未列此音；請核對聲母、韻母與聲調。',modern);
 if(!modern.includes(reading))return result('pending','此讀音待核對','此音見於《重編》，但不在《小字典》及《簡編本》的本字常用讀音中，須依詞義與原題核對。',modern);
 const dictionary=data.words[character]??{};
 const context=word=>dictionary[word]?.map(normalizePhonetic).filter(Boolean);
 // Source-supplied words establish the context of this particular row.
 for(const given of entry.given){
  const sounds=context(given);
  if(!sounds?.length)return result('pending','原題詞音待核對','本字有此讀音，但原題提供的詞尚無完整詞音資料，先保留待核對。',modern);
  if(!sounds.includes(reading))return result('incorrect','與本組詞音不符','此音是本字的讀音，但不符合原題提供的「'+given+'」；請連同詞語核對。',sounds);
 }
 const word=(entry.student.word??'').trim();
 if(word){
  const sounds=context(word);
  if(sounds?.length&&!sounds.includes(reading))return result('incorrect','與造詞讀音不符','「'+word+'」中本字的注音與你填的不同；不是只看本字有沒有這個音。',sounds);
  if(sounds?.includes(reading)){
   if(splitReading&&!entry.readings.map(normalizePhonetic).includes(reading))return result('pending','本組讀音待核對','此字音與造詞相符，但和本組原參考不同；請對照原題分組要求。',modern);
   return result('correct','注音與造詞讀音相符','已依《簡編本》詞音核對；整組造詞是否合乎題意仍依原題自評。',sounds);
  }
 }
 if(modern.length===1&&!splitReading)return result('correct','注音符合本字讀音','本字的常用讀音相符；造詞的意思與用法仍需另外核對。',modern);
 if(!entry.wordField&&entry.given.length)return result('correct','注音與原題詞音相符','已依原題提供的詞語核對讀音。',modern);
 return result('pending','多音字詞音待核對','本字有此讀音，但這個造詞尚無已核定詞音；不因字典未收詞就判錯。',modern);
}
