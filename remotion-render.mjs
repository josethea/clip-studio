import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {existsSync,mkdirSync,readFileSync,renameSync,rmSync,statSync,writeFileSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {availableParallelism} from 'node:os';
import {bundle} from '@remotion/bundler';
import {selectComposition,renderMedia} from '@remotion/renderer';
import {prepareRemotionProject} from './remotion-data.mjs';
import {exportEncodingOptions} from './export-quality.mjs';
import {preparePlayableVideoAssets} from './render-media-preflight.mjs';
import {prepareRenderImages} from './render-image-preflight.mjs';
import {browserLaunchError} from './remotion-browser-diagnostics.mjs';

const ROOT=resolve(import.meta.dirname),execute=promisify(execFile),CHUNK_FRAMES=1800;
const requestedConcurrency=Number.parseInt(process.env.CLIP_STUDIO_RENDER_CONCURRENCY||'2',10);
const renderConcurrency=Number.isFinite(requestedConcurrency)?Math.max(1,Math.min(availableParallelism(),requestedConcurrency)):2;
let bundlePromise;

async function probe(file,kind){
  try{
    const {stdout}=await execute('ffprobe',['-v','error','-select_streams',kind==='video'?'v:0':'a:0','-show_entries',kind==='video'?'stream=codec_name,nb_frames,duration':'stream=codec_name,duration','-of','json',file]);
    return JSON.parse(stdout).streams?.[0]||null;
  }catch{return null;}
}

async function validVideo(file,frames){
  if(!existsSync(file)||statSync(file).size<1024)return false;
  const stream=await probe(file,'video');
  return stream?.codec_name==='h264'&&Number(stream.nb_frames)===frames;
}

function checkpointKey(project,prepared,folder,quality){
  const hash=createHash('sha256').update('clip-studio-checkpoints-v1');
  const ids=new Set([...(project.scenes||[]).flatMap(scene=>[scene.assetId,scene.overlayId,scene.sfxId]),project.narrationId,project.musicId]);
  const assets=prepared.assets.filter(asset=>ids.has(asset.id)).map(asset=>({...asset,url:new URL(asset.url).pathname+new URL(asset.url).search}));
  hash.update(JSON.stringify({...prepared,fontBase:'/fonts',assets,quality}));
  for(const name of ['remotion/composition.jsx','remotion/transition-timing.mjs','remotion/transition-presentations.jsx','remotion/fonts.jsx','remotion/root.jsx'])hash.update(readFileSync(join(ROOT,name)));
  for(const asset of project.assets||[])if(ids.has(asset.id)){
    const stat=statSync(join(folder,'assets',asset.file));
    hash.update(`${asset.id}:${stat.size}:${stat.mtimeMs};`);
  }
  return hash.digest('hex').slice(0,24);
}

async function concatVideo(files,output){
  const manifest=join(dirname(output),'segments.ffconcat');
  writeFileSync(manifest,['ffconcat version 1.0',...files.map(file=>`file '${file.replaceAll("'","'\\''")}'`)].join('\n'));
  const temporary=`${output}.tmp.mp4`;
  try{
    await execute('ffmpeg',['-y','-hide_banner','-loglevel','error','-f','concat','-safe','0','-i',manifest,'-an','-c:v','copy','-movflags','+faststart',temporary],{maxBuffer:2_000_000});
    renameSync(temporary,output);
  }finally{rmSync(temporary,{force:true});}
}

export async function renderWithRemotion(project,folder,update){
  const renderStarted=performance.now(),timings={unit:'ms',videoPreflightMs:0,imagePreflightMs:0,bundleMs:0,compositionMs:0,videoRenderingMs:0,videoConcatMs:0,audioRenderMs:0,finalMuxMs:0,validationMs:0,videoSegments:[]};
  const timed=async(key,action)=>{const start=performance.now();try{return await action();}finally{timings[key]=Math.round(performance.now()-start);}};
  if(!project.scenes?.length)throw Error('Crea el storyboard antes de exportar');
  const missing=project.scenes.filter(s=>!project.assets.some(a=>a.id===s.assetId));
  if(missing.length)throw Error(`Faltan medios en ${missing.length} escenas`);
  const port=Number(process.env.PORT||4173),prepared=prepareRemotionProject(project,`http://127.0.0.1:${port}`);
  const work=join(folder,'renders');mkdirSync(work,{recursive:true});
  update(1,'Verificando compatibilidad de los videos');
  await timed('videoPreflightMs',()=>preparePlayableVideoAssets(project,folder,prepared,update));
  update(9,'Preparando imágenes para exportar');
  await timed('imagePreflightMs',()=>prepareRenderImages(project,folder,prepared,update));
  update(11,'Preparando la composición');
  bundlePromise??=bundle({entryPoint:join(ROOT,'remotion/root.jsx'),outDir:join(ROOT,'.remotion-bundle'),onProgress:p=>update(11+Math.round(Math.max(0,Math.min(100,p))*.14),`Preparando motor de video · ${Math.round(p)}%`)}).catch(e=>{bundlePromise=null;throw e;});
  const serveUrl=await timed('bundleMs',()=>bundlePromise),options={serveUrl};
  if(process.env.CLIP_STUDIO_CHROME)options.browserExecutable=process.env.CLIP_STUDIO_CHROME;
  const name=`video-${Date.now()}.mp4`,output=join(work,name),quality=exportEncodingOptions(project.settings);
  const checkpoint=join(work,'checkpoints',checkpointKey(project,prepared,folder,quality));
  mkdirSync(checkpoint,{recursive:true});
  const videoProps={project:{...prepared,videoOnly:true}};
  try{
    update(25,'Iniciando Chrome y preparando el render');
    const composition=await timed('compositionMs',()=>selectComposition({...options,id:'ClipStudio',inputProps:videoProps}));
    const totalFrames=composition.durationInFrames,segments=Math.ceil(totalFrames/CHUNK_FRAMES),files=[];
    for(let index=0;index<segments;index++){
      const from=index*CHUNK_FRAMES,to=Math.min(totalFrames-1,from+CHUNK_FRAMES-1),count=to-from+1;
      const file=join(checkpoint,`segment-${String(index).padStart(4,'0')}.mp4`);
      files.push(file);
      const segmentStarted=performance.now();
      if(await validVideo(file,count)){
        timings.videoSegments.push({index:index+1,frames:count,reused:true,durationMs:Math.round(performance.now()-segmentStarted)});
        update(25+Math.round((index+1)/segments*65),`Tramo ${index+1}/${segments} ya guardado`);
        continue;
      }
      const temporary=join(checkpoint,`segment-${String(index).padStart(4,'0')}.${process.pid}.tmp.mp4`);
      for(let attempt=1;attempt<=2;attempt++){
        try{
          update(25+Math.round(index/segments*65),`Renderizando tramo ${index+1}/${segments}${attempt>1?' · segundo intento':''}`);
          await renderMedia({...options,composition,inputProps:videoProps,codec:'h264',...quality,outputLocation:temporary,overwrite:true,muted:true,frameRange:[from,to],concurrency:renderConcurrency,timeoutInMilliseconds:90000,onProgress:({progress})=>update(25+Math.round((index+progress)/segments*65),`Renderizando tramo ${index+1}/${segments} · ${Math.round(progress*100)}%`)});
          if(!await validVideo(temporary,count))throw Error(`El tramo ${index+1} quedó incompleto`);
          renameSync(temporary,file);
          break;
        }catch(error){rmSync(temporary,{force:true});if(attempt===2)throw Error(`Falló el tramo ${index+1}/${segments}. Los anteriores quedaron guardados para reanudar. ${error.message}`);}
      }
      timings.videoSegments.push({index:index+1,frames:count,reused:false,durationMs:Math.round(performance.now()-segmentStarted)});
    }
    timings.videoRenderingMs=timings.videoSegments.reduce((sum,segment)=>sum+segment.durationMs,0);
    const visual=join(checkpoint,'visual.mp4');
    timings.videoConcatReused=await validVideo(visual,totalFrames);
    if(!timings.videoConcatReused){
      update(91,'Uniendo tramos de video');
      await timed('videoConcatMs',()=>concatVideo(files,visual));
      if(!await validVideo(visual,totalFrames))throw Error('La unión de tramos produjo un video incompleto');
    }
    const hasAudio=Boolean(project.narrationId||project.musicId||(project.scenes||[]).some(s=>s.sfxId));
    timings.hasAudio=hasAudio;
    if(hasAudio){
      const audio=join(checkpoint,'audio.m4a');
      timings.audioReused=!!await probe(audio,'audio');
      if(!timings.audioReused){
        update(94,'Mezclando voz, música y efectos');
        const temporary=join(checkpoint,`audio.${process.pid}.tmp.m4a`);
        try{
          const audioStarted=performance.now();
          const audioProps={project:{...prepared,audioOnly:true}};
          const audioComposition=await selectComposition({...options,id:'ClipStudio',inputProps:audioProps});
          await renderMedia({...options,composition:audioComposition,inputProps:audioProps,codec:'aac',audioBitrate:'192k',outputLocation:temporary,overwrite:true,concurrency:renderConcurrency,timeoutInMilliseconds:90000,onProgress:({progress})=>update(94+Math.round(progress*3),`Mezclando audio · ${Math.round(progress*100)}%`)});
          if(!await probe(temporary,'audio'))throw Error('No se pudo generar la pista de audio');
          renameSync(temporary,audio);
          timings.audioRenderMs=Math.round(performance.now()-audioStarted);
        }finally{rmSync(temporary,{force:true});}
      }
      update(98,'Uniendo video y audio');
      await timed('finalMuxMs',()=>execute('ffmpeg',['-y','-hide_banner','-loglevel','error','-i',visual,'-i',audio,'-map','0:v:0','-map','1:a:0','-c','copy','-movflags','+faststart',output],{maxBuffer:2_000_000}));
    }else{
      update(98,'Finalizando MP4');
      await timed('finalMuxMs',()=>execute('ffmpeg',['-y','-hide_banner','-loglevel','error','-i',visual,'-c','copy','-movflags','+faststart',output],{maxBuffer:2_000_000}));
    }
    if(!await timed('validationMs',()=>validVideo(output,totalFrames)))throw Error('El MP4 final quedó incompleto');
    rmSync(checkpoint,{recursive:true,force:true});
  }catch(error){
    rmSync(output,{force:true});
    const message=browserLaunchError(error);
    if(message){console.error('Error completo al iniciar Chrome para exportar:',error);throw Error(message);}
    throw error;
  }
  update(99,'MP4 listo');
  timings.renderMs=Math.round(performance.now()-renderStarted);
  return {name,duration:prepared.duration,width:prepared.width,height:prepared.height,createdAt:new Date().toISOString(),preview:false,timings};
}
