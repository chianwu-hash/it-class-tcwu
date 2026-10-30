import {createLocationWeather} from './garden-location-weather.mjs';
const $=id=>document.getElementById(id),api=window.__gardenShelterV21;
const names={day:'晴朗',cloudy:'陰天',drizzle:'小雨／毛毛雨',downpour:'較強降雨',thunder:'雷雨'};
const endpoint='/api/garden-weather';
let last=null;
const controller=createLocationWeather({endpoint,onChange:s=>{
 last=s;$('location-label').textContent=s.point.label;$('use-location').disabled=s.locating;$('use-location').textContent=s.locating?'定位中…':'使用目前位置';$('location-message').textContent=s.geoMessage;
 const clock=new Intl.DateTimeFormat('zh-TW',{timeZone:s.timeZone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format();
 $('local-clock').textContent=`當地 ${clock}・${s.isDay?'白天':'夜晚'}`;
 $('live-weather').textContent=s.weather?`${names[s.weather.scene]}${s.weather.stale?'（先前資料）':''}・資料 ${new Intl.DateTimeFormat('zh-TW',{timeZone:s.timeZone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(s.weather.observedAt))}`:'依時間呈現日夜';
 $('weather-message').textContent=s.weatherMessage;
 if($('follow-weather').checked)api.setAtmosphere(s.weather?.scene||'day',s.isDay);
}});
$('use-location').addEventListener('click',()=>controller.locate());$('school-location').addEventListener('click',()=>{$('follow-weather').checked=true;controller.school()});
$('follow-weather').addEventListener('change',()=>{if($('follow-weather').checked&&last)api.setAtmosphere(last.weather?.scene||'day',last.isDay);$('manual-note').textContent=$('follow-weather').checked?'':'目前為手動預覽；勾選後恢復當地日夜與天氣。'});
document.addEventListener('click',e=>{const b=e.target.closest('[data-theme]');if(!b)return;$('follow-weather').checked=false;$('manual-note').textContent='目前為手動預覽；勾選後恢復當地日夜與天氣。';api.setAtmosphere(b.dataset.theme,b.dataset.theme!=='night')},true);
window.addEventListener('pagehide',e=>{if(!e.persisted)controller.destroy()});
window.__gardenLocationWeather={controller,snapshot:()=>last};
