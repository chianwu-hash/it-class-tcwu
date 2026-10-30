(function (root) {
  'use strict';
  var base=root.GardenWeatherV15,night=null;
  var profiles=Object.assign({},base.profiles,{
    night:{sky:['#26394f','#3d5268','#687b7b'],ground:['#71877b','#657e70','#587365'],shadow:[.18,.24,.22,.13],spread:1.14,tint:'none',shadowColor:'22,34,48',shadowOffset:-6}
  });
  function wash(c,x,y,rx,ry,color,opacity){
    c.save();c.translate(x,y);c.scale(rx,ry);var g=c.createRadialGradient(0,0,0,0,0,1);
    g.addColorStop(0,'rgba('+color+','+opacity+')');g.addColorStop(1,'rgba('+color+',0)');c.fillStyle=g;c.fillRect(-1,-1,2,2);c.restore();
  }
  function layer(kind){
    if(kind!=='night')return base.layer(kind);
    if(night)return night;
    var p=profiles.night,canvas=document.createElement('canvas');canvas.width=1920;canvas.height=1520;
    var c=canvas.getContext('2d');c.scale(2,2);
    var sky=c.createLinearGradient(0,0,0,600);p.sky.forEach(function(color,i){sky.addColorStop([0,.52,1][i],color);});c.fillStyle=sky;c.fillRect(0,0,960,760);
    // A quiet, static moon stays clear of the main canopy and inside the mobile crop.
    wash(c,795,90,92,92,'220,235,244',.12);wash(c,795,90,42,42,'237,244,239',.13);
    var moon=c.createRadialGradient(789,84,2,795,90,19);moon.addColorStop(0,'#f3f2d9');moon.addColorStop(1,'#d6dfdb');c.fillStyle=moon;c.beginPath();c.arc(795,90,18,0,Math.PI*2);c.fill();
    c.fillStyle='rgba(174,194,196,.12)';[[791,93,4],[801,84,2.5],[800,99,2]].forEach(function(a){c.beginPath();c.arc(a[0],a[1],a[2],0,Math.PI*2);c.fill();});
    [[167,68,1.5,.50],[222,133,1.1,.38],[738,47,1.1,.44],[810,182,1.2,.30],[155,253,1,.22],[813,304,1,.22]].forEach(function(a){c.fillStyle='rgba(228,239,241,'+a[3]+')';c.beginPath();c.arc(a[0],a[1],a[2],0,Math.PI*2);c.fill();});
    // Gentle ambient sky glow keeps small leaves readable without altering the art.
    wash(c,500,340,410,300,'183,209,219',.06);
    function path(){c.beginPath();c.moveTo(0,565);c.bezierCurveTo(220,552,320,554,480,560);c.bezierCurveTo(670,567,800,566,960,559);c.lineTo(960,760);c.lineTo(0,760);c.closePath();}
    var grass=c.createLinearGradient(0,552,0,760);p.ground.forEach(function(color,i){grass.addColorStop([0,.42,1][i],color);});
    c.save();c.filter='blur(9px)';c.fillStyle=grass;path();c.fill();c.restore();
    c.save();c.beginPath();c.rect(0,582,960,178);c.clip();c.fillStyle=grass;c.fillRect(0,582,960,178);
    var n=19437;function rand(){n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;}
    for(var i=0;i<4400;i++){var x=rand()*960,y=582+rand()*178;c.fillStyle=i%3?'rgba(34,60,53,.035)':'rgba(194,216,204,.055)';c.beginPath();c.ellipse(x,y,.45+rand()*1.15,.2+rand()*.35,0,0,Math.PI*2);c.fill();}
    wash(c,730,650,330,130,'198,220,221',.075);c.restore();night=canvas;return canvas;
  }
  root.GardenWeatherV16={layer:layer,profiles:profiles,cachedKinds:function(){return base.cachedKinds().concat(night?['night']:[]);}};
})(window);
