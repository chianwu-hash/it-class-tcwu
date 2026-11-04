(function (root) {
  'use strict';
  var profiles = {
    cloudy: { sky: ['#ccd7df','#e0e5e5','#eeeee6'], ground: ['#cbd0bb','#bec7ae','#b3bea3'], shadow: [.105,.125,.13,.085], spread: 1.22, tint: 'none' },
    afterrain: { sky: ['#d3e5ec','#e8eee9','#f4f0de'], ground: ['#c5d2b5','#b6c7a5','#aabf9c'], shadow: [.135,.19,.18,.11], spread: 1.08, tint: 'none' }
  };
  var cache = {};
  function softEllipse(c,x,y,rx,ry,color,alpha) {
    c.save();c.translate(x,y);c.scale(rx,ry);
    var g=c.createRadialGradient(0,0,0,0,0,1);
    g.addColorStop(0,'rgba('+color+','+alpha+')');g.addColorStop(1,'rgba('+color+',0)');
    c.fillStyle=g;c.fillRect(-1,-1,2,2);c.restore();
  }
  function layer(kind) {
    if(cache[kind])return cache[kind];
    var p=profiles[kind];if(!p)throw new Error('Unknown garden weather');
    var canvas=document.createElement('canvas');canvas.width=1920;canvas.height=1520;
    var c=canvas.getContext('2d');c.scale(2,2);
    var sky=c.createLinearGradient(0,0,0,600);p.sky.forEach(function(color,i){sky.addColorStop([0,.52,1][i],color);});
    c.fillStyle=sky;c.fillRect(0,0,960,760);
    if(kind==='cloudy') {
      // Static cloud cover stays broad and faint, without competing with leaf silhouettes.
      softEllipse(c,160,80,320,110,'245,246,241',.43);
      softEllipse(c,790,155,340,125,'243,245,241',.34);
      softEllipse(c,475,8,420,90,'163,182,195',.09);
    } else {
      softEllipse(c,185,165,400,360,'255,248,218',.32);
      softEllipse(c,820,78,240,58,'249,251,245',.28);
    }
    function path(){c.beginPath();c.moveTo(0,565);c.bezierCurveTo(220,552,320,554,480,560);c.bezierCurveTo(670,567,800,566,960,559);c.lineTo(960,760);c.lineTo(0,760);c.closePath();}
    var grass=c.createLinearGradient(0,552,0,760);p.ground.forEach(function(color,i){grass.addColorStop([0,.42,1][i],color);});
    c.save();c.filter='blur(9px)';c.fillStyle=grass;path();c.fill();c.restore();
    c.save();c.beginPath();c.rect(0,582,960,178);c.clip();c.fillStyle=grass;c.fillRect(0,582,960,178);
    var n=19437;function rand(){n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;}
    for(var i=0;i<4400;i++){
      var x=rand()*960,y=582+rand()*178;
      c.fillStyle=i%3?'rgba(82,108,74,.04)':'rgba(246,248,230,.09)';
      c.beginPath();c.ellipse(x,y,.45+rand()*1.15,.2+rand()*.35,0,0,Math.PI*2);c.fill();
    }
    if(kind==='afterrain') {
      // A damp, diffuse sheen, not hard-edged puddles under the paws or fake reflections.
      softEllipse(c,245,615,220,11,'229,240,232',.20);
      softEllipse(c,740,650,180,9,'228,239,232',.17);
      softEllipse(c,110,746,120,10,'235,240,223',.10);
      softEllipse(c,852,726,96,7,'235,240,223',.10);
    }
    c.restore();cache[kind]=canvas;return canvas;
  }
  root.GardenWeatherV15={layer:layer,profiles:profiles,cachedKinds:function(){return Object.keys(cache);}};
})(window);
