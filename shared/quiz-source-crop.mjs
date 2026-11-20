// Crop a view of an already-authorized immutable source image. No new URL/data.
export function sourceCropStyle(v){
 if(!v||!['x','y','width','height','sourceWidth','sourceHeight'].every(k=>Number.isFinite(v[k])))return null;
 if(v.x<0||v.y<0||v.width<=0||v.height<=0||v.sourceWidth<=0||v.sourceHeight<=0||v.x+v.width>v.sourceWidth+.01||v.y+v.height>v.sourceHeight+.01)return null;
 return {aspectRatio:String(v.width/v.height),width:`${100*v.sourceWidth/v.width}%`,left:`${-100*v.x/v.width}%`,top:`${-100*v.y/v.height}%`};
}
export function applySourceCrop(link, img, viewBox, { fill = false } = {}) {
 const crop = sourceCropStyle(viewBox);
 if (!crop) return;

 // Use the same scale for small diagrams, and keep tall crops within the
 // regular image height limit. Narrow containers can still shrink the crop.
 const previewWidth = Math.min(2.5 * viewBox.width, 640, 390 * Number(crop.aspectRatio));
 Object.assign(link.style, {
  display: 'block',
  position: 'relative',
  overflow: 'clip',
  aspectRatio: crop.aspectRatio,
  width: fill ? '100%' : `min(100%, ${previewWidth}px)`,
  marginInline: fill ? '' : 'auto'
 });

 // The source is positioned outside the crop before decoding. Eager loading
 // ensures the browser requests it even when that image is offscreen.
 img.loading = 'eager';
 Object.assign(img.style, {
  position: 'absolute', width: crop.width, maxWidth: 'none',
  height: 'auto', maxHeight: 'none', left: crop.left, top: crop.top, margin: '0'
 });
}
