// Only literal source snippets become underline nodes; no HTML is interpreted.
export function underlineTextParts(text, underlines = []) {
 if(typeof text!=='string')return [];
 const ranges=[];
 for(const value of Array.isArray(underlines)?underlines.slice(0,100):[]){
  const needle=typeof value==='string'?value:value?.text,occurrence=typeof value==='object'?value.occurrence??1:1;
  if(typeof needle!=='string'||!needle||needle.length>2000||!Number.isInteger(occurrence)||occurrence<1||occurrence>100)continue;
  let start=-1,from=0;for(let i=0;i<occurrence;i++){start=text.indexOf(needle,from);if(start<0)break;from=start+needle.length;}
  if(start>=0)ranges.push([start,start+needle.length]);
 }
 ranges.sort((a,b)=>a[0]-b[0]);const merged=[];
 for(const range of ranges){const last=merged.at(-1);if(last&&range[0]<=last[1])last[1]=Math.max(last[1],range[1]);else merged.push([...range]);}
 const parts=[];let at=0;for(const [start,end]of merged){if(start>at)parts.push({text:text.slice(at,start),underline:false});parts.push({text:text.slice(start,end),underline:true});at=end;}
 if(at<text.length)parts.push({text:text.slice(at),underline:false});return parts;
}
