// Crop a view of an already-authorized immutable source image. No new URL/data.
export function sourceCropStyle(v){
 if(!v||!['x','y','width','height','sourceWidth','sourceHeight'].every(k=>Number.isFinite(v[k])))return null;
 if(v.x<0||v.y<0||v.width<=0||v.height<=0||v.sourceWidth<=0||v.sourceHeight<=0||v.x+v.width>v.sourceWidth+.01||v.y+v.height>v.sourceHeight+.01)return null;
 return {aspectRatio:String(v.width/v.height),width:`${100*v.sourceWidth/v.width}%`,left:`${-100*v.x/v.width}%`,top:`${-100*v.y/v.height}%`};
}
export function applySourceCrop(link,img,viewBox){const s=sourceCropStyle(viewBox);if(!s)return;Object.assign(link.style,{display:'block',position:'relative',overflow:'clip',aspectRatio:s.aspectRatio,width:'100%'});Object.assign(img.style,{position:'absolute',width:s.width,maxWidth:'none',height:'auto',maxHeight:'none',left:s.left,top:s.top,margin:'0'});}
