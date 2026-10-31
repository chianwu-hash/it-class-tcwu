export const PET_NAMES=Object.freeze({cat:'橘寶',dog:'布丁',rabbit:'蹦蹦'});
export const petName=id=>PET_NAMES[id]||'夥伴';
export function petUnlockLabel(key,label){const id=key?.startsWith('pet:')?key.slice(4):null;if(!PET_NAMES[id])return label;return petName(id)+(label?.includes('與')?'與'+label.split('與').slice(1).join('與'):'');}
