import {makeScenes,resolveChapters,validateSearchTerms} from './studio-core.mjs';

export function refreshChapterMapping(project,strict=false){
  project.chapters=[];project.chapterValidationError='';
  if(!project.rawChapters)return;
  if(!project.script?.trim()||!project.cues?.length){
    project.chapterValidationError='Carga el guion y el SRT de trabajo para ubicar los capítulos';
    if(strict)throw Error(project.chapterValidationError);
    return;
  }
  try{project.chapters=resolveChapters(project.rawChapters,project.cues,project.script);}
  catch(error){project.chapterValidationError=error.message;if(strict)throw error;}
}

export function buildStoryboard(project){
  const cues=project.cues;
  if(!cues?.length)throw Error('Carga un SRT o genera uno desde Words JSON');
  refreshChapterMapping(project,!!project.rawChapters);
  const mode=project.settings.sceneMode||'srt';
  if(mode==='chapter'&&!project.chapters.length)throw Error('Carga y valida un JSON de capítulos para agrupar bloques');
  if(mode==='chapter')for(const chapter of project.chapters){
    const size=Number(project.chapterGrouping?.[chapter.id]||1);
    if(!Number.isInteger(size)||size<1||size>chapter.cueCount)throw Error(`Cada capítulo admite entre 1 y ${chapter.cueCount} bloques por asset`);
  }
  const terms=project.rawSearchTerms?validateSearchTerms(project.rawSearchTerms,cues):null;
  if(terms&&mode==='chapter'&&project.chapters.some(chapter=>Number(project.chapterGrouping?.[chapter.id]||1)>1)){
    throw Error('Search terms es 1 a 1. Usa una escena por bloque SRT o configura 1 bloque por asset en todos los capítulos.');
  }
  project.scenes=makeScenes(cues,project.chapters,mode,{grouping:project.chapterGrouping,searchTerms:terms?.rows});
  return {sceneCount:project.scenes.length,cueCount:cues.length,warningCount:terms?.warnings.length||0};
}

export function assignInitialAssets(project,mode='basic'){
  const available=project.assets.filter(asset=>asset.type==='image'||asset.type==='video'),used=new Set();
  for(const [index,scene] of project.scenes.entries()){
    const id=String(index+1),chapter=project.chapters.find(item=>item.id===scene.chapterId);
    let match=available.find(asset=>!used.has(asset.id)&&(asset.name.match(new RegExp(`(^|\\D)0*${id}(\\D|$)`))||(mode==='smart'&&chapter&&asset.chapter===chapter.name)));
    if(!match)match=available.find(asset=>!used.has(asset.id));
    if(match){scene.assetId=match.id;used.add(match.id);}
  }
  return used.size;
}
