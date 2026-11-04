// Install the cloud build gate into a frozen, complete release directory.
// Never deploys, changes aliases, or modifies application source files.
import fs from 'node:fs/promises';import path from 'node:path';import {fileURLToPath} from 'node:url';
import {BUILD_COMMAND,runPreflight} from '../release/garden-preflight.mjs';
export async function prepareGardenRelease(root,options={}){
 root=await fs.realpath(root);
 const configPath=path.join(root,'vercel.json');let config;
 try{config=JSON.parse(await fs.readFile(configPath,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;config={};}
 if(config.builds||config.buildCommand&&config.buildCommand!==BUILD_COMMAND||config.outputDirectory&&config.outputDirectory!=='.')throw Error('發布包已有不同建置設定，需先整合，不能覆蓋');
 // Check the actual frozen sources before changing packaging metadata.
 const report=await runPreflight({root,...options});if(!report.passed)throw Error('目錄比對未通過，未準備發布包：'+JSON.stringify({missing:report.missing,mismatched:report.mismatched}));
 const dir=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../release');
 await fs.mkdir(path.join(root,'release'),{recursive:true});
 for(const name of ['garden-catalog.mjs','garden-preflight.mjs'])await fs.copyFile(path.join(dir,name),path.join(root,'release',name));
 config.buildCommand=BUILD_COMMAND;config.outputDirectory='.';
 await fs.writeFile(configPath,JSON.stringify(config,null,2)+'\n');return report;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{if(process.argv.length!==3)throw Error('需要指定完整發布包路徑');const report=await prepareGardenRelease(process.argv[2]);console.log(JSON.stringify({prepared:true,...report},null,2));}
 catch(e){console.error(e.message);process.exitCode=1;}
}
