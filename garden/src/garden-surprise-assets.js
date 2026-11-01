(function(root){
 'use strict';
 var base='./assets/processed/pet-surprise-v1/';
 root.GardenSurpriseAssets={load:async function(species){
  try{
   var r=await fetch(base+'manifest.json');if(!r.ok)return null;
   var m=(await r.json()).species[species];if(!m)return null;
   var g=m.groups.surprise;
   var images=await Promise.all(g.frames.map(function(src){return new Promise(function(resolve,reject){var im=new Image();im.onload=function(){resolve(im)};im.onerror=reject;im.src=base+src})}));
   return {canvas:m.canvas,group:g,images:images};
  }catch{return null}
 }};
})(window);
