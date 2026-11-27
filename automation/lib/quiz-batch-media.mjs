import assert from 'node:assert/strict';

// Exact descriptors for already supplied, private immutable media. This helper
// grants no access; SQL and the media endpoint retain their normal checks.
export function batchMediaAssets(packet) {
  const referenced=new Map();
  function visit(value){
    if(!value||typeof value!=='object')return;
    if(typeof value.url==='string'){
      const previous=referenced.get(value.url);
      if(previous)assert.equal(previous.kind,value.kind,'Conflicting media references');
      else referenced.set(value.url,value);
    }
    for(const child of Object.values(value))if(typeof child==='object')visit(child);
  }
  packet.candidates.forEach(c=>visit(c.doc));
  const assets=packet.mediaAssets??[];
  assert.equal(assets.length,referenced.size,'Missing or extra private media descriptors');
  assert.equal(new Set(assets.map(a=>a.url)).size,assets.length);
  for(const a of assets){
    const media=referenced.get(a.url);assert.ok(media);
    assert.match(a.sha256,/^[a-f0-9]{64}$/);
    assert.equal(a.url,`https://quiz-media.invalid/${packet.identities.owner}/${a.sha256}`);
    assert.ok(typeof a.object_path==='string'&&a.object_path.trim());
    const expectedKind = ['image/png','image/jpeg','image/webp'].includes(a.mime)
      ? 'image' : a.mime === 'audio/mpeg' ? 'audio' : null;
    assert.ok(expectedKind, 'Unsupported private media MIME');
    assert.ok(Number.isSafeInteger(a.bytes)&&a.bytes>0);
    assert.equal(media.kind,expectedKind);
  }
  return assets;
}
