import test from 'node:test';
import assert from 'node:assert/strict';
import {inviteURL,readInvite,inviteQR,bindInvite} from '../../shared/partner-pilot/invite.mjs';

test('invite links contain only a six-digit code and preserve supported grade/current origin',()=>{
 for(const grade of [3,4,6,9]){
  const path=`/grade${grade}/115-1/partner-practice.html`,link=inviteURL('https://it-class-tcwu.vercel.app'+path+'?session=private&award=private#secret','000123');
  assert.equal(link,'https://it-class-tcwu.vercel.app'+path+'?invite=000123');assert.deepEqual(readInvite(link),{code:'000123',invalid:false});
 }
 for(const code of ['12345','1234567','１２３４５６','12x456','<img>','123456&room=private'])assert.throws(()=>inviteURL('https://it-class-tcwu.vercel.app/grade3/115-1/partner-practice.html',code),/INVALID_CODE/);
 for(const page of ['javascript:alert(1)','https://example.invalid/grade5/115-1/partner-practice.html','https://user:pass@example.invalid/grade3/115-1/partner-practice.html','https://example.invalid/elsewhere.html'])assert.throws(()=>inviteURL(page,'123456'));
});
test('invalid, duplicate or absent invite parameters never become an invitation',()=>{
 const base='https://it-class-tcwu.vercel.app/grade3/115-1/partner-practice.html';
 assert.deepEqual(readInvite(base),{code:null,invalid:false});
 for(const query of ['?invite=','?invite=123','?invite=123456&invite=654321','?invite=%3Cscript%3E'])assert.deepEqual(readInvite(base+query),{code:null,invalid:true});
});
test('QR is a local SVG with a white quiet zone and no remote image dependencies',()=>{
 const url=inviteURL('https://it-class-tcwu.vercel.app/grade3/115-1/partner-practice.html','123456'),svg=inviteQR(url);
 assert.equal(inviteQR(url),svg);assert.match(svg,/viewBox="0 0 [0-9]+ [0-9]+"/);assert.match(svg,/fill="#fff"/);assert.match(svg,/shape-rendering="crispEdges"/);assert(!/<(?:image|script)|href=|https:\/\//.test(svg.replace('http://www.w3.org/2000/svg','')));
});
test('copying a link uses the displayed invitation; denied clipboard selects it for manual copy',async()=>{
 const messages=[],copied=[],field={value:'https://it-class-tcwu.vercel.app/grade3/115-1/partner-practice.html?invite=000123',focus(){this.focused=true},select(){this.selected=true}},codeButton={},linkButton={};
 const output={textContent:'',dataset:{}},root={querySelector:s=>({'#invite-link':field,'#copy':codeButton,'#copy-link':linkButton,'#invite-copy-status':output}[s])};
 bindInvite(root,{code:'000123',notice:t=>messages.push(t),clipboard:{writeText:async text=>copied.push(text)}});await codeButton.onclick();assert.match(codeButton.textContent,/已複製/);await linkButton.onclick();assert.deepEqual(copied,['000123',field.value]);assert.match(linkButton.textContent,/已複製/);assert.match(output.textContent,/邀請連結已複製/);assert.equal(output.dataset.tone,'success');
 bindInvite(root,{code:'000123',notice:t=>messages.push(t),clipboard:{writeText:async()=>{throw Error('denied')}}});await linkButton.onclick();assert(field.selected&&field.focused);assert(messages.at(-1).includes('已選取'));assert.equal(linkButton.textContent,'複製邀請連結');assert.equal(output.dataset.tone,'error');
});
