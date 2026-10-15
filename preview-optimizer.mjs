import {existsSync,mkdirSync,renameSync,rmSync,statSync} from 'node:fs';
import {dirname} from 'node:path';
import {spawn} from 'node:child_process';
import {setPriority} from 'node:os';

const pending=new Map();
const queue=[];
let running=false;

export function previewIsReady(input,output){
  return existsSync(input)&&existsSync(output)&&statSync(output).mtimeMs>=statSync(input).mtimeMs;
}

export async function optimizePreview(input,output){
  if(previewIsReady(input,output))return false;
  mkdirSync(dirname(output),{recursive:true});
  const partial=`${output}.partial.mp4`;
  rmSync(partial,{force:true});
  const args=['-y','-hide_banner','-loglevel','error','-i',input,'-vf',"fps=30,scale=w='min(1280,iw)':h='min(720,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2",'-an','-c:v','libx264','-preset','veryfast','-crf','24','-pix_fmt','yuv420p','-force_key_frames','expr:gte(t,n_forced*0.5)','-movflags','+faststart',partial];
  try{
    await new Promise((resolve,reject)=>{
      const child=spawn('ffmpeg',args,{stdio:['ignore','ignore','pipe']});
      try{setPriority(child.pid,10);}catch{}
      let detail='';child.stderr.on('data',part=>{detail=(detail+String(part)).slice(-2000);});
      child.on('error',reject);
      child.on('close',code=>code===0?resolve():reject(Error(detail||`ffmpeg terminó con código ${code}`)));
    });
    renameSync(partial,output);
    return true;
  }catch(error){rmSync(partial,{force:true});throw error;}
}

// Existing projects are prepared as their clips are viewed. One FFmpeg process at
// a time prevents seeking from competing with several preview encoders on a VPS.
export function schedulePreview(input,output){
  if(previewIsReady(input,output)||pending.has(output))return;
  pending.set(output,true);queue.push({input,output});
  if(!running)setTimeout(drain,100);
}

async function drain(){
  if(running)return;
  running=true;
  try{
    while(queue.length){
      const {input,output}=queue.shift();
      try{await optimizePreview(input,output);}
      catch(error){console.warn(`No se pudo preparar la vista previa de ${output}: ${error.message}`);}
      finally{pending.delete(output);}
    }
  }finally{running=false;}
}
