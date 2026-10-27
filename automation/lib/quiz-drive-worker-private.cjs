// Local Windows DPAPI vault. No plaintext credentials in project files or logs.
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const file=path.join(process.env.LOCALAPPDATA,'Codex','secrets','quiz-drive-worker','poc.dpapi');
function transform(value,encrypt){
 const command=encrypt?'$v=[Console]::In.ReadToEnd(); ConvertFrom-SecureString (ConvertTo-SecureString $v -AsPlainText -Force)':'$v=[Console]::In.ReadToEnd(); [System.Net.NetworkCredential]::new("",(ConvertTo-SecureString $v)).Password';
 const r=spawnSync('pwsh',['-NoProfile','-NonInteractive','-Command',command],{input:value,encoding:'utf8',windowsHide:true});
 if(r.status!==0)throw Error('private_vault_unavailable');return r.stdout.trim();
}
exports.load=()=>JSON.parse(transform(fs.readFileSync(file,'utf8'),false));
exports.save=value=>{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,transform(JSON.stringify(value),true));};
exports.exists=()=>fs.existsSync(file);
