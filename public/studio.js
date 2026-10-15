import {parseSrt,serializeSrt,mergeSrt,wordsToSrt,normalizeWordsPayload,renamedAsset,validateSearchTerms,transitions,migrateProjectTransitions,videoEffects} from '/studio-core.mjs';
import {prepareRemotionProject} from '/remotion-data.mjs';
import {createEditorSession} from '/editor-session.mjs';
import {createPreviewSession} from '/editor-preview-session.mjs';
import {exportView} from '/export-view.mjs';
import {getCredential,subscribeCredentials} from '/studio-ui.js';
import {createMediaService} from '/media-service.mjs';
import {createStockSearch} from '/media-search.mjs';
import {MEDIA_PAGE_SIZE as PAGE_SIZE,missingMediaIndices as collectMissingMedia,mediaBoardIndices as collectBoardIndices,nextMissingScene as findNextMissingScene,sceneSearchTerm,pagination,mediaBoardView,saveAutofillSource,removeAutofillSource} from '/media-board-model.mjs';
import {buildTimelineView} from '/timeline-model.mjs';
import {buildInspectorView} from '/editor-inspector-model.mjs';
import {createTextLayer,templateStylePatch,textFieldValue,subtitleFieldValue} from '/editor-text-model.mjs';
import {sceneFieldEdit,effectOverrideEdit,transitionOverrideEdit,transitionDurationEdit,inheritTransitionEdit,sceneSfxEdit,audioSelectionEdit,musicVolumeEdit,captionSettingEdit,multiEffectEdit,multiHideSubtitlesEdit,multiDeleteTextEdit,overlayEdit,toggleSequenceEdit,settingEdit,moveTextEdit,trimBoundaryEdit,trimCueEdit} from '/editor-edit-model.mjs';
import {refreshChapterMapping,buildStoryboard,assignInitialAssets} from '/storyboard-model.mjs';
import {ensureEditorSettings,migrateLegacySources,sourceCount} from '/project-model.mjs';
import {renderGlobalSettings,renderFormatSettings,renderPreviewTransport,renderExportPage,patchExportProgress,renderRenamePanel,mountSidebarTools,renderTranscriptPanel,renderProjectPanel,renderProjectOptions,renderAssetLibrary,renderAssetTarget,renderChapterGroups,renderAutofillPanel,patchAutofillProgress,renderYoutubeSources,renderMissingSummary,renderStoryboard,renderStockCards,renderMediaPagination,renderSceneInspector,renderSceneExtras,renderTemplatePanel,renderEditorMediaPicker,renderNarrationPanel,renderStoryboardSettings,mountEditorInspector,renderEditorTimeline,renderEditorHistory,renderEditorInspector,renderInspectorSelection,mountMediaPage,getMediaSession,patchMediaSession,getEditorInteraction,patchEditorInteraction,selectEditorInteraction,restoreEditorSelection,mountStudioShell,navigateStudioView,showProjectIndicator,showGlobalNotice,showPreviewStatus,showEditorTitle,showEditorDirty,patchPreviewSurface,patchBusyView,filesFromDrop} from '/studio-ui.js';
mountStudioShell(view=>{if(view==='export')renderExport();if(view==='editor'){updatePreview(true);requestAnimationFrame(sizePreviewStage);}},sizePreviewStage,()=>globalActions.save());
await import('/remotion-player.js');
mountMediaPage({file:(id,files)=>{void withError(async()=>receiveInput(id,files))();}});
const $=id=>document.getElementById(id), state={project:null,rename:null,youtubeFormKey:0,pages:{assets:0,media:0,scenes:0},autofillStart:null,autofillRunning:false,autofillRunId:0,timelineScale:null,busy:false,segmentOverrideMode:false,mediaPickerOpenToken:0,pauseMs:300,spacingResult:null,assignMode:'basic'};
// Media interaction state (scene, provider, query, pages) lives in the Redux media session.
const media=getMediaSession,setMedia=patchMediaSession,interaction=getEditorInteraction,setInteraction=patchEditorInteraction;
const fmt=n=>{n=Number(n)||0;return `${String(Math.floor(n/60)).padStart(2,'0')}:${String(Math.floor(n%60)).padStart(2,'0')}.${String(Math.round(n%1*1000)).padStart(3,'0')}`;};
const notice=showGlobalNotice;
async function api(path,options={}){const response=await fetch(`/api/studio${path}`,options),data=await response.json().catch(()=>({}));if(!response.ok)throw Error(data.error||`Error ${response.status}`);return data;}
const jsonOptions=value=>({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(value)});
const mediaService=createMediaService(api,getCredential);
const stockSearch=createStockSearch({service:mediaService,getSession:media,patchSession:setMedia,onChange:()=>renderStockResults(),notice,isCurrentProject:id=>state.project?.id===id});
async function saveProject(){if(!state.project)throw Error('Crea o abre un proyecto');const project=state.project,response=await editorSession.flush(true);if(state.project===project&&!editorSession.pending)state.project=response;renderProject();return state.project;}
function requireProject(){if(!state.project)throw Error('Crea o abre un proyecto en la pestaña Proyecto');return state.project;}
function download(text,name,mime='text/plain'){if(!text)throw Error('No hay contenido para descargar');const url=URL.createObjectURL(new Blob([text],{type:mime})),link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}
async function loadProjects(){renderProjectOptions(await api('/projects'));}
async function openProject(id){if(state.project?.id!==id)await editorSession.flush();if($('media-picker').open)$('media-picker').close();state.autofillRunId++;state.youtubeFormKey++;preview.reset();state.timelineScale=null;patchPreviewSurface({empty:true,status:''});setInteraction({selectedScene:null,selection:null,multiSelection:[]});editorSession.reset();state.segmentOverrideMode=false;state.spacingResult=null;state.pages={assets:0,media:0,scenes:0};state.autofillStart=null;state.autofillRunning=false;stockSearch.reset();setMedia({assetTargetScene:null,activeScene:0,provider:'storyblocks',type:'videos',query:'',searched:false,missingOnly:false,pexelsPage:0,storyblocksPage:0,googlePage:0});state.project=await api(`/projects/${id}`);setMedia({missingOnly:missingMediaIndices().length>0});setMedia({activeScene:nextMissingScene(0)});state.pages.media=media().missingOnly?0:Math.floor(Math.min(media().activeScene,Math.max(0,state.project.scenes.length-1))/PAGE_SIZE);const migratedTransitions=migrateProjectTransitions(state.project);ensureEditorSettings(state.project);const migrated=migrateLegacySources(state.project);state.project.sourceCues??=state.project.cues?.map(x=>({...x}))||[];state.project.subtitleCues??=state.project.sourceCues.map(x=>({...x}));state.project.textLayers??=[];state.project.chapterGrouping??={};refreshChapterMapping(state.project);renderProject();if(migrated||migratedTransitions)await saveProject();if(media().missingOnly){navigateStudioView('assets');$('media-missing-summary').scrollIntoView({block:'start'});}notice(`Proyecto «${state.project.title}» abierto${migrated?' · search terms recuperados':''}${media().missingOnly?` · ${missingMediaIndices().length} escenas sin medio`:''}`);}
function renderProject(){const p=state.project;showProjectIndicator(p?p.title:'Sin proyecto');if(!p){showEditorTitle('Proyecto');renderInspectorSelection(null);renderProjectPanel(null,projectActions);renderTranscriptPanel(null,transcriptActions);renderAssetLibrary({projectId:'',items:[]},mediaActions);renderAssetTarget({selected:null,scenes:[]},mediaActions);renderYoutubeSources({projectId:null,json:''},mediaActions);renderStoryboard({hasScenes:false},mediaActions);renderStockCards(null);renderChapterGroups({present:false,items:[]},mediaActions);renderAutofillControls();renderMissingSummary({items:[]},mediaActions);renderMediaPagination('assets',{pages:0,current:0,total:0},mediaActions);renderMediaPagination('media',{pages:0,current:0,total:0},mediaActions);renderNarrationPanel(null,narrationActions);renderStoryboardSettings({projectId:null,sceneMode:'srt',assignMode:state.assignMode},storyboardActions);renderExport();return;}p.textLayers??=[];showEditorTitle(p.title);
  const voice=p.assets.find(a=>a.id===p.originalAudioId);
  renderProjectPanel({id:p.id,title:p.title,script:p.script||'',cues:p.cues?.length||0,chapters:p.chapters?.length||0,scenes:p.scenes?.length||0,assets:p.assets?.length||0,sourceCues:p.sourceCues?.length||0,words:p.wordsJson?.words?.length||0,voiceName:voice?.name||'',rawChapters:!!p.rawChapters,rawSearchTerms:!!p.rawSearchTerms},projectActions);
  const sourceNotes=[];if(p.chapterValidationError)sourceNotes.push(`Capítulos: ${p.chapterValidationError}`);else if(p.chapters?.length)sourceNotes.push(`${p.chapters.length} capítulos cubren ${p.chapters.reduce((n,ch)=>n+ch.cueCount,0)} bloques${p.chapters.some(ch=>ch.warning?.length)?' · algunos cierres se infirieron por el siguiente inicio':''}.`);
  if(p.rawSearchTerms&&p.cues?.length){try{const check=validateSearchTerms(p.rawSearchTerms,p.cues);sourceNotes.push(`${check.rows.length} search terms alineados con el SRT${check.warnings.length?` · ${check.warnings.length} textos difieren`:''}.`);}catch(error){sourceNotes.push(`Search terms: ${error.message}`);}}
  renderTranscriptPanel({id:p.id,sourceCues:p.sourceCues?.length||0,words:p.wordsJson?.words?.length||0,cues:p.cues?.length||0,chapters:p.rawChapters?sourceCount(p.rawChapters):0,searchTerms:p.rawSearchTerms?sourceCount(p.rawSearchTerms):0,sourceNote:sourceNotes.join(' ')},transcriptActions);
  renderAssets();
  renderYoutubeSources({projectId:p.id,draftKey:`${p.id}:${state.youtubeFormKey}`,json:p.youtubeSources?JSON.stringify(p.youtubeSources,null,2):''},mediaActions);
  renderFormatSettings({ratio:p.settings?.ratio||'9:16',quality:p.settings?.quality||'720p',exportQuality:p.settings?.exportQuality||'high',captions:p.settings?.captions!==false},formatActions);
  renderStoryboardSettings({projectId:p.id,sceneMode:p.settings?.sceneMode||'srt',assignMode:state.assignMode},storyboardActions);
  renderGlobalControls();renderScenes();renderNarrationControls();renderMediaBoard();renderChapterGrouping();renderExport();renderTemplateLibrary();updatePreview(true);}
function renderPagination(key,total){const page=pagination(total,state.pages[key]);state.pages[key]=page.current;renderMediaPagination(key,page,mediaActions);}
function renderAssets(){const p=state.project;if(!p)return;renderPagination('assets',p.assets.length);const start=state.pages.assets*PAGE_SIZE;renderAssetLibrary({projectId:p.id,items:p.assets.slice(start,start+PAGE_SIZE).map(a=>({id:a.id,name:a.name,type:a.type,chapter:a.chapter,width:a.width,height:a.height,duration:a.duration}))},mediaActions);}
function renderChapterGrouping(){const p=state.project;if(!p)return;renderChapterGroups({present:!!p.rawChapters,grouped:p.settings?.sceneMode==='chapter',error:p.chapterValidationError||'',items:(p.chapters||[]).map(ch=>({id:ch.id,name:ch.name,cueStart:ch.cueStart,cueEnd:ch.cueEnd,cueCount:ch.cueCount,size:Math.max(1,Math.min(ch.cueCount,Number(p.chapterGrouping?.[ch.id])||1))}))},mediaActions);}
function missingMediaIndices(){return collectMissingMedia(state.project);}
function mediaBoardIndices(){return collectBoardIndices(state.project,media().missingOnly);}
function nextMissingScene(from=0){return findNextMissingScene(state.project,from);}
function renderAutofillControls(){
  const p=state.project,sequence=p?.settings?.autofillSequence||[];
  const needed=new Set(sequence.map(entry=>entry.provider)),missing=[];
  if(needed.has('pexels')&&!getCredential('pexels').trim())missing.push('clave de Pexels');
  if(needed.has('storyblocks')&&(!getCredential('storyblocksPublic').trim()||!getCredential('storyblocksSecret').trim()))missing.push('claves de Storyblocks');
  const remaining=missingMediaIndices().length;
  if(p&&!remaining&&media().missingOnly){setMedia({missingOnly:false});state.pages.media=0;}
  renderAutofillPanel({
    projectId:p?.id||null,sceneCount:p?.scenes?.length||0,
    entries:sequence.map(entry=>({type:entry.type,provider:entry.provider})),
    start:state.autofillStart??1,running:state.autofillRunning,remaining,missingOnly:media().missingOnly,
    canRun:!!p?.scenes?.length&&!!sequence.length&&!missing.length&&!state.autofillRunning,
    requirements:missing.length?`Para iniciar, agrega ${missing.join(' y ')} en Claves.`:sequence.length?(needed.has('google')?'La extensión de Google Images debe estar conectada. ':'')+'Secuencia lista para repetirse.':''
  },mediaActions);
}
function renderMediaBoard(){
  const p=state.project;if(!p)return;
  let view=mediaBoardView(p,media(),state.pages.media);
  if(media().assetTargetScene!==view.target)setMedia({assetTargetScene:view.target});
  renderMissingSummary({items:view.missingItems},mediaActions);
  if(media().missingOnly&&!view.missingOnly){setMedia({missingOnly:false});state.pages.media=0;view=mediaBoardView(p,media(),state.pages.media);}
  if(media().activeScene!==view.active){setMedia({activeScene:view.active});view=mediaBoardView(p,media(),state.pages.media);}
  state.pages.media=view.page.current;
  renderAssetTarget({selected:view.target,scenes:view.targetScenes},mediaActions);
  if(!p.scenes.length){renderStoryboard({hasScenes:false},mediaActions);renderStockCards(null);renderPagination('media',0);renderAutofillControls();return;}
  renderStoryboard({hasScenes:true,projectId:p.id,rows:view.rows,assets:view.visualAssets,active:view.active,provider:media().provider,type:media().type,query:view.query},mediaActions);
  state.autofillStart??=Math.min(p.scenes.length+1,nextMissingScene(media().activeScene)+1);
  renderMediaPagination('media',view.page,mediaActions);renderAutofillControls();renderStockResults();
}
async function activateMediaScene(index,provider=media().provider,autoSearch=false){const p=requireProject();if(!p.scenes[index])return;setMedia({assetTargetScene:index});stockSearch.reset();setMedia({activeScene:index,provider,type:provider==='google'?'photos':media().type,query:sceneSearchTerm(p.scenes[index]),searched:false,pexelsPage:0,storyblocksPage:0,googlePage:0});state.pages.media=Math.floor(Math.max(0,mediaBoardIndices().indexOf(index))/PAGE_SIZE);renderMediaBoard();if(autoSearch){if(!media().query){notice(`La escena ${index+1} no tiene término de búsqueda`,true);return;}const ready=provider==='pexels'?!!getCredential('pexels'):provider==='google'?true:!!(getCredential('storyblocksPublic')&&getCredential('storyblocksSecret'));if(!ready){notice(`Agrega las claves de ${provider==='pexels'?'Pexels':'Storyblocks'} en la barra lateral`,true);return;}try{await runStockSearch();}catch(error){notice(`Escena ${index+1}: ${error.message}`,true);}}}
function renderNarrationControls(){const p=state.project;if(!p)return;const gaps=(p.cues||[]).slice(0,-1).map((cue,i)=>Math.max(0,p.cues[i+1].start-cue.end));renderNarrationPanel({projectId:p.id,pauseMs:state.pauseMs,gapCount:gaps.length,longGaps:gaps.filter(gap=>gap>state.pauseMs/1000).length,duration:fmt(p.scenes.at(-1)?.end||p.cues.at(-1)?.end||0),scenes:p.scenes.length,subtitles:p.subtitleCues?.length||0,result:state.spacingResult},narrationActions);}
function renderGlobalControls(){const p=state.project;if(!p)return;ensureEditorSettings(p);renderGlobalSettings(structuredClone(p.settings),globalActions);}
function renderTimeline(){
  const p=state.project;if(!p)return;
  const view=buildTimelineView(p,{scale:state.timelineScale,selection:interaction().selection,multiSelection:interaction().multiSelection});
  state.timelineScale=view.scale;
  renderEditorTimeline(view,timelineActions);
}
function renderScenes(){renderTimeline();renderScenePage();renderInspector();}
function renderScenePage(){
  const p=state.project;if(!p)return;const i=interaction().selectedScene,s=p.scenes[i];
  if(!s)renderSceneInspector(null,editorActions);
  else{
    const a=p.assets.find(x=>x.id===s.assetId);
    renderSceneInspector({projectId:p.id,index:i,scene:{...s},asset:a?{id:a.id,name:a.name,type:a.type}:null,assets:p.assets.filter(x=>x.type==='image'||x.type==='video').map(x=>({id:x.id,name:x.name})),zoomPercent:p.settings?.zoomPercent??10},editorActions);
  }
  renderSceneExtras({index:i,scene:s?{...s}:null,assets:p.assets.filter(a=>a.type==='image').map(a=>({id:a.id,name:a.name})),overrideMode:state.segmentOverrideMode},sceneExtraActions);
}
function renderInspector(){
  if(!state.project)return;
  const view=buildInspectorView(state.project,{selection:interaction().selection,multiSelection:interaction().multiSelection,templates:interaction().selection?.type==='text'?allTemplates():[]});
  renderEditorInspector(view.panel);
  renderInspectorSelection(view.selection);
}
function renderExport(){renderExportPage(exportView(state.project),exportActions);}
function sizePreviewStage(){
  const monitor=document.querySelector('.editor-monitor'),stage=$('preview-stage'),p=state.project;
  if(!p||!monitor||!document.getElementById('editor').classList.contains('active'))return;
  const ratio=p.settings?.ratio==='16:9'?16/9:9/16,style=getComputedStyle(monitor);
  const paddingX=parseFloat(style.paddingLeft)+parseFloat(style.paddingRight),paddingY=parseFloat(style.paddingTop)+parseFloat(style.paddingBottom);
  const reserved=monitor.querySelector('.editor-monitor-head').offsetHeight+monitor.querySelector('.preview-controls').offsetHeight+paddingY+2*(parseFloat(style.gap)||0);
  const availableWidth=Math.max(1,monitor.clientWidth-paddingX),availableHeight=Math.max(1,monitor.clientHeight-reserved);
  const width=Math.min(availableWidth,availableHeight*ratio);
  stage.style.aspectRatio=String(ratio);stage.style.width=`${Math.floor(width)}px`;stage.style.height=`${Math.floor(width/ratio)}px`;
}
const preview=createPreviewSession({
  getProject:()=>state.project,
  isEditorActive:()=>document.getElementById('editor').classList.contains('active'),
  player:window.clipStudioPlayer,
  prepare:prepareRemotionProject,
  origin:()=>location.origin,
  onComposition:()=>patchPreviewSurface({empty:false}),
  onTransport:view=>renderPreviewTransport(view,previewActions),
  getScale:()=>state.timelineScale,
  getScroll:()=>$('timeline-scroll'),
  onResize:sizePreviewStage
});
window.addEventListener('clip-studio-player-buffering',event=>showPreviewStatus(event.detail.buffering?'Preparando video en vista previa…':''));
function updatePreview(refresh=false){preview.refresh(refresh);}
function seekExact(time){preview.seek(time);}
async function setPreviewPlaying(value){await preview.play(value);}
setInterval(()=>preview.tick(),100);
async function uploadFiles(files){const p=requireProject();let index=0;for(const file of files){index++;if(!file.size)continue;updateBusy(Math.round(index/Math.max(1,files.length)*95),`Importando ${index}/${files.length}: ${file.name}`);const response=await fetch(`/api/studio/projects/${p.id}/assets?name=${encodeURIComponent(file.name)}`,{method:'POST',body:file});const item=await response.json();if(!response.ok)throw Error(item.error||`No se pudo importar ${file.name}`);p.assets.push(item);}renderProject();notice(`${files.length} archivo(s) importado(s)`);}
async function followTask(t,target){const projectId=state.project.id,report=typeof target==='function'?target:message=>{$(target).textContent=message;};for(;;){const current=await api(`/projects/${projectId}/tasks/${t.id}`);if(state.project?.id===projectId)report(`${current.progress}% · ${current.detail}${current.error?` · ${current.error}`:''}`);updateBusy(current.progress,current.detail);if(current.status!=='running'){if(current.status==='error')throw Error(current.error);const project=await api(`/projects/${projectId}`);if(state.project?.id===projectId){state.project=project;renderProject();}return current.result;}await new Promise(resolve=>setTimeout(resolve,1500));}}
function updateBusy(percent,detail){if(!state.busy)return;patchBusyView({percent:Math.max(0,Math.min(100,percent||0)),...(detail?{detail}:{})});}
function beginBusy(label){state.busy=true;patchBusyView({running:true,title:label||'Procesando…',detail:'Espera un momento.',percent:0});document.body.setAttribute('aria-busy','true');}
function endBusy(){state.busy=false;patchBusyView({running:false});document.body.removeAttribute('aria-busy');}
function withError(handler){return async event=>{if(state.busy)return;const source=event?.currentTarget,label=source?.closest?.('label')?.querySelector?.('strong')?.textContent||source?.textContent?.trim().slice(0,60)||'Procesando…';beginBusy(label);try{if(event?.type!=='drop')await new Promise(resolve=>requestAnimationFrame(()=>setTimeout(resolve,0)));await handler(event);}catch(error){notice(error.message,true);}finally{endBusy();}};}

const sidebarActions={
  askGemini:async({apiKey,question})=>{const p=requireProject();const result=await api('/gemini',jsonOptions({apiKey,question,script:p.script,chapters:p.chapters}));return result.answer||'Sin respuesta';},
  notice:message=>notice(message),error:message=>notice(message,true),
  copy:value=>navigator.clipboard.writeText(value),download:(value,name)=>download(value,name)
};
mountSidebarTools(sidebarActions,location.origin);
async function receiveInput(id,files){const file=files[0];if(!file)throw Error('Selecciona un archivo');const p=requireProject();
  if(id==='script-file'){p.script=await file.text();refreshChapterMapping(p);}
  else if(id==='input-srt-file'){p.sourceCues=parseSrt(await file.text());p.subtitleCues=p.sourceCues.map(x=>({...x}));p.cues=p.sourceCues.map(x=>({...x}));p.scenes=[];refreshChapterMapping(p);}
  else if(id==='input-words-file'){p.wordsJson=normalizeWordsPayload(JSON.parse(await file.text()));}
  else if(id==='input-audio-file'){await uploadFiles([file]);p.originalAudioId=p.assets.at(-1).id;p.narrationId=p.originalAudioId;}
  else if(id==='inspector-voice-upload'||id==='inspector-music-upload'){await uploadFiles([file]);p[id==='inspector-voice-upload'?'narrationId':'musicId']=p.assets.at(-1).id;}
  else if(id==='inspector-upload'){if(interaction().selectedScene==null)throw Error('Selecciona una toma');await uploadFiles([file]);p.scenes[interaction().selectedScene].assetId=p.assets.at(-1).id;}
  else if(id==='input-chapters-file'){const raw=JSON.parse(await file.text()),list=Array.isArray(raw)?raw:raw?.chapters;if(!Array.isArray(list)||!list.length||list.some(x=>!x?.chapter&&!x?.name||!x?.startText||!x?.endText))throw Error('El JSON de capítulos necesita chapter, startText y endText en cada elemento');p.rawChapters=raw;p.chapterGrouping={};refreshChapterMapping(p);if(!p.rawSearchTerms)p.settings.sceneMode='chapter';}
  else if(id==='input-searchterms-file'){const raw=JSON.parse(await file.text()),list=Array.isArray(raw)?raw:raw?.items;if(!Array.isArray(list)||!list.length||list.some(x=>!x?.searchTerm))throw Error('El JSON de search terms necesita un searchTerm por elemento');p.rawSearchTerms=raw;p.settings.sceneMode='srt';}
  else if(id==='asset-files'||id==='asset-folder'){const target=media().assetTargetScene,before=p.assets.length;await uploadFiles(files.filter(x=>/\.(jpe?g|png|webp|gif|mp4|mov|mkv|webm|wav|mp3|m4a|aac)$/i.test(x.name)));if(target!=null){let index=target;for(const item of p.assets.slice(before).filter(a=>a.type==='image'||a.type==='video')){if(p.scenes[index])p.scenes[index++].assetId=item.id;}}}
  else throw Error('Campo de archivo desconocido');
  await saveProject();notice(`${file.name} guardado en el proyecto`);}
const projectActions={
  create(title){void withError(async()=>{const p=await api('/projects',jsonOptions({title:title.trim()||'Nuevo proyecto'}));await loadProjects();await openProject(p.id);})();},
  open(id){if(id)void withError(async()=>openProject(id))();},
  remove(){void withError(async()=>{const p=requireProject();if(!window.confirm(`¿Eliminar «${p.title}» y todos sus archivos guardados dentro de Clip Studio? Los archivos internos se eliminan definitivamente, sin pasar por la Papelera. Los originales externos se conservarán.`))return;await api(`/projects/${p.id}`,{method:'DELETE'});preview.reset();state.project=null;setInteraction({selectedScene:null,selection:null,multiSelection:[]});editorSession.reset();state.autofillRunId++;renderSceneInspector(null,editorActions);renderSceneExtras(null,sceneExtraActions);renderEditorTimeline(null,timelineActions);renderEditorInspector(null,inspectorActions);renderPreviewTransport({time:0,duration:0,playing:false},previewActions);patchPreviewSurface({empty:true,status:''});renderProject();await loadProjects();navigateStudioView('project');notice(`Proyecto «${p.title}» eliminado de Clip Studio`);})();},
  saveScript(title,script){void withError(async()=>{const p=requireProject();p.script=script;p.title=title.trim()||p.title;refreshChapterMapping(p);await saveProject();await loadProjects();notice('Guion guardado');})();},
  file(id,files,after){void withError(async()=>{await receiveInput(id,files);after?.(state.project?.script||'');})();}
};
renderProjectPanel(null,projectActions);
const transcriptActions={
  merge(max,setOutput){void withError(async()=>{const p=requireProject();if(!p.sourceCues?.length)throw Error('Carga primero un SRT en Entradas');setOutput(serializeSrt(mergeSrt(p.sourceCues,max)));notice('SRT combinado');})();},
  words(max,silence,setOutput){void withError(async()=>{const p=requireProject();if(!p.wordsJson)throw Error('Carga primero un Words JSON en Entradas');setOutput(serializeSrt(wordsToSrt(p.wordsJson,{maxSeconds:max,silenceSeconds:silence,script:p.script||''})));notice('SRT generado');})();},
  use(kind,value){void withError(async()=>{const p=requireProject();p.cues=parseSrt(value);p.subtitleCues=(kind==='words'?p.cues:(p.sourceCues?.length?p.sourceCues:p.cues)).map(x=>({...x}));refreshChapterMapping(p);p.scenes=[];await saveProject();notice(`${p.cues.length} bloques de trabajo guardados. Crea el storyboard en Medios.`);})();},
  file(id,files){void withError(async()=>receiveInput(id,files))();},
  clear(kind){void withError(async()=>{const p=requireProject();if(kind==='chapters'){p.rawChapters=null;p.chapters=[];p.chapterGrouping={};p.chapterValidationError='';p.settings.sceneMode='srt';for(const scene of p.scenes)scene.chapterId=null;await saveProject();notice('Capítulos quitados. Los assets ya asignados se conservaron.');}else{p.rawSearchTerms=null;for(const scene of p.scenes)scene.searchTerm='';await saveProject();notice('Search terms quitados. Los assets ya asignados se conservaron.');}})();},
  copy(value){void withError(async()=>{await navigator.clipboard.writeText(value);notice('Copiado');})();},
  download(value,name){void withError(async()=>download(value,name))();}
};
renderTranscriptPanel(null,transcriptActions);
const narrationActions={
  pauseMs(value){state.pauseMs=Math.max(0,Math.min(5000,Number(value)||0));renderNarrationControls();},
  adjust:pauseMs=>withError(async()=>{if(preview.playing)setPreviewPlaying(false);const p=requireProject();if(!p.narrationId)throw Error('Carga el audio original en Entradas');if(p.cues.length<2)throw Error('Se necesitan al menos dos bloques para ajustar pausas');if(!Number.isFinite(pauseMs)||pauseMs<0||pauseMs>5000)throw Error('La pausa debe estar entre 0 y 5000 ms');state.spacingResult=null;renderNarrationControls();await saveProject();const task=await api(`/projects/${p.id}/adjust-audio`,jsonOptions({pauseMs}));const result=await followTask(task,()=>{});if(state.project?.id===p.id){state.spacingResult=result;renderNarrationControls();notice('Audio, timeline y subtítulos actualizados');}})()
};
const renameActions={
  async selectFolder(){try{
    if(!window.showDirectoryPicker)throw Error('Este navegador no permite renombrar carpetas. Ábrelo en Chrome o Edge.');
    const directory=await window.showDirectoryPicker();
    const files=[],targets=new Set();let scanned=0,duplicates=0;
    for await(const [name,handle] of directory.entries()){
      if(handle.kind!=='file')continue;
      scanned++;
      const target=renamedAsset(name);
      if(!target)continue;
      if(targets.has(target))duplicates++;
      targets.add(target);files.push({name,target});
    }
    state.rename=directory;state.renameFiles=files;
    const message=files.length?`${files.length} archivos válidos encontrados entre ${scanned} archivos de la carpeta.${duplicates?` ${duplicates} nombres de destino duplicados; revisa la carpeta antes de renombrar.`:''}`:`No hay archivos con el patrón esperado entre ${scanned} archivos.`;
    renderRenamePanel({count:files.length,duplicates,message},renameActions);
  }catch(error){if(error.name!=='AbortError')notice(error.message,true);}},
  run:withError(async()=>{
    if(!state.rename||!state.renameFiles?.length)throw Error('Selecciona una carpeta');
    const total=state.renameFiles.length;
    updateBusy(0,`Comprobando ${total} destinos · faltan ${total}`);
    for(const {target} of state.renameFiles){
      try{await state.rename.getFileHandle(target);throw Error(`Ya existe ${target}`);}
      catch(error){if(error.name!=='NotFoundError')throw error;}
    }
    for(const [index,{name,target}] of state.renameFiles.entries()){
      const original=await state.rename.getFileHandle(name),file=await original.getFile();
      const newHandle=await state.rename.getFileHandle(target,{create:true}),writer=await newHandle.createWritable();
      await writer.write(file);await writer.close();await state.rename.removeEntry(name);
      const done=index+1;updateBusy(Math.round(done/total*100),`Renombrados ${done} de ${total} · faltan ${total-done}`);
    }
    notice(`${total} assets renombrados`);
    state.renameFiles=[];renderRenamePanel({count:0,duplicates:0,message:`${total} archivos renombrados. 0 pendientes.`},renameActions);
  })
};
renderRenamePanel({count:0,duplicates:0,message:''},renameActions);
const editorActions={
  change(index,field,value){if(!applyEditorEdit(sceneFieldEdit(state.project,index,field,value)))return;renderScenes();renderMediaBoard();updatePreview(true);markEditorDirty();},
  upload(index,files){return withError(async()=>{if(interaction().selectedScene!==index)return;await receiveInput('inspector-upload',files);})();},
  drop(index,dataTransfer){return withError(async()=>{if(interaction().selectedScene!==index)return;await receiveInput('inspector-upload',await filesFromDrop(dataTransfer));})();},
  openPicker(index){const p=requireProject(),scene=p.scenes[index];if(!scene)return;renderEditorMediaPicker({projectId:p.id,sceneIndex:index,selectedAssetId:scene.assetId||'',usedIds:p.scenes.map(scene=>scene.assetId).filter(Boolean),assets:p.assets.map(asset=>({id:asset.id,name:asset.name,type:asset.type})),openToken:++state.mediaPickerOpenToken},mediaPickerActions);$('media-picker').showModal();}

};
const inspectorActions={
  effect(index,value){if(interaction().selection?.type!=='effect'||interaction().selection.index!==index||!applyEditorEdit(effectOverrideEdit(state.project,index,value)))return;renderScenes();updatePreview(true);markEditorDirty();},
  transition(index,value){if(interaction().selection?.type!=='transition'||interaction().selection.index!==index||!applyEditorEdit(transitionOverrideEdit(state.project,index,value,transitions)))return;renderTimeline();renderInspector();updatePreview(true);markEditorDirty();},
  transitionDuration(index,value){if(interaction().selection?.type!=='transition'||interaction().selection.index!==index||!applyEditorEdit(transitionDurationEdit(state.project,index,value)))return;renderTimeline();renderInspector();updatePreview(true);markEditorDirty();},
  transitionInherit(index){if(interaction().selection?.type!=='transition'||interaction().selection.index!==index||!applyEditorEdit(inheritTransitionEdit(state.project,index)))return;renderScenes();updatePreview(true);markEditorDirty();},
  transitionPreview(index){return withError(async()=>{const s=state.project?.scenes[index];if(!s||interaction().selection?.type!=='transition'||interaction().selection.index!==index)return;await setPreviewPlaying(false);seekExact(Math.max(0,s.end-Math.max(.4,Number(s.transitionDurationOverride??state.project.settings?.transitionDuration??.45))));await setPreviewPlaying(true);})();},
  sfx(index,key,value){if(!['sfx','transition'].includes(interaction().selection?.type)||interaction().selection.index!==index||!applyEditorEdit(sceneSfxEdit(state.project,index,key,value)))return;renderTimeline();renderInspector();updatePreview(true);markEditorDirty();},
  audioSelect(key,value){if(!applyEditorEdit(audioSelectionEdit(state.project,key,value)))return;renderScenes();updatePreview(true);markEditorDirty();},
  musicVolume(value){if(!applyEditorEdit(musicVolumeEdit(state.project,value)))return;renderScenes();updatePreview(true);markEditorDirty();},
  audioUpload(id,files){return withError(async()=>receiveInput(id,files))();},
  audioDrop(id,dataTransfer){return withError(async()=>receiveInput(id,await filesFromDrop(dataTransfer)))();},
  textField(index,key,value){return updateTextField(index,key,value);},
  textTemplate(index,id){if(interaction().selection?.type==='text'&&interaction().selection.index===index)applyTextTemplate(id);},
  saveTextTemplate(index){if(interaction().selection?.type==='text'&&interaction().selection.index===index)return withError(saveSelectedTemplate)();},
  deleteText(index){const p=state.project;if(!p||interaction().selection?.type!=='text'||interaction().selection.index!==index)return;rememberEdit();p.textLayers.splice(index,1);setInteraction({selection:null});renderScenes();updatePreview(true);markEditorDirty();},
  subtitleField(index,key,value){return updateSubtitleField(index,key,value);},
  toggleSubtitle(index){const p=state.project,cue=p?.subtitleCues?.[index];if(!cue||interaction().selection?.type!=='subtitle'||interaction().selection.index!==index)return;rememberEdit();cue.hidden=!cue.hidden;renderScenes();updatePreview(true);markEditorDirty();},
  captionSetting(key,value){if(!applyEditorEdit(captionSettingEdit(state.project,key,value)))return;renderInspector();updatePreview(true);markEditorDirty();},
  multiEffect(value){if(!applyEditorEdit(multiEffectEdit(state.project,interaction().multiSelection,value,videoEffects)))return;renderScenes();updatePreview(true);markEditorDirty();},
  multiHideSubtitles(){if(!applyEditorEdit(multiHideSubtitlesEdit(state.project,interaction().multiSelection)))return;renderScenes();updatePreview(true);markEditorDirty();},
  multiDeleteText(){if(!applyEditorEdit(multiDeleteTextEdit(state.project,interaction().multiSelection)))return;setInteraction({multiSelection:[],selection:null,selectedScene:null});renderScenes();updatePreview(true);markEditorDirty();},
  multiClear(){setInteraction({multiSelection:[],selection:null,selectedScene:null});renderScenes();}
};
const mediaActions={
  runYoutube(values,setStatus){return withError(async()=>{
    try{
      const p=requireProject(),chapters=JSON.parse(values.json||'[]');
      if(!Array.isArray(chapters)||!chapters.some(ch=>Array.isArray(ch.urls)&&ch.urls.length))throw Error('Agrega capítulos con name y urls de YouTube en este campo independiente');
      p.youtubeSources=chapters;
      await saveProject();
      const t=await api(`/projects/${p.id}/sources`,jsonOptions({chapters,clipDuration:values.clipDuration,delay:values.delay,startIndex:values.startIndex,cookieBrowser:values.cookieBrowser}));
      const result=await followTask(t,setStatus);
      setStatus(`Listo: ${result.added} clips nuevos, sin audio y en espejo. Revísalos en Biblioteca y asígnalos a un bloque.`);
    }catch(error){setStatus(`Error: ${error.message}`);throw error;}
  })();},
  targetScene(index){setMedia({assetTargetScene:index});},
  assignAsset(assetId){return withError(async()=>{const p=requireProject(),value=media().assetTargetScene;if(value==null)throw Error('Selecciona una escena de destino');const index=value;if(!p.scenes[index])throw Error('Escena de destino no disponible');p.scenes[index].assetId=assetId;await saveProject();notice(`Medio asignado al bloque ${index+1}`);})();},
  selectAsset(index,assetId){return withError(async()=>{const p=requireProject();if(!p.scenes[index])throw Error('Escena no disponible');p.scenes[index].assetId=assetId||null;await saveProject();if(assetId&&index+1<p.scenes.length)await activateMediaScene(index+1,media().provider,true);})();},
  provider(value){if(value===media().provider)return;stockSearch.reset();setMedia({provider:value,type:value==='google'?'photos':media().type,searched:false,pexelsPage:0,storyblocksPage:0,googlePage:0});renderMediaBoard();},
  type(value){if(value===media().type)return;stockSearch.reset();setMedia({type:value,searched:false,pexelsPage:0,storyblocksPage:0,googlePage:0});renderMediaBoard();},
  query(value){if(value===media().query)return;stockSearch.reset();setMedia({query:value,searched:false,pexelsPage:0,storyblocksPage:0,googlePage:0});renderStockResults();},
  search(query){return withError(async()=>{setMedia({query:query.trim()});await runStockSearch();})();},
  activate(index,provider,autoSearch){return withError(async()=>activateMediaScene(index,provider,autoSearch))();},
  addStock(provider,index){return withError(async()=>addStockResult(provider,index))();},
  stockPage(direction){return withError(async()=>{const p=requireProject();await stockSearch.page(p.id,direction);})();},
  jumpEditor(index){const p=state.project;if(!p?.scenes[index])return;setInteraction({selection:{type:'scene',index},multiSelection:[],selectedScene:index});preview.seek(p.scenes[index].start);renderScenes();updatePreview(true);navigateStudioView('editor');$('timeline-scroll').scrollLeft=Math.max(0,64+preview.time*(state.timelineScale||1)-120);},
  chapterSize(id,value){return withError(async()=>{const p=requireProject(),chapter=p.chapters.find(ch=>ch.id===Number(id));if(!chapter)return;const size=Math.floor(Number(value));if(!Number.isInteger(size)||size<1||size>chapter.cueCount)throw Error(`El capítulo admite entre 1 y ${chapter.cueCount} bloques por asset`);p.chapterGrouping??={};p.chapterGrouping[chapter.id]=size;await saveProject();})();},
  autofillStart(value){const limit=(state.project?.scenes.length||0)+1;state.autofillStart=Math.max(1,Math.min(limit,Math.floor(Number(value)||1)));renderAutofillControls();},
  async saveAutofill({index,type,provider}){const p=requireProject(),before=p.settings;p.settings={...before,autofillSequence:saveAutofillSource(before.autofillSequence,{index,type,provider})};try{await saveProject();notice('Secuencia de fuentes guardada');}catch(error){if(state.project?.id===p.id){state.project.settings=before;renderAutofillControls();}throw error;}},
  removeAutofill(index){return withError(async()=>{const p=requireProject(),before=p.settings;if(!before.autofillSequence?.[index])return;p.settings={...before,autofillSequence:removeAutofillSource(before.autofillSequence,index)};try{await saveProject();}catch(error){if(state.project?.id===p.id){state.project.settings=before;renderAutofillControls();}throw error;}})();},
  toggleMissing(){stockSearch.reset();setMedia({missingOnly:!media().missingOnly});state.pages.media=0;setMedia({activeScene:mediaBoardIndices()[0]??0,query:sceneSearchTerm(state.project?.scenes[mediaBoardIndices()[0]??0]),searched:false});renderMediaBoard();$('media-board').scrollIntoView({behavior:'smooth',block:'start'});},
  runAutofill(){void runAutofill();},
  missing(index){stockSearch.reset();setMedia({missingOnly:true,activeScene:index,query:sceneSearchTerm(state.project?.scenes[index]),searched:false});state.pages.media=Math.floor(missingMediaIndices().indexOf(index)/PAGE_SIZE);renderMediaBoard();$('media-board').scrollIntoView({behavior:'smooth',block:'start'});},
  page(key,page){if((key!=='assets'&&key!=='media')||!Number.isInteger(page)||page<0)return;state.pages[key]=page;if(key==='media'){setMedia({activeScene:mediaBoardIndices()[page*PAGE_SIZE]??0});setMedia({query:sceneSearchTerm(state.project?.scenes[media().activeScene])});setMedia({searched:false});stockSearch.reset();}if(key==='assets')renderAssets();else renderMediaBoard();$(key==='assets'?'asset-list':'media-board').scrollIntoView({behavior:'smooth',block:'start'});}
};
function targetSceneIndex(){return media().activeScene;}
function renderStockResults(){renderStockCards(stockSearch.view(state.project,media().activeScene));}
async function runStockSearch(){const p=requireProject();await stockSearch.run(p.id,media().activeScene);}
async function addStockResult(provider,index){const p=requireProject(),item=stockSearch.item(provider,index);if(!item)throw Error('Resultado no disponible');const target=targetSceneIndex();if(provider==='google'){await mediaService.importGoogle({projectId:p.id,jobId:stockSearch.googleJobId,candidateId:item.id,sceneIndex:target});state.project=await mediaService.getProject(p.id);renderProject();}else{const source=provider==='pexels'?item.source:`storyblocks:${item.type}:${item.id}`;let record=item.type==='video'?null:p.assets.find(a=>a.source===source);if(!record){record=await mediaService.importStock({projectId:p.id,provider,item,sceneIndex:target});if(!p.assets.some(a=>a.id===record.id))p.assets.push(record);}if(p.scenes[target]){p.scenes[target].assetId=record.id;if(item.type==='video')p.scenes[target].sourceStart=0;}await saveProject();}notice(`Medio asignado a escena ${target+1}`);const next=nextMissingScene(target+1);if(next<state.project.scenes.length)await activateMediaScene(next,provider,true);else{setMedia({searched:false});renderMediaBoard();notice('Todos los bloques siguientes tienen medio asignado.');}}

async function buildScenes(){const p=requireProject(),result=buildStoryboard(p);stockSearch.reset();setMedia({missingOnly:false,activeScene:0,searched:false,query:'',assetTargetScene:null});state.pages.media=0;setInteraction({selectedScene:null,selection:null,multiSelection:[]});await saveProject();notice(`Storyboard creado: ${result.sceneCount} assets cubren ${result.cueCount} bloques${result.warningCount?` · ${result.warningCount} textos del JSON difieren del SRT`:''}.`);}
async function autoAssign(){const p=requireProject(),assigned=assignInitialAssets(p,state.assignMode);await saveProject();notice(`${assigned} medios asignados`);}
const storyboardActions={
  sceneMode:value=>withError(async()=>{if(!['srt','chapter'].includes(value))return;const p=requireProject();p.settings.sceneMode=value;await saveProject();})(),
  assignMode:value=>{if(!['basic','smart'].includes(value))return;state.assignMode=value;renderStoryboardSettings({projectId:state.project?.id||null,sceneMode:state.project?.settings?.sceneMode||'srt',assignMode:value},storyboardActions);},
  build:()=>withError(buildScenes)(),
  autoAssign:()=>withError(autoAssign)()
};
subscribeCredentials(renderAutofillControls);
async function followAutofillSequence(taskId,projectId,runId){
  let seenCompleted=-2,seenCurrent=-2;
  for(;;){
    if(runId!==state.autofillRunId||state.project?.id!==projectId)return null;
    const current=await mediaService.getTask(projectId,taskId);
    if(runId!==state.autofillRunId||state.project?.id!==projectId)return null;
    patchAutofillProgress({visible:true,percent:current.progress,status:`${current.progress}% · ${current.detail}${current.error?` · ${current.error}`:''}`});
    if(current.completedScene!==seenCompleted||current.currentScene!==seenCurrent||current.status!=='running'){
      seenCompleted=current.completedScene;seenCurrent=current.currentScene;
      const project=await mediaService.getProject(projectId);
      if(runId!==state.autofillRunId||state.project?.id!==projectId)return null;
      state.project=project;
      const sceneIndex=Math.max(0,Math.min(state.project.scenes.length-1,Number(current.currentScene??current.completedScene??0))),oldPage=state.pages.media;
      setMedia({activeScene:sceneIndex,searched:false});
      state.pages.media=Math.floor(sceneIndex/PAGE_SIZE);
      renderMediaBoard();
      if(state.pages.media!==oldPage)$('media-board').scrollIntoView({behavior:'smooth',block:'start'});
    }
    if(current.status!=='running'){if(current.status==='error')throw Error(current.error);return current.result;}
    await new Promise(resolve=>setTimeout(resolve,900));
  }
}
async function runAutofill(){
  if(state.autofillRunning||state.busy)return;
  const p=requireProject(),sequence=p.settings.autofillSequence||[];
  if(!sequence.length)return;
  stockSearch.reset();setMedia({searched:false,missingOnly:false});const runId=++state.autofillRunId;state.autofillRunning=true;
  patchAutofillProgress({visible:true,percent:0,status:'Preparando búsqueda…'});
  renderAutofillControls();
  try{
    const t=await mediaService.startAutofill({projectId:p.id,startIndex:state.autofillStart||1,sequence});
    if(runId!==state.autofillRunId||state.project?.id!==p.id)return;
    const result=await followAutofillSequence(t.id,p.id,runId);
    if(!result)return;
    state.autofillStart=Math.min(state.project.scenes.length+1,nextMissingScene(0)+1);
    const missing=missingMediaIndices();
    setMedia({missingOnly:missing.length>0,activeScene:missing[0]??0,query:sceneSearchTerm(state.project.scenes[missing[0]??0]),searched:false});
    state.pages.media=0;renderProject();
    patchAutofillProgress({visible:true,percent:100,status:`Terminado: ${result.added} medios asignados de ${result.searched} búsquedas. ${missing.length} escenas siguen sin medio.`});
    if(missing.length){navigateStudioView('assets');$('media-missing-summary').scrollIntoView({behavior:'smooth',block:'start'});notice(`Revisa las ${missing.length} escenas sin medio`,true);}
    else{navigateStudioView('editor');notice('Storyboard completo. Editor listo.');}
  }catch(error){
    if(runId!==state.autofillRunId||state.project?.id!==p.id)return;
    notice(error.message,true);
    patchAutofillProgress({visible:true,status:`Error: ${error.message}`});
    if(missingMediaIndices().length){setMedia({missingOnly:true,activeScene:nextMissingScene(0)});state.pages.media=0;renderMediaBoard();$('media-missing-summary').scrollIntoView({behavior:'smooth',block:'start'});}
  }finally{if(runId===state.autofillRunId){state.autofillRunning=false;renderAutofillControls();}}
}
const sceneExtraActions={
  overlay(index,key,value){if(interaction().selectedScene!==index||!applyEditorEdit(overlayEdit(state.project,index,key,value)))return;renderScenePage();updatePreview(true);markEditorDirty();},
  toggleOverride(value){state.segmentOverrideMode=value;renderScenePage();},
  applyEffect(index,value){const scene=state.project?.scenes[index];if(!scene||interaction().selectedScene!==index||!['global','none',...videoEffects].includes(value))return;rememberEdit();scene.effectOverride=value==='global'?null:value;renderScenes();updatePreview(true);markEditorDirty();notice(`Efecto del segmento ${index+1} actualizado. Guarda la edición para conservarlo.`);},
  saveScene:withError(async()=>{if(interaction().selectedScene==null)throw Error('Selecciona un segmento');await saveProject();notice(`Cambios del segmento ${interaction().selectedScene+1} guardados`);})
};
function toggleTransition(value){if(!applyEditorEdit(toggleSequenceEdit(state.project,'transitionSequence',value,transitions)))return;renderGlobalControls();renderTimeline();updatePreview(true);markEditorDirty();}
const globalActions={toggleTransition,toggleEffect(value){if(!applyEditorEdit(toggleSequenceEdit(state.project,'effectSequence',value,videoEffects)))return;renderGlobalControls();renderTimeline();updatePreview(true);markEditorDirty();},change(key,value){if(!applyEditorEdit(settingEdit(state.project,key,value,['transitionDuration','imageFit','videoFit','blur','blurOpacity','motion','zoomPercent'])))return;renderGlobalControls();renderTimeline();updatePreview(true);markEditorDirty();},save:withError(async()=>{await saveProject();$('editor-global-dialog').close();notice('Ajustes globales guardados');})};
const formatActions={change(key,value){if(!applyEditorEdit(settingEdit(state.project,key,value,['ratio','quality','exportQuality','captions'])))return;renderFormatSettings({ratio:state.project.settings.ratio||'9:16',quality:state.project.settings.quality||'720p',exportQuality:state.project.settings.exportQuality||'high',captions:state.project.settings.captions!==false},formatActions);if(key==='exportQuality')renderExport();else {renderScenes();updatePreview(true);}markEditorDirty();}};
const timelineActions={
  select:selectTimeline,seek:seekExact,
  zoom(value){if(!Number.isFinite(value))return;state.timelineScale=Math.max(2,Math.min(120,value));renderTimeline();},
  pauseForDrag(){const wasPlaying=preview.playing;if(wasPlaying)setPreviewPlaying(false);return wasPlaying;},
  resumeDrag(){setPreviewPlaying(true).catch(error=>notice(error.message,true));},
  boundaryRange(index){const s=state.project?.scenes[index],next=state.project?.scenes[index+1];return s&&next?{min:s.start+.05,max:next.end-.05}:null;},
  beginEdit:rememberEdit,
  moveText(index,range){const edit=moveTextEdit(state.project,index,range);if(!edit)return;edit();renderTimeline();renderInspector();updatePreview(true);markEditorDirty();},
  trimBoundary(index,time){const edit=trimBoundaryEdit(state.project,index,time);if(!edit)return;edit();renderTimeline();updatePreview(true);markEditorDirty();},
  trimCue(type,index,edge,time){const edit=trimCueEdit(state.project,type,index,edge,time);if(!edit)return;edit();renderTimeline();updatePreview(true);markEditorDirty();},
  finishEdit(){renderScenes();markEditorDirty();}
};
const previewActions={play:withError(async()=>{requireProject();await setPreviewPlaying(!preview.playing);}),stop:withError(async()=>{requireProject();await setPreviewPlaying(false);seekExact(0);}),fromStart:withError(async()=>{requireProject();await setPreviewPlaying(false);seekExact(0);}),seek:seekExact,addText:()=>addTextAction()};
renderPreviewTransport({time:0,duration:0,playing:false},previewActions);
const exportActions={
  startMp4:withError(async()=>{const p=requireProject(),clickedAt=performance.now();patchExportProgress({running:true,mp4:'Preparando exportación…'});try{await saveProject();const t=await api(`/projects/${p.id}/render`,jsonOptions({requestElapsedMs:Math.round(performance.now()-clickedAt)}));await followTask(t,message=>patchExportProgress({mp4:message}));patchExportProgress({running:false,mp4:''});renderExport();notice('Exportación terminada');}catch(error){patchExportProgress({running:false,mp4:`Error: ${error.message}`});throw error;}}),
  downloadJson:withError(async()=>download(JSON.stringify(requireProject(),null,2),`${state.project.title}.json`,'application/json')),
  downloadSrt:withError(async()=>download(serializeSrt(requireProject().subtitleCues?.length?state.project.subtitleCues:state.project.cues),`${state.project.title}.srt`)),
  prepareCapcut:withError(async()=>{const p=requireProject();patchExportProgress({capcutRunning:true,capcut:'Preparando proyecto CapCut…',capcutResult:null});try{await saveProject();const t=await api(`/projects/${p.id}/capcut`,jsonOptions({}));const result=await followTask(t,message=>patchExportProgress({capcut:message}));patchExportProgress({capcutRunning:false,capcut:'',capcutResult:result});notice('Paquete CapCut preparado');}catch(error){patchExportProgress({capcutRunning:false,capcut:`Error: ${error.message}`});throw error;}})
};
renderExport();
loadProjects().catch(error=>notice(error.message,true));

const builtInTemplates=[
  {id:'headline',name:'Titular',type:'highlight',position:'center',font:'Anton',size:7.2,color:'#ffffff',accent:'#ff537e',background:0,animation:'pop'},
  {id:'person',name:'Ficha de persona',type:'lower-third',position:'bottom-left',font:'Inter',size:4.2,color:'#ffffff',accent:'#ff537e',background:65,animation:'slide'},
  {id:'location',name:'Lugar',type:'lower-third',position:'bottom-left',font:'Inter',size:4.5,color:'#ffffff',accent:'#ff537e',background:55,animation:'slide'},
  {id:'number',name:'Cifra',type:'highlight',position:'center',font:'Anton',size:10,color:'#ffffff',accent:'#ff537e',background:0,animation:'pop'},
  {id:'date',name:'Fecha',type:'lower-third',position:'top-left',font:'IBM Plex Mono',size:4.5,color:'#ffffff',accent:'#ff537e',background:55,animation:'fade'},
  {id:'timeline',name:'Línea temporal',type:'highlight',position:'bottom',font:'Inter',size:4.5,color:'#ffffff',accent:'#ff537e',background:45,animation:'slide'},
  {id:'comparison',name:'Comparación',type:'highlight',position:'center',font:'Inter',size:4.8,color:'#ffffff',accent:'#ff537e',background:55,animation:'fade'},
  {id:'list',name:'Lista',type:'highlight',position:'center-left',font:'Inter',size:4.5,color:'#ffffff',accent:'#ff537e',background:55,animation:'slide'},
  {id:'quote',name:'Cita',type:'highlight',position:'center',font:'Inter',size:5,color:'#ffffff',accent:'#ff537e',background:45,animation:'fade'},
  {id:'phrase',name:'Frase',type:'title',position:'center',font:'Inter',size:6.5,color:'#ffffff',accent:'#ff537e',background:0,animation:'fade'}
];
const customTemplates=()=>{try{return JSON.parse(localStorage.getItem('clip-studio-text-templates')||'[]').filter(x=>x?.id&&x?.name)}catch{return []}};
const allTemplates=()=>[...builtInTemplates,...customTemplates()];
async function loadTemplates(){try{const items=await api('/templates');localStorage.setItem('clip-studio-text-templates',JSON.stringify(items));renderTemplateLibrary();}catch{renderTemplateLibrary();}}
async function persistTemplates(items){await api('/templates',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(items)});localStorage.setItem('clip-studio-text-templates',JSON.stringify(items));renderTemplateLibrary();}
function renderTemplateLibrary(){renderTemplatePanel(allTemplates().map(t=>({id:t.id,name:t.name,custom:t.id.startsWith('custom-')})),templateActions);}
const editorSession=createEditorSession({
  getProject:()=>state.project,
  write:(id,payload)=>api(`/projects/${id}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}),
  onHistory:view=>renderEditorHistory(view,historyActions),
  onStatus:showEditorDirty,
  onRestore:p=>{restoreEditorSelection(p.scenes.length,p.textLayers.length);renderProject();}
});
function markEditorDirty(){editorSession.markDirty();}
function rememberEdit(){editorSession.remember();}
function applyEditorEdit(edit){if(!edit)return false;rememberEdit();edit();return true;}
function updateUndoButtons(){renderEditorHistory(editorSession.history(),historyActions);}
function selectTimeline(type,index,append=false){
  requireProject();
  selectEditorInteraction(type,index,append);
  renderScenes();
}
function addText(templateId='headline'){
  const p=requireProject(),template=allTemplates().find(t=>t.id===templateId)||builtInTemplates[0];
  const layer=createTextLayer(p,template,preview.time,crypto.randomUUID());
  rememberEdit();p.textLayers??=[];p.textLayers.push(layer);selectTimeline('text',p.textLayers.length-1);updatePreview(true);markEditorDirty();
}
async function saveSelectedTemplate(){
  const layer=state.project?.textLayers?.[interaction().selection?.type==='text'?interaction().selection.index:-1];if(!layer)throw Error('Selecciona un texto en el timeline');
  const name=window.prompt('Nombre de la nueva plantilla',`Mi ${allTemplates().find(t=>t.id===layer.templateId)?.name||'plantilla'}`)?.trim();if(!name)return;
  const t={id:`custom-${crypto.randomUUID()}`,name,type:layer.type,position:layer.position,font:layer.font,size:layer.size,color:layer.color,accent:layer.accent,background:layer.background,animation:layer.animation};const items=customTemplates();items.push(t);await persistTemplates(items);layer.templateId=t.id;renderInspector();notice(`Plantilla «${name}» guardada para todos tus proyectos`);
}
function applyTextTemplate(id){const layer=state.project?.textLayers?.[interaction().selection?.type==='text'?interaction().selection.index:-1],template=allTemplates().find(item=>item.id===id);if(!layer||!template)return;rememberEdit();Object.assign(layer,templateStylePatch(template));renderInspector();updatePreview(true);markEditorDirty();}
function updateTextField(index,key,raw){const layer=state.project?.textLayers?.[index];if(!layer||interaction().selection?.type!=='text'||interaction().selection.index!==index)return false;
  const change=textFieldValue(state.project,index,key,raw);if(!change)return false;
  rememberEdit();layer[key]=change.value;renderTimeline();if(key==='start'||key==='end')renderInspector();updatePreview(true);markEditorDirty();return true;
}
function updateSubtitleField(index,key,raw){const p=requireProject(),cue=(p.subtitleCues?.length?p.subtitleCues:p.cues)[index];if(!cue||interaction().selection?.type!=='subtitle'||interaction().selection.index!==index)return false;
  const change=subtitleFieldValue(p,index,key,raw);if(!change)return false;
  rememberEdit();cue[key]=change.value;renderTimeline();if(key==='start'||key==='end')renderInspector();updatePreview(true);markEditorDirty();return true;
}

// Editor contextual: cada pista selecciona sus propias propiedades.
const uiAction=handler=>event=>{try{Promise.resolve(handler(event)).catch(error=>notice(error.message,true));}catch(error){notice(error.message,true);}};
const historyActions={undo:()=>editorSession.undo(),redo:()=>editorSession.redo(),save:withError(async()=>{await editorSession.flush(true);notice('Edición guardada');})};
window.addEventListener('keydown',e=>{if(!document.getElementById('editor').classList.contains('active'))return;if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='z'){e.preventDefault();(e.shiftKey?historyActions.redo:historyActions.undo)();}else if(e.code==='Space'&&!/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName||'')){e.preventDefault();previewActions.play();}else if(['ArrowLeft','ArrowRight'].includes(e.key)&&!/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName||'')){e.preventDefault();seekExact(preview.time+(e.key==='ArrowRight'?1:-1)*(e.shiftKey?1:1/30));}});
const addTextAction=()=>uiAction(()=>addText())();
mountEditorInspector({scene:editorActions,sceneExtras:sceneExtraActions,inspector:inspectorActions,empty:{addText:addTextAction,addMusic:files=>inspectorActions.audioUpload('inspector-music-upload',files)}});
const templateActions={
  create:id=>uiAction(()=>addText(id))(),
  remove:id=>uiAction(async()=>persistTemplates(customTemplates().filter(t=>t.id!==id)))(),
  save:()=>uiAction(saveSelectedTemplate)()
};
updateUndoButtons();
loadTemplates();

const mediaPickerActions={
  close:()=>$('media-picker').close(),
  use(projectId,index,assetId){const p=state.project,scene=p?.scenes[index];if(p?.id!==projectId||!scene||!p.assets.some(asset=>asset.id===assetId))return;rememberEdit();scene.assetId=assetId;$('media-picker').close();renderScenes();renderMediaBoard();updatePreview(true);markEditorDirty();}
};

new ResizeObserver(sizePreviewStage).observe(document.querySelector('.editor-monitor'));
