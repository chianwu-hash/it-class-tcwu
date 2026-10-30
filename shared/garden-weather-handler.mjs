import {SCHOOL_WEATHER_POINT,coarseLocation,weatherAnimation,WEATHER_REFRESH_MS} from './garden-location-weather.mjs';
const allowed=o=>o==='https://it-class-tcwu.vercel.app'||/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(o);
export function createLocationWeatherHandler({fetcher=fetch,now=Date.now}={}){
 const cache=new Map(),pending=new Map();
 return async request=>{
  const origin=request.headers.get('Origin')||'',headers={'Content-Type':'application/json;charset=utf-8','Cache-Control':'no-store','Vary':'Origin','X-Content-Type-Options':'nosniff'};if(origin&&allowed(origin))headers['Access-Control-Allow-Origin']=origin;
  const reply=(body,status=200)=>Response.json(body,{status,headers});
  if(origin&&!allowed(origin))return reply({error:'origin_unavailable'},403);
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{...headers,'Access-Control-Allow-Methods':'GET, OPTIONS'}});
  if(request.method!=='GET')return reply({error:'method_unavailable'},405);
  const url=new URL(request.url);let point;
  try{
   if(url.pathname!=='/weather')throw Error();
   const keys=[...url.searchParams.keys()];if(new Set(keys).size!==keys.length)throw Error();
   if(keys.length===1&&url.searchParams.get('location')==='school')point=SCHOOL_WEATHER_POINT;
   else if(keys.length===2&&keys.includes('lat')&&keys.includes('lon')&&url.searchParams.get('lat')?.trim()&&url.searchParams.get('lon')?.trim())point=coarseLocation(Number(url.searchParams.get('lat')),Number(url.searchParams.get('lon')));
   else throw Error();
  }catch{return reply({error:'location_unavailable'},400)}
  const old=cache.get(point.id),age=old?now()-Date.parse(old.fetchedAt):Infinity;
  if(age<WEATHER_REFRESH_MS)return reply({...old,stale:false});
  try{
   let job=pending.get(point.id);
   if(!job){job=(async()=>{
    const api=new URL('https://api.open-meteo.com/v1/forecast');for(const [k,v]of Object.entries({latitude:point.latitude,longitude:point.longitude,current:'weather_code,precipitation,is_day',daily:'sunrise,sunset',timezone:'auto',timeformat:'unixtime',forecast_days:2}))api.searchParams.set(k,v);
    const r=await fetcher(api,{signal:AbortSignal.timeout(6500),redirect:'manual'});if(!r.ok)throw Error('provider_http');const d=await r.json(),c=d.current;
    if(!c||!Number.isInteger(c.weather_code)||!Number.isFinite(c.precipitation)||c.precipitation<0||![0,1].includes(c.is_day)||!Number.isFinite(c.time)||typeof d.timezone!=='string'||!Array.isArray(d.daily?.sunrise)||!Array.isArray(d.daily?.sunset))throw Error('provider_shape');
    const solarDays=d.daily.sunrise.map((s,i)=>({sunrise:s*1000,sunset:d.daily.sunset[i]*1000}));if(solarDays.length<1||solarDays.some(s=>!Number.isFinite(s.sunrise)||!Number.isFinite(s.sunset)||s.sunrise>=s.sunset))throw Error('provider_shape');
    new Intl.DateTimeFormat('en',{timeZone:d.timezone}).format();
    const result={locationId:point.id,label:point.label,scene:weatherAnimation(c.weather_code,c.precipitation),weatherCode:c.weather_code,isDay:!!c.is_day,timeZone:d.timezone,solarDays,observedAt:new Date(c.time*1000).toISOString(),fetchedAt:new Date(now()).toISOString(),source:'Open-Meteo',stale:false};cache.delete(point.id);cache.set(point.id,result);while(cache.size>128)cache.delete(cache.keys().next().value);return result;
   })();pending.set(point.id,job);job.finally(()=>pending.delete(point.id)).catch(()=>{})}
   return reply(await job);
  }catch{if(old&&age<6*3600000)return reply({...old,stale:true});return reply({error:'weather_temporarily_unavailable'},503)}
 };
}
