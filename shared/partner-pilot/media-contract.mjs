// Pure validation for the isolated prototype; future server validation must be independent.
export const AUDIO_RATE=16000, MAX_SECONDS=30, MIN_SECONDS=.8, MAX_WAV_BYTES=960044;
export function pcmWav(samples){
 if(!(samples instanceof Float32Array)||samples.length<MIN_SECONDS*AUDIO_RATE)throw Error('錄音太短，請再說一次。');
 const count=Math.min(samples.length,MAX_SECONDS*AUDIO_RATE),bytes=new ArrayBuffer(44+count*2),v=new DataView(bytes);
 const tag=(i,s)=>[...s].forEach((c,n)=>v.setUint8(i+n,c.charCodeAt(0)));
 tag(0,'RIFF');v.setUint32(4,bytes.byteLength-8,true);tag(8,'WAVE');tag(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,AUDIO_RATE,true);v.setUint32(28,AUDIO_RATE*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);tag(36,'data');v.setUint32(40,count*2,true);
 for(let i=0;i<count;i++){if(!Number.isFinite(samples[i]))throw Error('音訊內容不完整。');const x=Math.max(-1,Math.min(1,samples[i]));v.setInt16(44+i*2,Math.round(x*(x<0?32768:32767)),true);}return bytes;
}
export function validateWav(bytes){
 if(!(bytes instanceof ArrayBuffer)||bytes.byteLength<44||bytes.byteLength>MAX_WAV_BYTES)throw Error('錄音大小不符。');
 const v=new DataView(bytes),tag=(i,s)=>[...s].every((c,n)=>v.getUint8(i+n)===c.charCodeAt(0)),size=v.getUint32(40,true);
 if(!tag(0,'RIFF')||!tag(8,'WAVE')||!tag(12,'fmt ')||!tag(36,'data')||v.getUint32(4,true)!==bytes.byteLength-8||v.getUint32(16,true)!==16||v.getUint16(20,true)!==1||v.getUint16(22,true)!==1||v.getUint32(24,true)!==AUDIO_RATE||v.getUint32(28,true)!==32000||v.getUint16(32,true)!==2||v.getUint16(34,true)!==16||size!==bytes.byteLength-44||size%2)throw Error('錄音格式不符。');
 const duration=size/(AUDIO_RATE*2);if(duration<MIN_SECONDS||duration>MAX_SECONDS)throw Error('錄音長度不符。');return {duration,byteLength:bytes.byteLength,mime:'audio/wav'};
}
export function validateSketch(value){
 if(!value||typeof value!=='object'||Object.keys(value).some(k=>!['version','strokes'].includes(k))||value.version!==1||!Array.isArray(value.strokes)||value.strokes.length<1||value.strokes.length>80)throw Error('請先畫下想法，最多80筆。');
 for(const stroke of value.strokes){if(!Array.isArray(stroke)||!stroke.length||stroke.length>128)throw Error('畫圖點數超過限制。');for(const point of stroke)if(!Array.isArray(point)||point.length!==2||point.some(n=>!Number.isFinite(n)||n<0||n>1))throw Error('畫圖內容不符。');}
 if(new TextEncoder().encode(JSON.stringify(value)).length>262144)throw Error('畫圖內容太大。');return value;
}
export function hasMessageContent({text='',audio,sketch}){return !!(text.trim()||audio||sketch?.strokes?.length);}
