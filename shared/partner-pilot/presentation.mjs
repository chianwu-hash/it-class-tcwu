// Presentation only: no auth client, network, progress or room state.
const sizes={"welcome":[480,268],"invite":[317,480],"wait":[480,281],"support":[480,329],"discover":[480,408],"keepsake":[480,312]};
export function scene(name,className='partner-art'){
 const size=sizes[name];if(!size)return '';
 const url=new URL('./art/'+name+'-v1.webp',import.meta.url).href;
 return `<img class="${className.replace(/[^a-zA-Z0-9 _-]/g,'')}" src="${url}" alt="" aria-hidden="true" width="${size[0]}" height="${size[1]}" loading="lazy" decoding="async">`;
}
const stages={
 login:['一起練，先從這裡開始。','用學校 Google 帳號登入，邀夥伴一起想。','invite'],
 home:['今天想怎麼加入小隊？','當隊長邀夥伴，或輸入邀請碼加入。','invite'],
 match:['找到夥伴，再一起出發。','自願集合、同年級跨班；每個人都能參與。','wait'],
 captain:['選好題目，邀夥伴一起來。','選卷與人數，建立小隊後就能分享邀請。','invite'],
 member:['輸入邀請碼，加入夥伴。','加入後，等隊長帶大家一起出發。','wait'],
 room:['人到齊，隊長帶大家出發。','加入就是小隊的一員；可以稍後從接續任務回來。','wait'],
 practice:['按自己的步調，和夥伴一起練','自己先想，也隨時有人陪。',null],
 review:['把彼此的題目帶回來，一起看看','交換方法，也分享值得注意的發現。',null],
 book:['我們的共同紀錄冊','留下這次一起想過的事，和每個人的努力。',null],
 record:['我們的共同紀錄冊','一起走過的努力，會留在這裡。',null]
};
export function setPartnerStage(stage){
 const root=document.querySelector('.partner-content'),config=stages[stage];if(!root||!config)return;
 root.dataset.stage=stage;
 const title=root.querySelector('[data-hero-title]'),sub=root.querySelector('[data-hero-sub]'),art=root.querySelector('[data-hero-art]');
 if(title&&title.textContent!==config[0])title.textContent=config[0];
 if(sub&&sub.textContent!==config[1])sub.textContent=config[1];
 if(art){art.hidden=!config[2];if(config[2]&&art.dataset.scene!==config[2]){art.innerHTML=scene(config[2],'partner-hero-pet');art.dataset.scene=config[2];}}
}
