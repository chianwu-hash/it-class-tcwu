import {AUDIO_RATE,MAX_SECONDS,pcmWav,validateWav} from './media-contract.mjs';
export async function normalizeVoice(blob){
 if(!blob?.size||blob.size>12*1024*1024)throw Error('錄音內容太大或尚未完成。');
 const Decoder=globalThis.AudioContext||globalThis.webkitAudioContext;if(!Decoder||!globalThis.OfflineAudioContext)throw Error('這台裝置目前無法處理錄音，可以改用畫圖。');
 const decoder=new Decoder();let decoded;
 try{decoded=await decoder.decodeAudioData(await blob.arrayBuffer());}finally{await decoder.close();}
 if(!Number.isFinite(decoded.duration)||decoded.duration<.8)throw Error('錄音太短，請再說一次。');
 const count=Math.min(MAX_SECONDS*AUDIO_RATE,Math.floor(decoded.duration*AUDIO_RATE)),offline=new OfflineAudioContext(1,count,AUDIO_RATE),source=offline.createBufferSource();source.buffer=decoded;source.connect(offline.destination);source.start();
 const rendered=await offline.startRendering(),bytes=pcmWav(rendered.getChannelData(0)),meta=validateWav(bytes);return {blob:new Blob([bytes],{type:meta.mime}),...meta};
}
// One recorder per draft slot. No storage, microphone request or object URL until explicitly used.
export function createVoiceRecorder({getStream=()=>navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:true},video:false}),Recorder=globalThis.MediaRecorder,normalize=normalizeVoice,onChange=()=>{},maxSeconds=MAX_SECONDS,now=()=>performance.now()}={}){
 let status='idle',draft=null,error='',seq=0,stream=null,recorder=null,parts=[],started=0,timer=null,tick=null,disposed=false,settled=Promise.resolve(),finish=null;
 let meter=null,meterContext=null,level=0;
 const state=()=>({status,draft,error,elapsed:status==='recording'?Math.min(maxSeconds,(now()-started)/1000):0,level});
 const emit=()=>{if(!disposed)onChange(state());};
 function hardware(){clearTimeout(timer);clearInterval(tick);timer=tick=null;for(const t of stream?.getTracks()||[])t.stop();stream=null;meter=null;meterContext?.close().catch(()=>{});meterContext=null;level=0;}
 function idle(){status=draft?'ready':'idle';emit();}
 function fail(e){hardware();error=e?.name==='NotAllowedError'?'麥克風尚未允許，可以再試一次或改用畫圖。':e?.name==='NotFoundError'?'找不到麥克風，可以改用畫圖。':(/[\u3400-\u9fff]/.test(e?.message||'')?e.message:'錄音未完成，請再試一次，或改用畫圖。');idle();finish?.();finish=null;}
 function setupMeter(){try{const C=globalThis.AudioContext||globalThis.webkitAudioContext;if(!C)return;meterContext=new C();const source=meterContext.createMediaStreamSource(stream);meter=meterContext.createAnalyser();meter.fftSize=256;source.connect(meter);meterContext.resume().catch(()=>{});}catch{meter=null;meterContext?.close().catch(()=>{});meterContext=null;}}
 async function start(){
  if(disposed||['requesting','recording','processing'].includes(status))return;
  error='';if(!Recorder){error='這台裝置目前不支援錄音，可以改用畫圖。';idle();return;}
  const token=++seq;status='requesting';emit();
  try{const incoming=await getStream();if(disposed||token!==seq){incoming.getTracks().forEach(t=>t.stop());return;}stream=incoming;
   const mime=['audio/webm;codecs=opus','audio/mp4','audio/webm','audio/ogg;codecs=opus'].find(m=>Recorder.isTypeSupported?.(m));recorder=mime?new Recorder(stream,{mimeType:mime}):new Recorder(stream);parts=[];
   recorder.ondataavailable=e=>{if(token===seq&&e.data?.size)parts.push(e.data);};
   recorder.onerror=e=>{if(token!==seq)return;++seq;fail(e.error||Error('錄音中斷，上一段草稿仍保留。'));};
   recorder.onstop=async()=>{if(token!==seq||disposed)return;hardware();status='processing';emit();const raw=new Blob(parts,{type:recorder.mimeType});parts=[];
    try{const next=await normalize(raw);if(token===seq&&!disposed){draft={...next,clientAttachmentId:crypto.randomUUID()};error='';idle();}}
    catch(e){if(token===seq&&!disposed)fail(e);}finally{if(token===seq){finish?.();finish=null;}}
   };
   settled=new Promise(resolve=>finish=resolve);started=now();recorder.start();status='recording';setupMeter();
   tick=setInterval(()=>{if(meter){const a=new Uint8Array(meter.fftSize);meter.getByteTimeDomainData(a);level=Math.min(1,Math.sqrt(a.reduce((sum,x)=>sum+((x-128)/128)**2,0)/a.length)*5);}emit();},200);timer=setTimeout(stop,maxSeconds*1000);emit();
  }catch(e){if(token===seq&&!disposed)fail(e);}
 }
 function stop(){if(status==='requesting'){++seq;hardware();idle();return Promise.resolve();}if(status!=='recording')return settled;status='processing';try{if(recorder.state!=='inactive')recorder.stop();}catch(e){++seq;fail(e);}hardware();emit();return settled;}
 function cancel(){++seq;try{if(recorder?.state!=='inactive')recorder?.stop();}catch{}parts=[];hardware();finish?.();finish=null;idle();}
 return {start,stop,cancel,get state(){return state();},remove(){cancel();draft=null;error='';idle();},setDraft(value){cancel();draft=value;error='';idle();},dispose(){cancel();disposed=true;draft=null;}};
}
