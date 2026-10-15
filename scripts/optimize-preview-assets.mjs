import {existsSync,mkdirSync,readFileSync,readdirSync,renameSync,rmSync,statSync} from 'node:fs';
import {join,resolve,basename} from 'node:path';
import {spawn} from 'node:child_process';

const root=resolve(import.meta.dirname,'..','data','studio');
const selected=new Set(process.argv.slice(2));
const projectDirs=existsSync(root)?readdirSync(root,{withFileTypes:true}).filter(item=>item.isDirectory()&&(!selected.size||selected.has(item.name))).map(item=>join(root,item.name)):[];

function transcode(input,output){
  const args=['-y','-hide_banner','-loglevel','error','-i',input,'-vf',"scale=w='min(1280,iw)':h='min(720,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2",'-an','-c:v','libx264','-preset','veryfast','-crf','23','-pix_fmt','yuv420p','-force_key_frames','expr:gte(t,n_forced*1)','-movflags','+faststart',output];
  return new Promise((resolve,reject)=>{
    const child=spawn('ffmpeg',args,{stdio:['ignore','ignore','pipe']});
    let error='';child.stderr.on('data',part=>{error=(error+String(part)).slice(-2000);});
    child.on('error',reject);
    child.on('close',code=>code===0?resolve():reject(Error(error||`ffmpeg terminó con código ${code}`)));
  });
}

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
    const input=join(dir,'assets',asset.file),output=join(destination,`${asset.id}.mp4`),partial=`${output}.partial.mp4`;
    if(!existsSync(input)){failed++;process.stderr.write(`  ${index+1}/${videos.length} falta ${asset.name||asset.id}\n`);continue;}
    if(existsSync(output)&&statSync(output).mtimeMs>=statSync(input).mtimeMs){skipped++;continue;}
    process.stdout.write(`  ${index+1}/${videos.length} ${asset.name||asset.id}… `);
    try{await transcode(input,partial);renameSync(partial,output);completed++;process.stdout.write('listo\n');}
    catch(error){failed++;rmSync(partial,{force:true});process.stdout.write(`error: ${error.message}\n`);}
  }
}
process.stdout.write(`Vista previa: ${completed} creados, ${skipped} existentes, ${failed} fallidos.\n`);
if(failed)process.exitCode=1;
