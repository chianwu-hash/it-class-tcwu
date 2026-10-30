// School weather point: campus public-art GPS, NTPC Cultural Affairs Bureau.
export const SCHOOL_WEATHER_POINT=Object.freeze({id:'school',label:'頂溪國小・新北市永和區',latitude:25.015,longitude:121.51122,timeZone:'Asia/Taipei'});
export const WEATHER_REFRESH_MS=20*60*1000;
export function coarseLocation(latitude,longitude){
 if(!Number.isFinite(latitude)||!Number.isFinite(longitude)||Math.abs(latitude)>90||Math.abs(longitude)>180)throw Error('invalid_location');
 const lat=Math.round(latitude*50)/50,lon=Math.round(longitude*50)/50;
 return {id:`nearby:${lat.toFixed(2)},${lon.toFixed(2)}`,label:'目前位置附近',latitude:lat,longitude:lon};
}
export function weatherAnimation(code,precipitation=0){
 if(!Number.isInteger(code)||code<0||code>99)throw Error('invalid_weather');
 if([95,96,99].includes(code))return 'thunder';
 if([51,53,55,56,57].includes(code))return 'drizzle';
 if([61,63,65,66,67,80,81,82].includes(code))return [63,65,67,81,82].includes(code)||precipitation>=2.5?'downpour':'drizzle';
 return code>=2?'cloudy':'day';
}
export function isDaylight(weather,now=Date.now(),timeZone='Asia/Taipei'){
 let dateKey;try{const fmt=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'});dateKey=t=>fmt.format(t)}catch{dateKey=t=>new Date(t).toDateString()}
 const solar=weather?.solarDays?.find(d=>Number.isFinite(d.sunrise)&&Number.isFinite(d.sunset)&&dateKey(d.sunrise)===dateKey(now));
 if(solar)return now>=solar.sunrise&&now<solar.sunset;
 if(weather&&now-Date.parse(weather.fetchedAt)<WEATHER_REFRESH_MS&&typeof weather.isDay==='boolean')return weather.isDay;
 let hour;try{hour=Number(new Intl.DateTimeFormat('en',{timeZone,hour:'numeric',hourCycle:'h23'}).format(now))}catch{hour=new Date(now).getHours()}
 return hour>=6&&hour<18;
}
export function validLocationWeather(w){try{return !!(w&&['day','cloudy','drizzle','downpour','thunder'].includes(w.scene)&&typeof w.isDay==='boolean'&&Number.isFinite(Date.parse(w.fetchedAt))&&Number.isFinite(Date.parse(w.observedAt))&&typeof w.timeZone==='string'&&new Intl.DateTimeFormat('en',{timeZone:w.timeZone}).format()&&Array.isArray(w.solarDays)&&w.solarDays.every(s=>Number.isFinite(s.sunrise)&&Number.isFinite(s.sunset)&&s.sunrise<s.sunset))}catch{return false}}
export function createLocationWeather({endpoint,onChange,geolocation=globalThis.navigator?.geolocation,fetcher=globalThis.fetch,now=Date.now,visibility=globalThis.document,timers=globalThis}={}){
 let point={...SCHOOL_WEATHER_POINT},data=null,geoMessage='',weatherMessage='',locating=false,locateVersion=0,version=0,disposed=false,abort=null,refreshTimer=null,clockTimer=null,geoTimer=null;
 const cache=new Map();
 const notify=()=>{if(disposed)return;const zone=data?.timeZone||point.timeZone||Intl.DateTimeFormat().resolvedOptions().timeZone;onChange?.({point:{...point},weather:data,isDay:isDaylight(data,now(),zone),timeZone:zone,locating,geoMessage,weatherMessage,loading:!!abort})};
 function clearTicks(){timers.clearTimeout(refreshTimer);timers.clearTimeout(clockTimer)}
 function clock(){timers.clearTimeout(clockTimer);if(disposed||visibility?.hidden)return;notify();clockTimer=timers.setTimeout(clock,60000)}
 function validReply(w,selected){return validLocationWeather(w)&&w.locationId===selected.id}
 async function refresh(){
  if(disposed||visibility?.hidden)return;timers.clearTimeout(refreshTimer);const selected={...point},mine=++version;abort?.abort();abort=null;const cached=cache.get(selected.id);
  if(cached&&now()-Date.parse(cached.fetchedAt)<WEATHER_REFRESH_MS){data=cached;weatherMessage=cached.stale?'目前使用先前天氣資料。':'';notify();refreshTimer=timers.setTimeout(refresh,Math.max(1000,WEATHER_REFRESH_MS-(now()-Date.parse(cached.fetchedAt))));return}
  const controller=new AbortController();abort=controller;weatherMessage='正在讀取當地天氣…';notify();const timeout=timers.setTimeout(()=>controller.abort(),8000);
  try{
   const url=new URL(endpoint,globalThis.location?.href||'http://localhost/');if(selected.id==='school')url.searchParams.set('location','school');else{url.searchParams.set('lat',selected.latitude.toFixed(2));url.searchParams.set('lon',selected.longitude.toFixed(2))}
   const response=await fetcher(url,{signal:controller.signal,credentials:'omit',referrerPolicy:'no-referrer'});if(!response.ok)throw Error('weather_http');const w=await response.json();if(!validReply(w,selected))throw Error('weather_shape');if(disposed||mine!==version||point.id!==selected.id)return;
   data=w;cache.delete(selected.id);cache.set(selected.id,w);while(cache.size>8)cache.delete(cache.keys().next().value);weatherMessage=w.stale?'天氣暫時無法更新，先使用先前資料。':'';
  }catch{
   if(disposed||mine!==version)return;data=cached&&now()-Date.parse(cached.fetchedAt)<6*3600000?cached:null;weatherMessage=data?'天氣暫時無法更新，先使用先前資料。':'天氣暫時無法讀取，先依當地時間呈現日夜。';
  }finally{
   timers.clearTimeout(timeout);if(!disposed&&mine===version){abort=null;notify();refreshTimer=timers.setTimeout(refresh,data&&!data.stale?WEATHER_REFRESH_MS:5*60000)}
  }
 }
 function select(next){version++;abort?.abort();abort=null;point=next;data=cache.get(next.id)||null;weatherMessage='';notify();void refresh();clock()}
 function school(){locateVersion++;locating=false;timers.clearTimeout(geoTimer);geoMessage='已回到學校地點。';select({...SCHOOL_WEATHER_POINT})}
 function locate(){
  if(disposed||locating)return;if(!geolocation?.getCurrentPosition){geoMessage='這個瀏覽器無法定位，維持原地點。';notify();return}
  const mine=++locateVersion;locating=true;geoMessage='請在瀏覽器提示中選擇是否允許定位。';notify();
  const fail=err=>{if(disposed||mine!==locateVersion)return;locateVersion++;locating=false;timers.clearTimeout(geoTimer);geoMessage=err?.code===1?'未取得定位授權，維持原地點。':'定位暫時無法完成，維持原地點。';notify()};
  geoTimer=timers.setTimeout(()=>fail({code:3}),30000);
  try{geolocation.getCurrentPosition(p=>{if(disposed||mine!==locateVersion)return;let next;try{next=coarseLocation(p.coords.latitude,p.coords.longitude)}catch{return fail({code:2})}locateVersion++;locating=false;timers.clearTimeout(geoTimer);geoMessage='已切換到目前位置附近；未保存精確位置。';select(next)},fail,{enableHighAccuracy:false,timeout:10000,maximumAge:5*60000})}catch{fail({code:2})}
 }
 function resume(){if(visibility?.hidden){clearTicks();version++;abort?.abort();abort=null}else{clock();void refresh()}}
 visibility?.addEventListener?.('visibilitychange',resume);void refresh();clock();
 return {locate,school,refresh,snapshot:()=>({point:{...point},weather:data,locating,geoMessage,weatherMessage}),destroy(){disposed=true;version++;locateVersion++;abort?.abort();clearTicks();timers.clearTimeout(geoTimer);visibility?.removeEventListener?.('visibilitychange',resume)}};
}
