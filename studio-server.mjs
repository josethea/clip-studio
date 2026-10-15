import {createReadStream,createWriteStream,existsSync,mkdirSync,readFileSync,writeFileSync,readdirSync,statSync,rmSync} from 'node:fs';
import {join,basename,extname,resolve} from 'node:path';
import {pipeline} from 'node:stream/promises';
import {spawn} from 'node:child_process';
import {randomUUID,createHash} from 'node:crypto';
import {parseSrt,serializeSrt,planAudioGaps,transitionSeconds} from './studio-core.mjs';
import {exportCapCut} from './capcut-export.mjs';
import {GeminiHttpError,withGeminiRetry} from './gemini-retry.mjs';
import {renderWithRemotion} from './remotion-render.mjs';
import {signedStoryblocksUrl,rankStoryblocks,storyblocksDimensions,bestStoryblocksMp4,bestStoryblocksImage} from './storyblocks-api.mjs';
import {pexelsSearchItems} from './stock-resolution.mjs';
import {downloadGoogleImage} from './google-image-filter.mjs';
import {screenLocalImage,releaseIdleImageWorkers} from './local-image-screening.mjs';
import {runMediaAutofillLanes} from './media-autofill-lanes.mjs';
import {previewIsReady,schedulePreview} from './preview-optimizer.mjs';

const ROOT=resolve(import.meta.dirname),DATA=join(ROOT,'data','studio'),TEMPLATE_STORE=join(DATA,'text-templates.json');mkdirSync(DATA,{recursive:true});
const projects=new Map(),tasks=new Map();
const googleJobs=new Map();
let googleBridgeSeen=0;
for(const name of readdirSync(DATA)){try{const p=JSON.parse(readFileSync(join(DATA,name,'project.json'),'utf8'));projects.set(p.id,p);}catch{}}
const clean=(s,n=120)=>String(s||'').replace(/[\u0000-\u001f/\\]/g,' ').trim().slice(0,n);
const slug=s=>clean(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9._-]+/g,'-').replace(/^-+|-+$/g,'')||'archivo';
const json=(res,code,data)=>{const body=JSON.stringify(data);res.writeHead(code,{'content-type':'application/json; charset=utf-8','content-length':Buffer.byteLength(body),'cache-control':'no-store'});res.end(body);};
const readJson=async req=>{let text='';for await(const chunk of req){text+=chunk;if(text.length>10_000_000)throw Error('Solicitud demasiado grande');}return JSON.parse(text||'{}');};
const dirOf=p=>join(DATA,p.id);
const save=p=>{p.updatedAt=new Date().toISOString();writeFileSync(join(dirOf(p),'project.json'),JSON.stringify(p,null,2));};
const run=(bin,args,onLine,{signal}={})=>new Promise((done,reject)=>{const cache=join(DATA,'.swift-cache');mkdirSync(cache,{recursive:true});const child=spawn(bin,args,{stdio:['ignore','pipe','pipe'],signal,env:{...process.env,CLANG_MODULE_CACHE_PATH:cache,SWIFT_MODULECACHE_PATH:cache}});let log='';for(const stream of [child.stdout,child.stderr])stream.on('data',part=>{const s=String(part);log=(log+s).slice(-5000);onLine?.(s);});child.on('error',reject);child.on('close',code=>code===0?done(log):reject(Error(`${bin}: ${log.slice(-1000)}`)));});
const probe=async(path,signal)=>{let result=await run('ffprobe',['-v','error','-show_entries','format=duration:stream=codec_type,width,height','-of','json',path],null,{signal});let data=JSON.parse(result);return {duration:Number(data.format?.duration||0),width:data.streams?.find(x=>x.codec_type==='video')?.width||0,height:data.streams?.find(x=>x.codec_type==='video')?.height||0,audio:data.streams?.some(x=>x.codec_type==='audio')||false};};
const asset=(p,id)=>p.assets.find(a=>a.id===id);
const assetPath=(p,id)=>{const found=asset(p,id);if(!found)throw Error(`Falta el asset ${id}`);return join(dirOf(p),'assets',found.file);};
const renderSignature=p=>createHash('sha256').update(JSON.stringify({scenes:p.scenes,assets:p.assets,cues:p.cues,subtitleCues:p.subtitleCues,textLayers:p.textLayers,narrationId:p.narrationId,musicId:p.musicId,settings:p.settings})).digest('hex');
const task=(p,kind,action)=>{const t={id:randomUUID(),projectId:p.id,kind,status:'running',progress:0,detail:'Preparando',createdAt:new Date().toISOString(),error:null,result:null};tasks.set(t.id,t);const update=(progress,detail)=>{t.progress=progress;t.detail=detail;writeFileSync(join(dirOf(p),`task-${t.id}.json`),JSON.stringify(t));};update(0,'Preparando');Promise.resolve().then(()=>action(update,t)).then(result=>{t.status='done';t.result=result;update(100,'Terminado');}).catch(e=>{t.status='error';t.error=String(e.message||e);update(t.progress,'Error: '+t.error);});return t;};
function streamFile(req,res,path,type,{immutable=false,cacheControl}={}){if(!existsSync(path)){json(res,404,{error:'Archivo no encontrado'});return;}const size=statSync(path).size,range=req.headers.range,headers={'content-type':type,'accept-ranges':'bytes',...(immutable||cacheControl?{'cache-control':cacheControl||'private, max-age=86400, immutable'}:{})};
  if(range){const match=/^bytes=(\d*)-(\d*)$/.exec(range);let start=Number(match?.[1]||0),end=match?.[2]?Number(match[2]):size-1;if(match&&!match[1]&&match[2]){start=Math.max(0,size-Number(match[2]));end=size-1;}if(!match||start>=size||end<start){res.writeHead(416,{...headers,'content-range':`bytes */${size}`});res.end();return;}end=Math.min(end,size-1);res.writeHead(206,{...headers,'content-length':end-start+1,'content-range':`bytes ${start}-${end}/${size}`});if(req.method==='HEAD')res.end();else createReadStream(path,{start,end}).pipe(res);return;}
  res.writeHead(200,{...headers,'content-length':size});if(req.method==='HEAD')res.end();else createReadStream(path).pipe(res);}
async function exportProject(p,update,requestElapsedMs=0){
  const startedAt=performance.now();
  const result=await renderWithRemotion(p,dirOf(p),update);
  result.renderDurationMs=Math.round(performance.now()-startedAt+requestElapsedMs);
  p.exports=p.exports||[];p.exports.unshift(result);save(p);return result;
}

async function adjustAudio(p,input,update){
  const source=assetPath(p,p.narrationId),meta=await probe(source),cues=p.cues||[];
  const target=Array.isArray(input.gapMs)?input.gapMs.map(Number).map(ms=>ms/1000):Number(input.pauseMs)/1000;
  const plan=planAudioGaps(cues,target,meta.duration);
  const work=join(dirOf(p),'renders');mkdirSync(work,{recursive:true});const stamp=Date.now(),output=join(dirOf(p),'assets',`audio-ajustado-${stamp}.wav`),srt=join(work,`transcript-ajustado-${stamp}.srt`);
  const intervals=[];let cursor=0;for(const cut of plan.cuts){if(cut.start>cursor)intervals.push([cursor,cut.start]);cursor=cut.end;}if(cursor<meta.duration)intervals.push([cursor,meta.duration]);
  const filters=intervals.map(([start,end],i)=>`[0:a]atrim=start=${start.toFixed(4)}:end=${end.toFixed(4)},asetpts=PTS-STARTPTS[a${i}]`);
  filters.push(`${intervals.map((_,i)=>`[a${i}]`).join('')}concat=n=${intervals.length}:v=0:a=1[a]`);
  update(30,'Recortando silencios');await run('ffmpeg',['-y','-hide_banner','-loglevel','error','-i',source,'-filter_complex',filters.join(';'),'-map','[a]','-c:a','pcm_s16le',output]);
  const shift=time=>time-plan.cuts.reduce((sum,cut)=>sum+Math.max(0,Math.min(time,cut.end)-cut.start),0);
  const shiftCues=list=>(list||[]).map(c=>({...c,start:shift(c.start),end:shift(c.end)}));
  const adjustedCues=shiftCues(cues),adjustedSubtitles=shiftCues(p.subtitleCues?.length?p.subtitleCues:cues);
  const adjustedScenes=(p.scenes||[]).map(scene=>({...scene,start:shift(scene.start),end:shift(scene.end)}));
  const adjustedChapters=(p.chapters||[]).map(chapter=>({...chapter,start:chapter.start==null?null:shift(chapter.start),end:chapter.end==null?null:shift(chapter.end)}));
  writeFileSync(srt,serializeSrt(adjustedCues));const record={id:randomUUID(),name:basename(output),type:'audio',file:basename(output),...(await probe(output))};
  p.assets.push(record);p.narrationId=record.id;p.cues=adjustedCues;p.sourceCues=shiftCues(p.sourceCues);p.subtitleCues=adjustedSubtitles;p.scenes=adjustedScenes;p.chapters=adjustedChapters;p.textLayers=shiftCues(p.textLayers);
  if(p.wordsJson?.words)p.wordsJson={...p.wordsJson,words:p.wordsJson.words.map(word=>({...word,start:Number.isFinite(Number(word.start))?shift(Number(word.start)):word.start,end:Number.isFinite(Number(word.end))?shift(Number(word.end)):word.end}))};
  const created={audio:basename(output),audioId:record.id,srt:basename(srt),removed:plan.removed,duration:plan.duration,cuts:plan.cuts.length};p.adjustments=p.adjustments||[];p.adjustments.unshift(created);save(p);return created;
}

async function downloadChapters(p,config,update){
  const chapters=Array.isArray(config.chapters)?config.chapters:[],items=chapters.flatMap((c,ci)=>(c.urls||[]).map(url=>({chapter:c.chapter||c.name||`Capítulo ${ci+1}`,url})));
  if(!items.length)throw Error('Agrega al menos un enlace de YouTube');
  const duration=Number(config.clipDuration)||5,start=Math.max(1,Number(config.startIndex)||1),delay=Math.max(0,Number(config.delay)||0),cookie=String(config.cookieBrowser||'none');
  if(duration<.5||duration>3600)throw Error('Duración de clip inválida');
  const folder=join(dirOf(p),'sources');mkdirSync(folder,{recursive:true});let added=0;
  for(let i=start-1;i<items.length;i++){
    const item=items[i];const host=new URL(item.url).hostname.toLowerCase();if(!(['youtube.com','www.youtube.com','m.youtube.com','youtu.be'].includes(host)))throw Error(`URL de YouTube inválida: ${item.url}`);
    const base=`source-${String(i+1).padStart(3,'0')}`,pattern=join(folder,`${base}.%(ext)s`),args=['--no-playlist','-f','bv*+ba/b','--merge-output-format','mp4','-o',pattern];if(cookie!=='none')args.push('--cookies-from-browser',cookie);args.push(item.url);
    update(5+Math.round((i-start+1)/items.length*85),`Descargando ${i+1}/${items.length}: ${item.chapter}`);
    if(!readdirSync(folder).some(n=>n.startsWith(base+'.')))await run('yt-dlp',args);
    const source=join(folder,readdirSync(folder).find(n=>n.startsWith(base+'.')&&!n.endsWith('.part'))||'');const meta=await probe(source),count=Math.ceil(meta.duration/duration),chapterFolder=join(folder,slug(item.chapter));mkdirSync(chapterFolder,{recursive:true});
    for(let j=0;j<count;j++){
      const length=Math.min(duration,meta.duration-j*duration);if(length<.25)continue;const name=`${base}-clip-${String(j+1).padStart(4,'0')}.mp4`,out=join(chapterFolder,name);
      if(!existsSync(out))await run('ffmpeg',['-y','-hide_banner','-loglevel','error','-ss',String(j*duration),'-t',String(length),'-i',source,'-vf','hflip','-an','-c:v','libx264','-preset','veryfast','-crf','22','-pix_fmt','yuv420p','-force_key_frames','expr:gte(t,n_forced*1)','-movflags','+faststart',out]);
      if(!p.assets.some(a=>a.file===`../sources/${slug(item.chapter)}/${name}`)){p.assets.push({id:randomUUID(),name,chapter:item.chapter,type:'video',file:`../sources/${slug(item.chapter)}/${name}`,duration:length,width:meta.width,height:meta.height,source:item.url});added++;}
    }
    save(p);if(i<items.length-1&&delay)await new Promise(done=>setTimeout(done,delay*1000));
  }
  return {added,total:items.length,from:start};
}

async function findStoryblocks(p,{publicKey,secretKey,query,type='videos',page=1}){
  if(!publicKey||!secretKey||!query)throw Error('Introduce las claves de Storyblocks y un término de búsqueda');
  const images=type==='photos',path=images?'/api/v2/images/search':'/api/v2/videos/search';
  const params={project_id:p.id,user_id:'local-user',keywords:query,content_type:images?'photos':'footage',extended:images?'download_formats,aspectRatio':'download_formats,aspectRatio,maxResolution',results_per_page:100,page};
  const response=await fetch(signedStoryblocksUrl(path,params,publicKey,secretKey),{signal:AbortSignal.timeout(30000)});
  const data=await response.json();if(!response.ok)throw Error(data.message||data.error||`Storyblocks respondió ${response.status}`);
  const items=rankStoryblocks(data.results||[],images?'image':'video').map(x=>{const size=storyblocksDimensions(x,images?'image':'video');return {id:x.id,type:images?'image':'video',name:x.title||`Storyblocks ${x.id}`,preview:x.thumbnail_url||x.preview_url||'',previewVideo:images?'':x.preview_urls?._720p||x.preview_urls?._480p||'',width:size.width,height:size.height,orientation:x.orientation||'',aspectRatio:x.aspectRatio||'',duration:images?0:Number(x.duration)||0,provider:'storyblocks'};});
  return {items,total:Number(data.total_results||items.length),page};
}

async function importStoryblocks(p,{stockId,name,publicKey,secretKey,type='video',sceneIndex,sourceDuration=0}){
  if(!Number.isInteger(stockId)||stockId<=0||!publicKey||!secretKey)throw Error('Selecciona un medio e introduce las claves de Storyblocks');
  const mediaType=type==='image'?'image':'video',source=`storyblocks:${mediaType}:${stockId}`;
  const needed=mediaType==='video'?sceneClipLength(p,sceneIndex):0;
  const existing=p.assets.find(a=>a.source===source&&(mediaType==='image'||a.clipLength&&Math.abs(a.clipLength-needed)<.05));if(existing)return existing;
  const path=`/api/v2/${mediaType==='image'?'images':'videos'}/stock-item/download/${stockId}`;
  const response=await fetch(signedStoryblocksUrl(path,{project_id:p.id,user_id:'local-user'},publicKey,secretKey),{signal:AbortSignal.timeout(30000)});
  const data=await response.json();if(!response.ok)throw Error(data.message||data.error||`Storyblocks respondió ${response.status}`);
  const selected=mediaType==='image'?bestStoryblocksImage(data):{url:bestStoryblocksMp4(data),format:'MP4'};
  if(!selected?.url)throw Error(`Storyblocks no ofrece ${mediaType==='image'?'una imagen':'un MP4'} descargable`);
  const remote=new URL(selected.url);if(remote.protocol!=='https:'||!/(^|\.)(cloudfront\.net|storyblocks\.com)$/.test(remote.hostname))throw Error('URL de descarga de Storyblocks inválida');
  const id=randomUUID(),file=`${id}.${mediaType==='image'?(selected.format==='PNG'?'png':'jpg'):'mp4'}`,dest=join(dirOf(p),'assets',file);
  try{
    if(mediaType==='video'){
      const args=['-y','-hide_banner','-loglevel','error'];
      if(Number(sourceDuration)>0&&Number(sourceDuration)<needed)args.push('-stream_loop','-1');
      args.push('-i',remote.href,'-t',needed.toFixed(3),'-an','-c:v','libx264','-preset','veryfast','-crf','18','-pix_fmt','yuv420p','-force_key_frames','expr:gte(t,n_forced*1)','-movflags','+faststart',dest);
      await run('ffmpeg',args);
    }else{
      const download=await fetch(remote);if(!download.ok||!download.body)throw Error(`No se pudo descargar Storyblocks: ${download.status}`);
      await pipeline(download.body,createWriteStream(dest));
    }
    const meta=await probe(dest);if(mediaType==='video'&&meta.duration+0.08<needed)throw Error('El video de Storyblocks no alcanza la duración del bloque');
    const record={id,name:clean(name||`Storyblocks ${stockId}`),type:mediaType,file,...meta,source,clipLength:mediaType==='video'?needed:undefined};p.assets.push(record);save(p);return record;
  }catch(error){rmSync(dest,{force:true});throw error;}
}

async function autofillStoryblocks(p,config,update){
  const publicKey=String(config.publicKey||'').trim(),secretKey=String(config.secretKey||'').trim();
  if(!publicKey||!secretKey)throw Error('Introduce ambas claves de Storyblocks en la barra lateral');
  if(!p.scenes?.length)throw Error('Primero crea el storyboard');
  const start=Math.max(0,Math.floor(Number(config.startIndex||1)-1)),mode=['mixed','photos','videos'].includes(config.mode)?config.mode:'mixed';
  const missing=p.scenes.map((scene,i)=>({scene,i})).filter(({scene,i})=>i>=start&&!(scene.assetId&&asset(p,scene.assetId))&&String(scene.searchTerm||scene.text||'').trim());
  let added=0,searched=0;
  for(const {scene,i} of missing){
    const chapter=p.chapters.find(c=>c.id===scene.chapterId),query=String(scene.searchTerm||chapter?.searchTerms?.[(scene.chapterSceneIndex||0)%(chapter.searchTerms?.length||1)]||scene.text||'').trim();
    if(!query)continue;
    const type=mode==='mixed'?(i%4===3?'videos':'photos'):mode;
    update(5+Math.round(searched/Math.max(1,missing.length)*90),`Storyblocks · escena ${i+1}/${p.scenes.length} · ${type==='photos'?'foto':'video'} · ${query}`);
    const result=await findStoryblocks(p,{publicKey,secretKey,query,type});searched++;
    const chosen=result.items[0];
    if(chosen){const record=await importStoryblocks(p,{stockId:Number(chosen.id),name:chosen.name,publicKey,secretKey,type:chosen.type,sceneIndex:i,sourceDuration:chosen.duration});scene.assetId=record.id;scene.sourceStart=0;added++;save(p);}
    if(searched%50===0&&searched<missing.length)for(let remaining=30;remaining>0;remaining--){update(5+Math.round(searched/Math.max(1,missing.length)*90),`Pausa de Storyblocks: ${remaining} s · ${searched} búsquedas completadas`);await new Promise(done=>setTimeout(done,1000));}
  }
  return {added,searched,from:start+1,total:p.scenes.length};
}

function queueGoogleJob(p,query,sceneIndex,{firstOnly=false}={}){
  if(Date.now()-googleBridgeSeen>15000)throw Error('Conecta la extensión Google Images a esta app antes de buscar');
  for(const [id,old] of googleJobs)if(Date.now()-old.createdAt>86_400_000){googleJobs.delete(id);try{rmSync(join(dirOf(projects.get(old.projectId)),'google-candidates',id),{recursive:true,force:true});}catch{}}
  const job={id:randomUUID(),projectId:p.id,query:String(query||'').trim().slice(0,180),sceneIndex,firstOnly,status:'queued',progress:0,detail:'Esperando a la extensión',items:[],rejected:[],createdAt:Date.now(),leaseUntil:0};
  if(!job.query)throw Error('Escribe un término de búsqueda');
  googleJobs.set(job.id,job);return job;
}
function publicGoogleJob(job){return {...job,items:job.items.map(({file,...item})=>item)};}
async function screenGoogleImage(file,sourceUrl,signal){
  const preview=`${file}-analysis.jpg`;
  try{
    await run('ffmpeg',['-y','-hide_banner','-loglevel','error','-i',file,'-vf','scale=1600:1600:force_original_aspect_ratio=decrease','-frames:v','1','-q:v','3',preview],null,{signal});
    const size=await probe(preview,signal);
    try{return await screenLocalImage(preview,size.width,size.height,{maxTextFraction:.10,sourceUrl,signal});}
    catch(error){if(error.name!=='AbortError')error.code='OCR_FAILED';throw error;}
  }finally{rmSync(preview,{force:true});}
}
async function processGoogleCandidates(job,candidates){
  const p=projects.get(job.projectId);if(!p)throw Error('Proyecto no encontrado');
  const folder=join(dirOf(p),'google-candidates',job.id);mkdirSync(folder,{recursive:true});
  job.status='screening';job.detail='Analizando imágenes';
  const unique=[...new Set((Array.isArray(candidates)?candidates:[]).map(x=>typeof x==='string'?x:x?.url).filter(Boolean))].slice(0,10);
  const candidate=async(url,signal)=>{
    let file='';
    try{
      const downloaded=await downloadGoogleImage(url,{signal}),ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/avif':'avif','image/gif':'gif'}[downloaded.mime],id=randomUUID();
      signal?.throwIfAborted();
      file=join(folder,`${id}.${ext}`);writeFileSync(file,downloaded.bytes);
      const meta=await probe(file,signal);if(meta.width<640||meta.height<360)throw Error('Resolución insuficiente');
      const screening=await screenGoogleImage(file,downloaded.url,signal);
      if(!screening.approved)throw Error(screening.reason||'Texto, logo o marca de agua');
      return {id,name:`Google Images · ${new URL(downloaded.url).hostname}`,type:'image',preview:`/api/studio/projects/${p.id}/google-candidates/${job.id}/${id}`,source:downloaded.url,width:meta.width,height:meta.height,analysis:screening,file};
    }catch(error){if(file)rmSync(file,{force:true});throw error;}
  };
  for(let start=0;start<unique.length&&job.items.length<(job.firstOnly?1:5);start+=5){
    const urls=unique.slice(start,start+5),controller=new AbortController();let selected=false;
    job.progress=Math.round(start/Math.max(1,unique.length)*95);
    job.detail=`Analizando ${start+1}–${start+urls.length}/${unique.length} · ${job.items.length} aptas`;
    const results=await Promise.all(urls.map(async url=>{
      try{const item=await candidate(url,controller.signal);if(job.firstOnly){if(selected){rmSync(item.file,{force:true});return null;}selected=true;controller.abort();}return item;}
      catch(error){if(error.name==='AbortError'||controller.signal.aborted)return null;if(error.code==='OCR_FAILED')throw Error(`El detector local falló: ${error.message}`);job.rejected.push(String(error.message||error).slice(0,160));return null;}
    }).map(promise=>promise.catch(error=>({fatal:error}))));
    const fatal=results.find(result=>result?.fatal);if(fatal)throw fatal.fatal;
    job.items.push(...results.filter(result=>result&&!result.fatal).slice(0,5-job.items.length));
    job.progress=Math.round(Math.min(unique.length,start+urls.length)/Math.max(1,unique.length)*95);
  }
  job.status='done';job.progress=100;job.detail=`${job.items.length} imágenes aptas · ${job.rejected.length} descartadas`;
}
async function importGoogleCandidate(p,job,candidate,sceneIndex){
  if(!job||job.projectId!==p.id||!['screening','done'].includes(job.status)||!candidate)throw Error('Selecciona una imagen validada');
  const scene=p.scenes[sceneIndex];if(!scene)throw Error('Escena no encontrada');
  const id=randomUUID(),file=`${id}.png`,dest=join(dirOf(p),'assets',file);
  await run('ffmpeg',['-y','-hide_banner','-loglevel','error','-i',candidate.file,'-vf','hflip','-frames:v','1',dest]);
  const meta=await probe(dest),record={id,name:candidate.name,type:'image',file,...meta,source:candidate.source,mirrored:true,screening:candidate.analysis};
  p.assets.push(record);scene.assetId=id;save(p);return record;
}
async function autofillGoogle(p,config,update){
  const start=Math.max(0,Math.floor(Number(config.startIndex||1)-1));
  let added=0,searched=0;
  for(let i=start;i<p.scenes.length;i++){
    const scene=p.scenes[i];if(scene.assetId&&asset(p,scene.assetId))continue;
    const query=String(scene.searchTerm||scene.text||'').trim();if(!query)continue;
    const job=queueGoogleJob(p,query,i);searched++;
    while(['queued','leased','screening'].includes(job.status)){
      if(Date.now()-job.createdAt>600000){job.status='error';job.detail='La búsqueda tardó más de 10 minutos. Comprueba la extensión y vuelve a intentar.';break;}
      update(5+Math.round((i-start)/Math.max(1,p.scenes.length-start)*90),`Google Images · escena ${i+1}/${p.scenes.length} · ${job.detail}`);
      await new Promise(done=>setTimeout(done,1200));
    }
    if(job.status==='done'&&job.items.length){await importGoogleCandidate(p,job,job.items[0],i);added++;}
    else if(job.status==='error')throw Error(`Escena ${i+1}: ${job.detail}`);
  }
  return {added,searched,from:start+1,total:p.scenes.length};
}

function validateAutofillSequence(sequence,keys){
  if(!Array.isArray(sequence)||!sequence.length||sequence.length>40)throw Error('Agrega entre 1 y 40 fuentes a la secuencia');
  const entries=sequence.map((entry,index)=>{
    const type=entry?.type,provider=entry?.provider;
    if(!['photos','videos'].includes(type)||!['google','pexels','storyblocks'].includes(provider)||type==='videos'&&provider==='google')throw Error(`Fuente ${index+1} inválida`);
    return {type,provider};
  });
  if(entries.some(entry=>entry.provider==='pexels')&&!String(keys.pexelsKey||'').trim())throw Error('Falta la clave de Pexels');
  if(entries.some(entry=>entry.provider==='storyblocks')&&(!String(keys.storyblocksPublic||'').trim()||!String(keys.storyblocksSecret||'').trim()))throw Error('Faltan las claves pública y secreta de Storyblocks');
  if(entries.some(entry=>entry.provider==='google')&&Date.now()-googleBridgeSeen>15000)throw Error('Conecta la extensión Google Images a esta app antes de completar los medios');
  return entries;
}

async function findPexelsForAutofill(query,type,key){
  const endpoint=new URL(type==='photos'?'https://api.pexels.com/v1/search':'https://api.pexels.com/v1/videos/search');
  endpoint.search=new URLSearchParams({query,per_page:'80',page:'1'}).toString();
  const response=await fetch(endpoint,{headers:{Authorization:key},signal:AbortSignal.timeout(30000)});
  const data=await response.json();if(!response.ok)throw Error(data.error||`Pexels respondió ${response.status}`);
  return pexelsSearchItems(data,type)[0];
}

function sceneClipLength(p,sceneIndex){
  const scene=p.scenes[sceneIndex];if(!scene)throw Error('Selecciona una escena para recortar el video');
  return Math.max(.1,scene.end-scene.start+(sceneIndex>0?transitionSeconds(p,sceneIndex-1)/2:0)+transitionSeconds(p,sceneIndex)/2+.12);
}
async function importPexelsForAutofill(p,item,sceneIndex){
  const needed=item.type==='video'?sceneClipLength(p,sceneIndex):0;
  const existing=p.assets.find(a=>a.source===item.source&&(item.type!=='video'||a.type==='video'&&a.clipLength&&Math.abs(a.clipLength-needed)<.05));if(existing)return existing;
  const url=new URL(item.url);if(url.protocol!=='https:'||!/(^|\.)pexels\.com$/.test(url.hostname))throw Error('URL de Pexels inválida');
  const id=randomUUID(),file=`${id}${item.type==='image'?'.jpg':'.mp4'}`,dest=join(dirOf(p),'assets',file);
  try{
    if(item.type==='video'){
      const start=Math.max(0,Number(item.sourceStart)||0);
      const args=['-y','-hide_banner','-loglevel','error'];
      if(Number(item.duration)>0&&Number(item.duration)<needed+start)args.push('-stream_loop','-1');
      args.push('-ss',String(start),'-i',url.href,'-t',needed.toFixed(3),'-an','-c:v','libx264','-preset','veryfast','-crf','18','-pix_fmt','yuv420p','-force_key_frames','expr:gte(t,n_forced*1)','-movflags','+faststart',dest);
      await run('ffmpeg',args);
    }else{
      const response=await fetch(url,{signal:AbortSignal.timeout(120000)});if(!response.ok||!response.body)throw Error(`No se pudo descargar Pexels: ${response.status}`);
      await pipeline(response.body,createWriteStream(dest));
    }
    const meta=await probe(dest);if(item.type==='video'&&meta.duration+0.08<needed)throw Error('El video de Pexels no alcanza la duración del bloque');
    const record={id,name:item.name,type:item.type,file,...meta,source:item.source,creator:item.creator||'',sourceStart:0,clipLength:item.type==='video'?needed:undefined};p.assets.push(record);save(p);return record;
  }
  catch(error){rmSync(dest,{force:true});throw error;}
}

async function autofillSequence(p,config,update,t){
  if(!p.scenes?.length)throw Error('Primero crea el storyboard');
  const sequence=validateAutofillSequence(config.sequence,config);
  const start=Math.max(0,Math.floor(Number(config.startIndex||1)-1));
  const missing=p.scenes.map((scene,i)=>({scene,i})).filter(({scene,i})=>i>=start&&!(scene.assetId&&asset(p,scene.assetId)));
  const planned=missing.map((item,ordinal)=>({...item,ordinal,choice:sequence[ordinal%sequence.length]}));
  let added=0,searched=0,completed=0,storyblocksSearches=0,storyblocksGate=Promise.resolve();
  const settled=new Set();
  t.currentScene=missing[0]?.i??start;t.completedScene=start-1;t.completedCount=0;
  // Serialize only Storyblocks search admission, not its network request or video encoding.
  // The 30-second pause therefore applies after every 50 searches across all lanes.
  const storyblocksSlot=()=>{
    const slot=storyblocksGate.then(async()=>{
      if(storyblocksSearches>0&&storyblocksSearches%50===0){
        for(let seconds=30;seconds>0;seconds--){update(t.progress,`Pausa de Storyblocks: ${seconds} s · ${added} medios asignados`);await new Promise(done=>setTimeout(done,1000));}
      }
      storyblocksSearches++;
    });
    storyblocksGate=slot.catch(()=>{});
    return slot;
  };
  try{await runMediaAutofillLanes(planned,async({scene,i,choice})=>{
    const chapter=p.chapters.find(c=>c.id===scene.chapterId);
    const query=String(scene.searchTerm||chapter?.searchTerms?.[(scene.chapterSceneIndex||0)%(chapter.searchTerms?.length||1)]||scene.text||'').trim();
    update(Math.round(5+completed/Math.max(1,missing.length)*90),`Escena ${i+1}/${p.scenes.length} · ${choice.provider} ${choice.type==='photos'?'imagen':'video'} · ${query||'sin término'}`);
    if(query){
      searched++;
      if(choice.provider==='storyblocks'){
        await storyblocksSlot();
        const result=await findStoryblocks(p,{publicKey:config.storyblocksPublic,secretKey:config.storyblocksSecret,query,type:choice.type});
        const chosen=result.items[0];if(chosen){const record=await importStoryblocks(p,{stockId:Number(chosen.id),name:chosen.name,publicKey:config.storyblocksPublic,secretKey:config.storyblocksSecret,type:chosen.type,sceneIndex:i,sourceDuration:chosen.duration});scene.assetId=record.id;scene.sourceStart=0;added++;save(p);}
      }else if(choice.provider==='pexels'){
        const chosen=await findPexelsForAutofill(query,choice.type,config.pexelsKey);
        if(chosen){const record=await importPexelsForAutofill(p,chosen,i);scene.assetId=record.id;scene.sourceStart=0;added++;save(p);}
      }else{
        const job=queueGoogleJob(p,query,i,{firstOnly:true});
        while(['queued','leased','screening'].includes(job.status)){
          if(Date.now()-job.createdAt>600000){job.status='error';job.detail='La búsqueda tardó más de 10 minutos. Comprueba la extensión y vuelve a intentar.';break;}
          update(Math.round(5+completed/Math.max(1,missing.length)*90),`Escena ${i+1}/${p.scenes.length} · Google Images · ${job.detail}`);
          await new Promise(done=>setTimeout(done,700));
        }
        if(job.status==='error')throw Error(`Escena ${i+1}: ${job.detail}`);
        if(job.items[0]){await importGoogleCandidate(p,job,job.items[0],i);added++;}
      }
    }
  },{onSettled:({scene,i,ordinal})=>{
    completed++;settled.add(ordinal);
    let next=0;while(settled.has(next))next++;
    t.completedScene=next?missing[next-1].i:start-1;
    t.currentScene=missing[next]?.i??i;
    t.completedCount=completed;t.added=added;t.searched=searched;
    update(Math.round(5+completed/Math.max(1,missing.length)*90),`Escena ${i+1}/${p.scenes.length} ${scene.assetId?'completada':'sin resultado'} · ${added} medios asignados · ${completed}/${missing.length} procesadas`);
  }});}finally{await releaseIdleImageWorkers();}
  return {added,searched,from:start+1,total:p.scenes.length,missing:p.scenes.filter(scene=>!scene.assetId||!asset(p,scene.assetId)).length};
}

export async function studioRequest(req,res,url){
  const path=url.pathname;if(!path.startsWith('/api/studio/'))return false;
  try{
    if(path.startsWith('/api/studio/google-bridge/')){
      const origin=String(req.headers.origin||'');
      if(origin&&/^chrome-extension:\/\/[a-z]{32}$/.test(origin)){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');res.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type');res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');}
      else if(origin)throw Error('Origen de extensión no permitido');
      if(req.method==='OPTIONS'){res.writeHead(204);res.end();return true;}
      const action=path.slice('/api/studio/google-bridge/'.length);
      if(req.method==='POST'&&action==='heartbeat'){googleBridgeSeen=Date.now();return json(res,200,{connected:true}),true;}
      if(req.method==='GET'&&action==='status')return json(res,200,{connected:Date.now()-googleBridgeSeen<15000}),true;
      if(req.method==='GET'&&action==='next'){
        googleBridgeSeen=Date.now();
        const job=[...googleJobs.values()].find(j=>j.status==='queued'||j.status==='leased'&&j.leaseUntil<Date.now());
        if(!job)return json(res,200,{job:null}),true;
        job.status='leased';job.leaseUntil=Date.now()+600000;job.detail='La extensión está buscando';
        return json(res,200,{job:{id:job.id,query:job.query}}),true;
      }
      if(req.method==='POST'&&action==='submit'){
        const input=await readJson(req),job=googleJobs.get(String(input.id||''));
        if(!job||job.status!=='leased')throw Error('Búsqueda no disponible');
        if(input.error){job.status='error';job.detail=String(input.error).slice(0,250);return json(res,200,{received:true}),true;}
        job.status='screening';
        processGoogleCandidates(job,input.candidates).catch(error=>{job.status='error';job.detail=String(error.message||error);});
        return json(res,202,{received:true}),true;
      }
      return json(res,404,{error:'Ruta de extensión no encontrada'}),true;
    }
    if(req.method==='POST'&&path==='/api/studio/pexels'){
      const input=await readJson(req),key=String(input.apiKey||'').trim(),type=input.type==='photos'?'photos':'videos',query=String(input.query||'').trim();if(!key||!query)throw Error('Faltan la clave de Pexels o el término de búsqueda');
      const page=Math.max(1,Math.floor(Number(input.page)||1));const endpoint=new URL(type==='photos'?'https://api.pexels.com/v1/search':'https://api.pexels.com/v1/videos/search');endpoint.search=new URLSearchParams({query,per_page:'80',page:String(page)}).toString();
      const response=await fetch(endpoint,{headers:{Authorization:key}}),data=await response.json();if(!response.ok)throw Error(data.error||`Pexels respondió ${response.status}`);
      const items=pexelsSearchItems(data,type);
      return json(res,200,{items,page,total:Number(data.total_results||0),hasNext:!!data.next_page}),true;
    }
    if(req.method==='POST'&&path==='/api/studio/storyblocks'){
      const input=await readJson(req),publicKey=String(input.publicKey||'').trim(),secretKey=String(input.secretKey||'').trim(),query=String(input.query||'').trim();
      if(!publicKey||!secretKey||!query)throw Error('Introduce las claves pública y secreta de Storyblocks y un término de búsqueda');
      const projectId=String(input.projectId||'').trim(),project=projects.get(projectId);if(!project)throw Error('Selecciona un proyecto');
      return json(res,200,await findStoryblocks(project,{publicKey,secretKey,query,type:input.type==='photos'?'photos':'videos',page:Math.max(1,Math.floor(Number(input.page)||1))})),true;
    }
    if(req.method==='POST'&&path==='/api/studio/gemini'){
      const input=await readJson(req),key=String(input.apiKey||'').trim(),question=String(input.question||'').trim();if(!key||!question)throw Error('Faltan la clave de Gemini o la pregunta');
      const context=`Guion: ${String(input.script||'').slice(0,15000)}\nCapítulos: ${JSON.stringify(input.chapters||[]).slice(0,10000)}\nPregunta: ${question}`;
      const result=await withGeminiRetry(async ({model})=>{const response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,{method:'POST',headers:{'x-goog-api-key':key,'Content-Type':'application/json'},body:JSON.stringify({contents:[{parts:[{text:context}]}]})});const result=await response.json();if(!response.ok)throw new GeminiHttpError(response.status,result.error?.message||`Gemini respondió ${response.status}`);return result;},{model:'gemini-3.8-flash'});
      return json(res,200,{answer:result.candidates?.[0]?.content?.parts?.map(x=>x.text||'').join('\n')||''}),true;
    }
    if(req.method==='GET'&&path==='/api/studio/templates')return json(res,200,existsSync(TEMPLATE_STORE)?JSON.parse(readFileSync(TEMPLATE_STORE,'utf8')):[]),true;
    if(req.method==='PUT'&&path==='/api/studio/templates'){const items=await readJson(req);if(!Array.isArray(items)||items.length>100)throw Error('Lista de plantillas inválida');writeFileSync(TEMPLATE_STORE,JSON.stringify(items.map(item=>({id:clean(item.id,80),name:clean(item.name,80),type:clean(item.type,30),position:clean(item.position,30),font:clean(item.font,50),size:Number(item.size)||6,color:clean(item.color,20),accent:clean(item.accent,20),background:Number(item.background)||0,animation:clean(item.animation,20)})),null,2));return json(res,200,{saved:items.length}),true;}
    if(req.method==='GET'&&path==='/api/studio/projects')return json(res,200,[...projects.values()].map(p=>({id:p.id,title:p.title,updatedAt:p.updatedAt,scenes:p.scenes?.length||0}))),true;
    if(req.method==='POST'&&path==='/api/studio/projects'){const input=await readJson(req),id=randomUUID(),folder=join(DATA,id);mkdirSync(join(folder,'assets'),{recursive:true});mkdirSync(join(folder,'renders'),{recursive:true});const p={id,title:clean(input.title||'Nuevo proyecto'),createdAt:new Date().toISOString(),assets:[],cues:[],sourceCues:[],subtitleCues:[],textLayers:[],wordsJson:null,rawChapters:null,rawSearchTerms:null,youtubeSources:null,chapterGrouping:{},chapterValidationError:'',chapters:[],scenes:[],settings:{ratio:'16:9',quality:'720p',exportQuality:'high',captions:false,captionStyle:'cine',captionColor:'yellow',musicVolume:20,transitionSequence:['remotion:none'],effectSequence:[],transitionDuration:.45,fit:'blur',imageFit:'blur',videoFit:'fill',blur:20,blurOpacity:0,motion:'static',zoomPercent:10,sceneMode:'srt'},exports:[]};projects.set(id,p);save(p);return json(res,200,p),true;}
    const m=path.match(/^\/api\/studio\/projects\/([a-f0-9-]+)(?:\/(.*))?$/);if(!m)return json(res,404,{error:'Ruta no encontrada'}),true;
    const p=projects.get(m[1]);if(!p)return json(res,404,{error:'Proyecto no encontrado'}),true;const action=m[2]||'';
    if(req.method==='GET'&&!action)return json(res,200,p),true;
    if(req.method==='DELETE'&&!action){if([...tasks.values()].some(t=>t.projectId===p.id&&t.status==='running'))return json(res,409,{error:'Espera a que termine el proceso del proyecto antes de eliminarlo'}),true;rmSync(dirOf(p),{recursive:true});projects.delete(p.id);for(const [id,t] of tasks)if(t.projectId===p.id)tasks.delete(id);return json(res,200,{deleted:true,id:p.id}),true;}
    if(req.method==='PUT'&&!action){const data=await readJson(req);for(const key of ['title','script','cues','sourceCues','subtitleCues','textLayers','wordsJson','rawChapters','rawSearchTerms','youtubeSources','chapterGrouping','chapterValidationError','chapters','scenes','settings','narrationId','originalAudioId','musicId'])if(Object.hasOwn(data,key))p[key]=data[key];save(p);return json(res,200,p),true;}
    if(req.method==='POST'&&action==='assets'){const name=clean(url.searchParams.get('name')||'asset'),ext=extname(name).toLowerCase(),allowed=['.jpg','.jpeg','.png','.webp','.gif','.mp4','.mov','.mkv','.webm','.wav','.mp3','.m4a','.aac'];if(!allowed.includes(ext))throw Error('Formato de archivo no compatible');const id=randomUUID(),file=`${id}${ext}`,dest=join(dirOf(p),'assets',file);await pipeline(req,createWriteStream(dest));const meta=await probe(dest),type=meta.width?(ext.match(/\.(jpe?g|png|webp|gif)$/)?'image':'video'):'audio';const record={id,name,type,file,...meta};p.assets.push(record);save(p);return json(res,200,record),true;}
    if(req.method==='POST'&&action==='pexels-import'){
      const input=await readJson(req),sceneIndex=Number(input.sceneIndex);
      if(input.type==='video'&&(!Number.isInteger(sceneIndex)||!p.scenes[sceneIndex]))throw Error('Selecciona una escena para importar un clip de Pexels');
      const record=await importPexelsForAutofill(p,{...input,name:clean(input.name||'Pexels'),source:clean(input.source||'',500),creator:clean(input.creator||'')},sceneIndex);
      return json(res,200,record),true;
    }
    if(req.method==='POST'&&action==='storyblocks-import'){
      const input=await readJson(req),record=await importStoryblocks(p,{stockId:Number(input.stockId),name:input.name,publicKey:String(input.publicKey||'').trim(),secretKey:String(input.secretKey||'').trim(),type:input.type,sceneIndex:Number(input.sceneIndex),sourceDuration:Number(input.duration)||0});
      return json(res,200,record),true;
    }
    if(req.method==='POST'&&action==='google-search'){
      const input=await readJson(req),job=queueGoogleJob(p,input.query,Number(input.sceneIndex));
      return json(res,202,publicGoogleJob(job)),true;
    }
    if(req.method==='GET'&&action.startsWith('google-jobs/')){
      const job=googleJobs.get(action.slice('google-jobs/'.length));
      if(!job||job.projectId!==p.id)return json(res,404,{error:'Búsqueda no encontrada'}),true;
      if(job.status==='leased'&&job.leaseUntil<Date.now()){job.status='error';job.detail='La extensión tardó más de 10 minutos. Repite la búsqueda.';}
      return json(res,200,publicGoogleJob(job)),true;
    }
    if(req.method==='GET'&&action.startsWith('google-candidates/')){
      const [,jobId,candidateId]=action.split('/'),job=googleJobs.get(jobId),candidate=job?.items.find(x=>x.id===candidateId);
      if(!job||job.projectId!==p.id||!candidate)return json(res,404,{error:'Imagen no encontrada'}),true;
      streamFile(req,res,candidate.file,'image/'+(extname(candidate.file).toLowerCase()==='.png'?'png':extname(candidate.file).toLowerCase()==='.webp'?'webp':extname(candidate.file).toLowerCase()==='.avif'?'avif':extname(candidate.file).toLowerCase()==='.gif'?'gif':'jpeg'));return true;
    }
    if(req.method==='POST'&&action==='google-import'){
      const input=await readJson(req),job=googleJobs.get(String(input.jobId||'')),candidate=job?.items.find(x=>x.id===input.candidateId);
      const record=await importGoogleCandidate(p,job,candidate,Number(input.sceneIndex));
      return json(res,200,record),true;
    }
    if((req.method==='GET'||req.method==='HEAD')&&action.startsWith('assets/')){const found=asset(p,action.slice(7));if(!found)return json(res,404,{error:'Asset no encontrado'}),true;if(url.searchParams.get('renderProxy')==='1'){if(found.type!=='video')return json(res,404,{error:'Video no encontrado'}),true;streamFile(req,res,join(dirOf(p),'renders','compatible',`${found.id}.mp4`),'video/mp4');return true;}if(url.searchParams.get('renderImage')==='1'){if(found.type!=='image')return json(res,404,{error:'Imagen no encontrada'}),true;streamFile(req,res,join(dirOf(p),'renders','images',`${found.id}.png`),'image/png');return true;}const original=assetPath(p,found.id);if(url.searchParams.get('editorPreview')==='1'&&found.type==='video'){const preview=join(dirOf(p),'previews',`${found.id}.mp4`),ready=previewIsReady(original,preview);if(!ready)schedulePreview(original,preview);res.setHeader('x-clip-studio-preview',ready?'optimized':'original-optimizing');streamFile(req,res,ready?preview:original,ready?'video/mp4':({'mp4':'video/mp4','mov':'video/quicktime','mkv':'video/x-matroska','webm':'video/webm'}[extname(found.file).slice(1).toLowerCase()]||'application/octet-stream'),ready?{immutable:true}:{cacheControl:'no-store'});return true;}const mime={'.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.webp':'image/webp','.gif':'image/gif','.mp4':'video/mp4','.mov':'video/quicktime','.mkv':'video/x-matroska','.webm':'video/webm','.wav':'audio/wav','.mp3':'audio/mpeg','.m4a':'audio/mp4','.aac':'audio/aac'};streamFile(req,res,original,mime[extname(found.file).toLowerCase()]||'application/octet-stream',{immutable:true});return true;}
    if(req.method==='GET'&&action==='review'){const review=p.review,ready=!!(review?.signature===renderSignature(p)&&existsSync(join(dirOf(p),'renders',review.name)));return json(res,200,{ready,result:ready?review:null}),true;}
    if(req.method==='POST'&&action==='render'){const input=await readJson(req),elapsed=Number(input.requestElapsedMs),requestElapsedMs=Number.isFinite(elapsed)?Math.max(0,Math.min(300000,elapsed)):0;const t=task(p,'render',update=>exportProject(p,update,requestElapsedMs));return json(res,202,t),true;}
    if(req.method==='POST'&&action==='preview'){const t=task(p,'preview',async update=>{const result=await renderWithRemotion(p,dirOf(p),update);p.review={...result,preview:true,signature:renderSignature(p)};save(p);return p.review;});return json(res,202,t),true;}
    if(req.method==='POST'&&action==='capcut'){const t=task(p,'capcut',update=>exportCapCut(p,dirOf(p),update));return json(res,202,t),true;}
    if(req.method==='POST'&&action==='adjust-audio'){const input=await readJson(req),t=task(p,'audio',update=>adjustAudio(p,input,update));return json(res,202,t),true;}
    if(req.method==='POST'&&action==='sources'){const input=await readJson(req),t=task(p,'sources',update=>downloadChapters(p,input,update));return json(res,202,t),true;}
    if(req.method==='POST'&&action==='autofill'){const input=await readJson(req),t=task(p,'autofill',update=>autofillStoryblocks(p,input,update));return json(res,202,t),true;}
    if(req.method==='POST'&&action==='google-autofill'){const input=await readJson(req),t=task(p,'google-autofill',async update=>{try{return await autofillGoogle(p,input,update);}finally{await releaseIdleImageWorkers();}});return json(res,202,t),true;}
    if(req.method==='POST'&&action==='autofill-sequence'){const input=await readJson(req);validateAutofillSequence(input.sequence,input);const t=task(p,'autofill-sequence',(update,taskState)=>autofillSequence(p,input,update,taskState));return json(res,202,t),true;}
    if(req.method==='GET'&&action.startsWith('tasks/')){const id=action.slice(6),t=tasks.get(id);return json(res,t?200:404,t||{error:'Tarea no encontrada'}),true;}
    if(req.method==='GET'&&action.startsWith('files/')){const name=basename(action.slice(6));streamFile(req,res,join(dirOf(p),'renders',name),name.endsWith('.srt')?'text/plain; charset=utf-8':name.endsWith('.wav')?'audio/wav':name.endsWith('.zip')?'application/zip':'video/mp4');return true;}
    return json(res,404,{error:'Ruta no encontrada'}),true;
  }catch(error){json(res,500,{error:String(error.message||error)});return true;}
}
