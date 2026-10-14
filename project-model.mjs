import {migrateProjectTransitions,videoEffects} from './studio-core.mjs';

export function ensureEditorSettings(project){
  const settings=project.settings??={},scenes=project.scenes||[];
  project.settings=settings;
  settings.transitionSequence??=[...new Set(scenes.map(scene=>scene.transition).filter(Boolean))];
  migrateProjectTransitions(project);
  if(!settings.transitionSequence.length)settings.transitionSequence=['remotion:none'];
  settings.effectSequence??=[...new Set(scenes.map(scene=>scene.effect).filter(effect=>videoEffects.includes(effect)))];
  settings.transitionDuration??=scenes[0]?.transitionDuration??.45;
  settings.fit??=scenes[0]?.fit||'blur';settings.imageFit??=settings.fit;settings.videoFit??='fill';settings.blur??=scenes[0]?.blur??20;
  settings.blurOpacity??=0;settings.motion??=scenes[0]?.motion||'static';settings.zoomPercent??=10;
  settings.sceneMode??='srt';
}

export function migrateLegacySources(project){
  const list=Array.isArray(project.rawChapters)?project.rawChapters:null;
  if(!list?.length||project.rawSearchTerms||list.some(row=>row?.startText||!row?.searchTerm))return false;
  project.rawSearchTerms=list;project.rawChapters=null;project.chapters=[];project.chapterGrouping={};project.chapterValidationError='';project.settings.sceneMode='srt';
  if(project.scenes?.length===list.length)project.scenes.forEach((scene,index)=>{scene.searchTerm||=String(list[index].searchTerm);scene.chapterId=null;});
  return true;
}

export function sourceCount(value){
  return Array.isArray(value)?value.length:Array.isArray(value?.chapters)?value.chapters.length:Array.isArray(value?.items)?value.items.length:0;
}
