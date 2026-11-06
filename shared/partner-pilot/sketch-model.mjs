export const PEN_COLORS=[['深綠','#185e60'],['藍色','#2459b3'],['紅色','#b83246'],['紫色','#7643a8'],['橘色','#a94b0b'],['黑色','#263238']];
export const DEFAULT_PEN=PEN_COLORS[0][1];
export const strokeColors=value=>value.colors||value.strokes.map(()=>DEFAULT_PEN);
const xy=p=>[p[0]*600,p[1]*360];
function distance(p,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],n=dx*dx+dy*dy,t=n?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/n)):0;return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);}
function intersects(a,b,c,d){const cross=(p,q,r)=>(q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]);return cross(a,b,c)*cross(a,b,d)<0&&cross(c,d,a)*cross(c,d,b)<0;}
// Sweep the complete eraser segment, so fast pointer movement cannot skip a line.
export function eraseStrokes(value,from,to,radius=12){
 const a=xy(from),b=xy(to),colors=strokeColors(value),keep=[];
 value.strokes.forEach((stroke,i)=>{let hit=false;for(let j=0;j<stroke.length;j++){const c=xy(stroke[j]),d=xy(stroke[Math.max(0,j-1)]);if(intersects(a,b,c,d)||Math.min(distance(c,a,b),distance(d,a,b),distance(a,c,d),distance(b,c,d))<=radius){hit=true;break;}}if(!hit)keep.push(i);});
 return {version:1,strokes:keep.map(i=>value.strokes[i]),...(value.colors?{colors:keep.map(i=>colors[i])}:{})};
}
