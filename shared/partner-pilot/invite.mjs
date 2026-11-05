import qrcode from '../vendor/qrcode-generator/qrcode.mjs';

const cache=new Map();
export function inviteURL(pageUrl,code){
 if(!/^[0-9]{6}$/.test(String(code)))throw Error('INVALID_CODE');
 const page=new URL(pageUrl);
 if(!/^https?:$/.test(page.protocol)||page.username||page.password||!/^\/grade(?:3|4|6|9)\/115-1\/partner-practice\.html$/.test(page.pathname))throw Error('INVALID_INVITE_PAGE');
 const link=new URL(page.pathname,page.origin);link.searchParams.set('invite',String(code));return link.href;
}
export function readInvite(pageUrl){
 const values=new URL(pageUrl).searchParams.getAll('invite');
 return {code:values.length===1&&/^[0-9]{6}$/.test(values[0])?values[0]:null,invalid:values.length>0&&(values.length!==1||!/^[0-9]{6}$/.test(values[0]))};
}
export function inviteQR(link){
 if(cache.has(link))return cache.get(link);
 const qr=qrcode(0,'M');qr.addData(link,'Byte');qr.make();
 const count=qr.getModuleCount(),size=count+8;let path='';
 for(let y=0;y<count;y++)for(let x=0;x<count;x++)if(qr.isDark(y,x))path+=`M${x+4},${y+4}h1v1h-1z`;
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${size*4}" height="${size*4}" viewBox="0 0 ${size} ${size}" role="img" aria-label="掃描QR Code開啟集合室邀請" shape-rendering="crispEdges"><rect width="${size}" height="${size}" fill="#fff"/><path d="${path}" fill="#063d40"/></svg>`;
 if(cache.size>=8)cache.delete(cache.keys().next().value);cache.set(link,svg);return svg;
}
export function inviteMarkup({pageUrl,code,esc}){
 const link=inviteURL(pageUrl,code);
 return `<div class="invite-share"><div class="invite-details"><p class="muted">用邀請碼、連結或掃碼邀夥伴（24小時內可加入）</p><div class="code">${esc(code)}</div><div class="actions"><button id="copy" type="button">複製邀請碼</button><button id="copy-link" type="button" class="green">複製邀請連結</button></div><label for="invite-link">邀請連結</label><input id="invite-link" type="url" readonly value="${esc(link)}"><p class="muted invite-hint">夥伴開啟後，登入學校帳號，確認小隊再加入。</p></div><figure class="invite-qr">${inviteQR(link)}<figcaption>掃碼開啟邀請</figcaption></figure></div>`;
}
export function bindInvite(root,{code,notice,clipboard=globalThis.navigator?.clipboard}){
 const field=root.querySelector('#invite-link');if(!field)return;
 field.onclick=()=>field.select();
 root.querySelector('#copy').onclick=async()=>{try{await clipboard.writeText(code);notice('邀請碼已複製。');}catch{notice('請直接選取六位數邀請碼複製。');}};
 root.querySelector('#copy-link').onclick=async()=>{try{await clipboard.writeText(field.value);notice('邀請連結已複製，可以分享給夥伴。');}catch{field.focus();field.select();notice('請複製已選取的邀請連結，再分享給夥伴。');}};
}
