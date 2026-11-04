(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.GardenAssetStatus=factory();})(typeof self!=='undefined'?self:this,function(){
 'use strict';
 function create(post){var issues=new Map();function snapshot(){return Array.from(issues.values());}function publish(){post(snapshot());}return {report:function(id,text,fatal){issues.set(id,{id:id,text:text,fatal:!!fatal});publish();},snapshot:snapshot,publish:publish};}
 // An explicit missing-picture mark, never a different reward type.
 function flowerPlaceholder(ctx,x,y,size){ctx.save();ctx.fillStyle='#f4f8ed';ctx.strokeStyle='#60874d';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(x,y,size/2,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle='#426a37';ctx.font='bold '+Math.round(size*.65)+'px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('?',x,y);ctx.restore();}
 return {create:create,flowerPlaceholder:flowerPlaceholder};
});
