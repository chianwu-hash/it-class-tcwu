import {sourceStream} from './quiz-content-slices.mjs';
const plain=text=>({text,media:[]});
// Already descriptive field labels need readable type and a persistent source,
// not guessed source deletion. Context keeps tables, diagrams and audio intact.
export function labelledReadingPresentation(q){
 if(q.type!=='fields'||q.fields.length<2||!q.fields.some(f=>['single','set'].includes(f.input)))return null;
 const text=q.prompt?.text||'';
 if(text.length<180&&!/閱讀|文章|下文|Reading|Comprehension|回答下列問題|請看圖/iu.test(text))return null;
 const meaningful=f=>/[:：]/u.test(f.label)&&f.label.split(/[:：]/u).slice(1).join(':').trim().length>=4||/^[0-9０-９]+[^0-9０-９]/u.test(f.label)&&f.label.replace(/^[0-9０-９]+/u,'').trim().length>=8||/^原[0-9０-９]+\s+[^0-9０-９]/u.test(f.label)&&f.label.replace(/^原[0-9０-９]+\s+/u,'').trim().length>=5;
 if(q.fields.every(f=>!['single','set'].includes(f.input)||meaningful(f)))return {passage:q.prompt,questions:q.fields.map(()=>null),fields:q.fields,context:true};
 // A hierarchical source explicitly labels each saved field with parent and
 // circled subitem. Carry that exact parent statement beside its control;
 // retain the entire source (including diagrams) in the reference pane.
 const stream=sourceStream(q.prompt);if(stream===null)return null;
 const marks=[...stream.matchAll(/^[ \t　]*[（(]([0-9０-９]{1,2})[）)]([^\n]+)/gmu)];
 const match=q.fields.map(f=>f.label.replace(/[０-９]/gu,c=>String.fromCharCode(c.charCodeAt(0)-0xfee0)).match(/^第\d+格[｜|]\((\d+)\)([①②③④⑤⑥⑦⑧])$/u));
 if(match.some(m=>!m)||new Set(marks.map(m=>Number(m[1].normalize('NFKC')))).size!==marks.length)return null;
 const questions=match.map(m=>{const parent=marks.find(x=>Number(x[1].normalize('NFKC'))===Number(m[1]));return parent?plain(`第${m[1]}小題，原圖／原題${m[2]}：${parent[2].trim()}`):null;});
 if(questions.some(c=>!c))return null;
 return {passage:q.prompt,questions,fields:q.fields,context:true};
}
