import fs from 'node:fs';import{createHash}from'node:crypto';
const base=JSON.parse(fs.readFileSync('tmp/production-baseline.json','utf8'));
const changed=base.files.filter(f=>createHash('sha1').update(fs.readFileSync(f.file)).digest('hex')!==f.sha).map(f=>f.file);
const added=['shared/typing-foundation-milestones.mjs','shared/reward-source-colors.mjs','shared/typing-foundation-milestone-ui.mjs','shared/typing-foundation-milestones.css','supabase/foundation_milestones.sql'];
const files=[...changed,...added].map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}));
fs.writeFileSync('tmp/foundation-feature-manifest.json',JSON.stringify({baseline:base.deployment,files},null,2));console.log(JSON.stringify({baseline:base.deployment,changed,added},null,2));
