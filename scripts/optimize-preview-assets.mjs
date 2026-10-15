import {existsSync,mkdirSync,readFileSync,readdirSync} from 'node:fs';
import {join,resolve,basename} from 'node:path';
import {optimizePreview,previewIsReady} from '../preview-optimizer.mjs';

const root=resolve(import.meta.dirname,'..','data','studio');
const selected=new Set(process.argv.slice(2));
const projectDirs=existsSync(root)?readdirSync(root,{withFileTypes:true}).filter(item=>item.isDirectory()&&(!selected.size||selected.has(item.name))).map(item=>join(root,item.name)):[];

let completed=0,skipped=0,failed=0;
for(const dir of projectDirs){
  const file=join(dir,'project.json');if(!existsSync(file))continue;
  const project=JSON.parse(readFileSync(file,'utf8'));
  const used=new Set((project.scenes||[]).map(scene=>scene.assetId));
  const videos=(project.assets||[]).filter(asset=>asset.type==='video'&&used.has(asset.id));
  if(!videos.length)continue;
  const destination=join(dir,'previews');mkdirSync(destination,{recursive:true});
  process.stdout.write(`${project.title||project.id}: ${videos.length} videos usados\n`);
  for(const [index,asset] of videos.entries()){
    if(asset.file!==basename(asset.file)){failed++;process.stderr.write(`  ${index+1}/${videos.length} nombre de archivo inválido\n`);continue;}
    const input=join(dir,'assets',asset.file),output=join(destination,`${asset.id}.mp4`);
    if(!existsSync(input)){failed++;process.stderr.write(`  ${index+1}/${videos.length} falta ${asset.name||asset.id}\n`);continue;}
    if(previewIsReady(input,output)){skipped++;continue;}
    process.stdout.write(`  ${index+1}/${videos.length} ${asset.name||asset.id}… `);
    try{await optimizePreview(input,output);completed++;process.stdout.write('listo\n');}
    catch(error){failed++;process.stdout.write(`error: ${error.message}\n`);}
  }
}
process.stdout.write(`Vista previa: ${completed} creados, ${skipped} existentes, ${failed} fallidos.\n`);
if(failed)process.exitCode=1;
