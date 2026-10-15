import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';

const exec=promisify(execFile);
const root=resolve(import.meta.dirname,'..');
const port=Number(process.env.PORT||4173);
const origin=`http://127.0.0.1:${port}`;
const timeoutMs=Number(process.env.SMOKE_RENDER_TIMEOUT_MS||600000);
const keep=process.env.SMOKE_KEEP_PROJECT==='1';
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));

async function api(path,options={}){
  const response=await fetch(`${origin}/api/studio${path}`,options);
  const data=await response.json().catch(()=>({}));
  if(!response.ok){const error=Error(data.error||`HTTP ${response.status}: ${path}`);error.status=response.status;throw error;}
  return data;
}
const json=(method,value)=>({method,headers:{'content-type':'application/json'},body:JSON.stringify(value)});

async function pollTask(projectId,taskId){
  const path=`/projects/${projectId}/tasks/${taskId}`;
  for(let attempt=1;attempt<=10;attempt++){
    try{return await api(path);}
    catch(error){
      if(error.status===404)throw Error('La tarea desapareció del servidor. Probablemente la app se reinició durante el render; revisa los registros de su servicio en el VPS. El proyecto temporal se conservó.');
      if(error.status)throw error;
      if(attempt===10)throw Error(`Se perdió la conexión con la app durante el render tras ${attempt} intentos: ${error.message}. Revisa los registros del servicio y los eventos OOM del VPS. El proyecto temporal se conservó.`);
      if(attempt===1)console.warn('Se cortó la conexión local con la app; esperando a que vuelva a responder…');
      await pause(1500);
    }
  }
}

async function makeInputs(folder){
  const image=join(folder,'smoke-image.png'),video=join(folder,'smoke-video.mp4');
  await exec('ffmpeg',['-y','-hide_banner','-loglevel','error','-f','lavfi','-i','color=c=steelblue:s=1280x720:d=0.1','-frames:v','1',image]);
  await exec('ffmpeg',['-y','-hide_banner','-loglevel','error','-f','lavfi','-i','testsrc2=s=1280x720:r=30:d=3','-c:v','libx264','-preset','ultrafast','-crf','23','-pix_fmt','yuv420p',video]);
  return [image,video];
}

async function upload(projectId,file){
  const name=file.endsWith('.png')?'smoke-image.png':'smoke-video.mp4';
  return api(`/projects/${projectId}/assets?name=${encodeURIComponent(name)}`,{method:'POST',body:await readFile(file)});
}

async function verifyVideo(file){
  const {stdout}=await exec('ffprobe',['-v','error','-select_streams','v:0','-show_entries','stream=codec_name,width,height,nb_frames:format=duration','-of','json',file]);
  const data=JSON.parse(stdout),stream=data.streams?.[0],duration=Number(data.format?.duration);
  if(stream?.codec_name!=='h264'||stream.width!==1280||stream.height!==720||duration<3||duration>5||Number(stream.nb_frames)<90){
    throw Error(`El MP4 no cumple la verificación de formato: ${JSON.stringify(data)}`);
  }
  const {stderr}=await exec('ffmpeg',['-hide_banner','-i',file,'-vf','blackdetect=d=0.05:pix_th=0.02','-an','-f','null','-'],{maxBuffer:2_000_000});
  if(/black_start:/.test(stderr))throw Error('El MP4 contiene fotogramas negros completos durante la transición');
  return {duration,frames:Number(stream.nb_frames),width:stream.width,height:stream.height};
}

let projectId=null,taskStatus=null;
const folder=await mkdtemp(join(tmpdir(),'clip-studio-smoke-'));
try{
  const [image,video]=await makeInputs(folder);
  const project=await api('/projects',json('POST',{title:'Prueba temporal de render React'}));
  projectId=project.id;
  const [photo,clip]=[await upload(projectId,image),await upload(projectId,video)];
  const cues=[{id:1,start:0,end:2,text:'Primera escena de prueba.'},{id:2,start:2,end:4,text:'Segunda escena de prueba.'}];
  const scene=(id,start,end,assetId)=>({id,start,end,text:cues[id-1].text,cueStart:id-1,cueEnd:id-1,chapterId:null,chapterSceneIndex:id-1,searchTerm:'',assetId,sourceStart:0,fit:'fill',blur:20,motion:'static',effect:'none',transition:'remotion:none',transitionDuration:.45,sfxId:null});
  await api(`/projects/${projectId}`,json('PUT',{cues,sourceCues:cues,subtitleCues:cues,scenes:[scene(1,0,2,photo.id),scene(2,2,4,clip.id)],settings:{...project.settings,ratio:'16:9',quality:'720p',captions:true,transitionSequence:['remotion:slide:bottom']}}));
  const task=await api(`/projects/${projectId}/render`,json('POST',{}));
  const started=Date.now();let last='';
  while(Date.now()-started<timeoutMs){
    taskStatus=await pollTask(projectId,task.id);
    const line=`${taskStatus.progress}% · ${taskStatus.detail}`;
    if(line!==last){console.log(line);last=line;}
    if(taskStatus.status==='error')throw Error(taskStatus.error||'Falló el render');
    if(taskStatus.status==='done')break;
    await pause(1500);
  }
  if(taskStatus?.status!=='done')throw Error(`El render superó ${Math.round(timeoutMs/1000)} segundos. Proyecto temporal: ${projectId}`);
  const saved=await api(`/projects/${projectId}`),result=saved.exports?.[0];
  if(!result?.name||!Number.isFinite(result.renderDurationMs))throw Error('La exportación no guardó el MP4 y su duración');
  const file=join(root,'data','studio',projectId,'renders',result.name),verified=await verifyVideo(file);
  console.log(`MP4 verificado: ${verified.width}×${verified.height}, ${verified.frames} fotogramas, ${verified.duration.toFixed(2)} s. Render: ${(result.renderDurationMs/1000).toFixed(1)} s.`);
  if(keep)console.log(`Proyecto conservado para inspección: ${projectId}`);
}finally{
  await rm(folder,{recursive:true,force:true});
  if(projectId&&!keep&&taskStatus?.status!=='running'){
    try{await api(`/projects/${projectId}`,{method:'DELETE'});console.log('Proyecto temporal eliminado.');}
    catch(error){console.error(`No se pudo eliminar el proyecto temporal ${projectId}: ${error.message}`);}
  }else if(projectId&&taskStatus?.status==='running')console.error(`No se confirmó el estado final del render; proyecto temporal conservado: ${projectId}`);
}
