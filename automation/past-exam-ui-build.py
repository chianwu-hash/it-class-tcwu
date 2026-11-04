from pathlib import Path
source=Path('D:/projects/it-class-tcwu/automation/nonchoice-pilot')
js=(source/'app.mjs').read_text(encoding='utf8')
js=js[js.index('const $='):]
start=js.index('async function api(');end=js.index('\nfunction draft',start)
js=js[:start]+"const api=request;\n"+js[end:]
js=js.replace('document.querySelector(s)','root.querySelector(s)')
js=js.replace("const say=t=>{$('#status').textContent=t;};", "const say=t=>{if(active&&$('#status'))$('#status').textContent=t;};")
js=js.replace('function render(){','function render(){if(!active)return;')
js=js.replace("img.src=a.url;img.alt=a.alt;", "img.dataset.quizMediaUrl=a.url;resolveAsset(a.url).then(src=>{if(img.isConnected)img.src=src;}).catch(e=>say(e.message));img.alt=a.alt;")
js=js.replace('link.href=a.url;',"link.href='#';")
js=js.replace("href:g.assets[0].url", "href:''")
js=js.replace("svg.append(image);", "svg.append(image);resolveAsset(g.assets[0].url).then(src=>{if(svg.isConnected)image.setAttribute('href',src);}).catch(e=>say(e.message));")
js=js.replace('\u672c\u6a5f\u6a21\u64ec\u8449\u7247','\u8449\u7247')
js=js.replace('\u76ee\u524d\u50c5\u5728\u672c\u6a5f\u6a21\u64ec\uff0c\u4e0d\u6703\u6539\u8b8a\u6b63\u5f0f\u52aa\u529b\u6a39\u3002','\u53ef\u5230\u52aa\u529b\u6a39\u67e5\u770b\u9019\u6b21\u9054\u6a19\u6210\u679c\u3002')
# Every render tells the server which unsaved group is being read; it is not submitted automatically.
js=js.replace("const g=state.groups[index],saved=state.records[g.id],locked=Boolean(saved)||busy||pending.has(g.id);", "const g=state.groups[index],saved=state.records[g.id],locked=Boolean(saved)||busy||pending.has(g.id);if(!saved)onView(g.id);")
start=js.index("$('#restart').addEventListener")
js=js[:start]+"""let restartRequest=null;
$('#restart').addEventListener('click',async()=>{if(busy)return;busy=true;restartRequest??=crypto.randomUUID();try{state=await api('/api/reset',{requestId:restartRequest});restartRequest=null;drafts.clear();pending.clear();index=0;undo=[];arrowStart=null;say('');}catch(e){say(e.message);}finally{busy=false;render();}});
return {load(next){state=next;index=Math.min(index,state.groups.length-1);render();},clear(){active=false;drafts.clear();pending.clear();state=null;root.replaceChildren();}};
"""
js="import {renderLocalContent} from './quiz-past-content.mjs';\nexport function initPastExamUI({root,request,resolveAsset,onView}){\nlet active=true;\n"+js+"\n}\n"
Path('shared/quiz-past-ui.mjs').write_text(js,encoding='utf8')
content="import {renderContent} from './quiz-render.mjs';\nexport const renderLocalContent=(host,content)=>renderContent(host,content,{imageLoading:'lazy'});\n"
Path('shared/quiz-past-content.mjs').write_text(content,encoding='utf8')
css=(source/'style.css').read_text(encoding='utf8')
Path('shared/quiz-past-exams.css').write_text('@scope (.past-exam-workspace){\n'+css+'\n}\n'+'''
.past-exam-page .past-exam-workspace{margin:0 auto;max-width:1200px;padding:16px;}
.past-exam-page .past-exam-workspace .primary,.past-exam-page .past-exam-workspace .step.active{background:var(--quiz-primary);border-color:var(--quiz-primary);color:white}
.past-exam-page .past-exam-workspace button{font-family:inherit}
.past-exam-page .past-exam-workspace .table-scroll{overflow:auto;max-width:100%}
.past-exam-page .past-exam-workspace table{width:100%;border-collapse:collapse;margin:12px 0}
.past-exam-page .past-exam-workspace th,.past-exam-page .past-exam-workspace td{padding:10px;border:1px solid var(--quiz-border);text-align:left}
.past-exam-page .past-exam-workspace .steps{max-height:170px;overflow:auto}
.past-exam-page .past-exam-workspace .page-header{padding-bottom:12px}
.past-exam-page .past-exam-workspace .choice-row input[type=radio]{width:23px;height:23px;accent-color:var(--quiz-primary)}
.past-exam-page .past-exam-workspace .material-box:empty{display:none}
''',encoding='utf8')
