import {createLocationWeather} from './garden-location-weather.mjs';
import {startAutomaticLocation} from './garden-auto-location.mjs';
const $=id=>document.getElementById(id),api=window.__gardenShelterV21;
const names={day:'晴朗',cloudy:'陰天',drizzle:'小雨／毛毛雨',downpour:'較強降雨',thunder:'雷雨'};
const endpoint='/api/garden-weather';
let last=null;
const controller=createLocationWeather({endpoint,onChange:s=>{
 last=s;$('location-label').textContent=s.point.label;
 $('location-message').textContent=s.locating?'正在取得位置；若出現定位提示，請選擇是否允許。':s.point.id==='school'?'目前使用學校所在地天氣。':'依已授權的位置附近呈現天氣。';
 const clock=new Intl.DateTimeFormat('zh-TW',{timeZone:s.timeZone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format();
 $('local-clock').textContent=`當地 ${clock}・${s.isDay?'白天':'夜晚'}`;
 $('live-weather').textContent=s.weather?`${names[s.weather.scene]}${s.weather.stale?'（先前資料）':''}・資料 ${new Intl.DateTimeFormat('zh-TW',{timeZone:s.timeZone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(s.weather.observedAt))}`:'依時間呈現日夜';
 $('weather-message').textContent=s.weatherMessage;
 api.setAtmosphere(s.weather?.scene||'day',s.isDay);
}});
let automatic=startAutomaticLocation(controller);
window.addEventListener('pagehide',e=>{automatic.destroy();if(!e.persisted)controller.destroy()});
window.addEventListener('pageshow',e=>{if(e.persisted)automatic=startAutomaticLocation(controller)});
window.__gardenLocationWeather={snapshot:()=>last};
