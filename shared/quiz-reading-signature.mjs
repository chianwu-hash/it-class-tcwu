// Compatibility fingerprint only; never an authorization or answer check.
const stable=x=>Array.isArray(x)?x.map(stable):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,stable(x[k])])):x;
export function readingSignature(q){
 const text=JSON.stringify(stable({id:q.id,prompt:q.prompt,fields:q.fields}));let hash=0xcbf29ce484222325n;
 for(let i=0;i<text.length;i++){hash^=BigInt(text.charCodeAt(i));hash=BigInt.asUintN(64,hash*0x100000001b3n);}
 return hash.toString(16).padStart(16,'0');
}
