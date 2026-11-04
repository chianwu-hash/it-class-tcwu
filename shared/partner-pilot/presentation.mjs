// Presentation only: no auth client, network, progress or room state.
const sizes={"welcome":[480,268],"invite":[317,480],"wait":[480,281],"support":[480,329],"discover":[480,408],"keepsake":[480,312]};
export function scene(name,className='partner-art'){
 const size=sizes[name];if(!size)return '';
 const url=new URL('./art/'+name+'-v1.webp',import.meta.url).href;
 return `<img class="${className.replace(/[^a-zA-Z0-9 _-]/g,'')}" src="${url}" alt="" aria-hidden="true" width="${size[0]}" height="${size[1]}" loading="lazy" decoding="async">`;
}
const stages={
 login:['一起練，先從這裡開始。','用學校 Google 帳號登入，邀夥伴一起想。','invite'],
 home:['帶著一組題，邀夥伴出發。','用邀請碼集合，各自準備好，再一起開始。','invite'],
 room:['一起準備，再一起出發。','人數到齊、每個人都準備好，就能一起開始。','wait'],
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
