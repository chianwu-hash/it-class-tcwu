(function(root){
  'use strict';
  var base=root.GardenWeatherV16,cache={},particles=[],n=17029;
  function random(){n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;}
  for(var i=0;i<230;i++)particles.push({x:random()*1240,y:random()*900,speed:.7+random()*.6,length:.7+random()*.6,phase:random()});
  var rain={
    drizzle:{count:48,speed:112,length:7,wind:-12,alpha:.18,width:.65,splashes:5,sky:['#b9c8d0','#d7e0e1','#e6e9e1'],ground:['#c8d1bd','#bccbb2','#afc1a6']},
    downpour:{count:174,speed:470,length:23,wind:-90,alpha:.24,width:.85,splashes:19,sky:['#9eafbd','#bdccd1','#dce2dc'],ground:['#bccbb9','#afc2aa','#a4b99e']},
    thunder:{count:222,speed:590,length:31,wind:-175,alpha:.25,width:1,splashes:25,sky:['#7f94a7','#a5b8c3','#c8d5d2'],ground:['#b6c7b5','#a8bda5','#9eb397']}
  };
  var profiles=Object.assign({},base.profiles);
  Object.keys(rain).forEach(function(k){profiles[k]={shadow:[.09,.13,.12,.085],spread:1.3,tint:'none',shadowColor:'47,66,66'};});
  function isRain(kind){return !!rain[kind];}
  function wash(c,x,y,rx,ry,alpha){c.save();c.translate(x,y);c.scale(rx,ry);var g=c.createRadialGradient(0,0,0,0,0,1);g.addColorStop(0,'rgba(242,247,244,'+alpha+')');g.addColorStop(1,'rgba(242,247,244,0)');c.fillStyle=g;c.fillRect(-1,-1,2,2);c.restore();}
  function layer(kind){
    if(!isRain(kind))return base.layer(kind);if(cache[kind])return cache[kind];
    var p=rain[kind],canvas=document.createElement('canvas');canvas.width=1920;canvas.height=1520;var c=canvas.getContext('2d');c.scale(2,2);
    var sky=c.createLinearGradient(0,0,0,600);p.sky.forEach(function(color,i){sky.addColorStop([0,.52,1][i],color);});c.fillStyle=sky;c.fillRect(0,0,960,760);
    wash(c,100,80,420,110,.16);wash(c,720,160,400,130,.12);
    function path(){c.beginPath();c.moveTo(0,565);c.bezierCurveTo(220,552,320,554,480,560);c.bezierCurveTo(670,567,800,566,960,559);c.lineTo(960,760);c.lineTo(0,760);c.closePath();}
    var grass=c.createLinearGradient(0,552,0,760);p.ground.forEach(function(color,i){grass.addColorStop([0,.42,1][i],color);});c.save();c.filter='blur(9px)';c.fillStyle=grass;path();c.fill();c.restore();
    c.save();c.beginPath();c.rect(0,582,960,178);c.clip();c.fillStyle=grass;c.fillRect(0,582,960,178);
    wash(c,245,616,220,11,.15);wash(c,740,650,180,9,.14);c.restore();cache[kind]=canvas;return canvas;
  }
  function counts(kind,viewWidth){var p=rain[kind];if(!p)return{back:0,front:0,splashes:0};var factor=viewWidth<=700?.62:1,total=Math.round(p.count*factor);return{back:Math.round(total*.79),front:total-Math.round(total*.79),splashes:Math.round(p.splashes*factor)};}
  // One broad, smooth cloud-light event every 18 seconds. No strobe or audio.
  function glowAt(ms,kind,enabled){if(kind!=='thunder'||!enabled)return 0;var t=((ms-6000)%18000+18000)%18000;if(t>=2200)return 0;return Math.sin(t/2200*Math.PI)*.085;}
  function streaks(ctx,ms,kind,options,front){
    if(!options.enabled)return;var p=rain[kind],c=counts(kind,options.viewWidth),begin=front?c.back:0,end=front?c.back+c.front:c.back,t=ms/1000;
    var wind=p.wind*(1+(kind==='thunder'?.16*Math.sin(t*.42):0));ctx.save();ctx.filter='none';ctx.strokeStyle='rgba(225,239,247,'+(front?p.alpha:p.alpha*.65)+')';ctx.lineWidth=p.width*(front?1:.8);ctx.lineCap='round';ctx.beginPath();
    for(var i=begin;i<end;i++){
      var q=particles[i],speed=p.speed*q.speed,y=((q.y+t*speed)%900)-65,x=((q.x+t*wind)%1240+1240)%1240-140,len=p.length*q.length;
      if(front&&options.cat){var cat=options.cat;if(x>cat.x-8&&x<cat.x+cat.w+8&&y>cat.y-8&&y<cat.y+cat.h+8)continue;}
      ctx.moveTo(x,y);ctx.lineTo(x+wind/speed*len,y+len);
    }
    ctx.stroke();ctx.restore();
  }
  function back(ctx,ms,kind,options){
    if(!isRain(kind)||!options.enabled)return;
    var glow=glowAt(ms,kind,options.glow);
    if(glow){ctx.save();ctx.beginPath();ctx.rect(0,0,960,410);ctx.clip();wash(ctx,790,70,240,230,glow);ctx.strokeStyle='rgba(231,242,248,'+(glow*2.7)+')';ctx.lineWidth=1.4;ctx.lineJoin='round';ctx.beginPath();ctx.moveTo(790,24);ctx.lineTo(767,66);ctx.lineTo(782,63);ctx.lineTo(752,119);ctx.stroke();ctx.restore();}
    streaks(ctx,ms,kind,options,false);
    var c=counts(kind,options.viewWidth),t=ms/1000;ctx.save();ctx.filter='none';ctx.lineWidth=.7;
    for(var i=0;i<c.splashes;i++){var q=particles[229-i],phase=(t*(kind==='drizzle'?.65:1.5)+q.phase)%1,x=125+q.x/1240*710,y=590+q.y/900*150;
      ctx.strokeStyle='rgba(235,246,240,'+((1-phase)*.19)+')';ctx.beginPath();ctx.ellipse(x,y,1+phase*5,.4+phase*1.3,0,0,Math.PI*2);ctx.stroke();}
    ctx.restore();
  }
  function front(ctx,ms,kind,options){if(isRain(kind))streaks(ctx,ms,kind,options,true);}
  root.GardenWeatherV17={profiles:profiles,layer:layer,cachedKinds:function(){return base.cachedKinds().concat(Object.keys(cache));}};
  root.GardenRainV17={isRain:isRain,back:back,front:front,counts:counts,glowAt:glowAt,profiles:rain};
})(window);
