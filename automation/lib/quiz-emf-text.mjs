import assert from 'node:assert/strict';

/** Extract original EMR_EXTTEXTOUTW runs; malformed offsets fail closed. */
export function emfTextRuns(bytes) {
  const b=Buffer.from(bytes),runs=[];let off=0;
  assert.ok(b.length>=88 && b.readUInt32LE(0)===1 && b.toString('ascii',40,44)===' EMF');
  while(off<b.length){
    assert.ok(off+8<=b.length);const type=b.readUInt32LE(off),size=b.readUInt32LE(off+4);
    assert.ok(size>=8 && size%4===0 && off+size<=b.length);
    assert.ok(![35,36,83,96,97,108].includes(type),'Unsupported transform or text record');
    assert.ok(![77,78,79,80,81,114,116].includes(type),'Unsupported bitmap record');
    if(type===76){
      assert.ok(size>=100);
      assert.equal(b.readUInt32LE(off+40),0x00F00021,'Only source-free PATCOPY table decoration is allowed');
      assert.equal(b.readUInt32LE(off+88),0);assert.equal(b.readUInt32LE(off+96),0);
    }
    if(type===84){
      assert.ok(size>=76);const count=b.readUInt32LE(off+44),start=b.readUInt32LE(off+48),flags=b.readUInt32LE(off+52);
      assert.equal(flags&0x10,0,'Glyph indices cannot be treated as Unicode');
      assert.ok(start>=76 && start+count*2<=size);
      const text=b.toString('utf16le',off+start,off+start+count*2);
      assert.ok(!text.includes('\uFFFD')&&!text.includes('\0'));
      runs.push({x:b.readInt32LE(off+36),y:b.readInt32LE(off+40),text});
    }
    off+=size;
  }
  assert.ok(runs.length);return runs;
}

/** Only two-column text boards with two exact connector columns. Visual QA remains required. */
export function emfMatchingColumns(runs){
  const visible=runs.filter(r=>r.text.trim());
  // Publisher EMFs use U+2027 HYPHENATION POINT as the connector glyph.
  const connectors=visible.filter(r=>r.text.trim()==='\u2027');
  const xs=[...new Set(connectors.map(r=>r.x))].sort((a,b)=>a-b);assert.equal(xs.length,2);
  const counts=xs.map(x=>connectors.filter(r=>r.x===x).length);assert.equal(counts[0],counts[1]);
  assert.ok(counts[0]>=2&&counts[0]<=8);
  const join=items=>{
    const lines=new Map();for(const r of items){if(!lines.has(r.y))lines.set(r.y,[]);lines.get(r.y).push(r);}
    return [...lines].sort((a,b)=>a[0]-b[0]).map(([,rs])=>rs.sort((a,b)=>a.x-b.x).map(r=>r.text).join('')).join('').replace(/\s/gu,'');
  };
  assert.ok(visible.every(r=>r.x<xs[0]||r.x>xs[1]||connectors.includes(r)),'Unassigned source text');
  return {left:join(visible.filter(r=>r.x<xs[0])),right:join(visible.filter(r=>r.x>xs[1])),count:counts[0],connectorX:xs};
}
