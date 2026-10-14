// Each planner validates an edit and returns a small mutation to run after
// the controller records its undo snapshot. A rejected edit returns null.
export function sceneFieldEdit(project,index,field,value){
  const scene=project?.scenes?.[index];
  return scene?()=>{scene[field]=value;}:null;
}

export function effectOverrideEdit(project,index,value){
  const scene=project?.scenes?.[index];
  return scene?()=>{if(value==='global')delete scene.effectOverride;else scene.effectOverride=value;}:null;
}

export function transitionOverrideEdit(project,index,value,allowed){
  const scene=project?.scenes?.[index];
  return scene&&allowed.includes(value)?()=>{scene.transitionOverride=value;}:null;
}

export function transitionDurationEdit(project,index,value){
  const scene=project?.scenes?.[index];
  return scene&&Number.isFinite(value)&&value>=0&&value<=2?()=>{scene.transitionDurationOverride=value;}:null;
}

export function inheritTransitionEdit(project,index){
  const scene=project?.scenes?.[index];
  return scene?()=>{delete scene.transitionOverride;delete scene.transitionDurationOverride;}:null;
}

export function sceneSfxEdit(project,index,key,value){
  const scene=project?.scenes?.[index];
  return scene&&['sfxId','sfxVolume','sfxAlign','sfxOffset'].includes(key)?()=>{scene[key]=value;}:null;
}

export function audioSelectionEdit(project,key,value){
  return project&&['narrationId','musicId'].includes(key)?()=>{project[key]=value||null;}:null;
}

export function musicVolumeEdit(project,value){
  return project&&Number.isFinite(value)&&value>=0&&value<=100?()=>{project.settings.musicVolume=value;}:null;
}

export function captionSettingEdit(project,key,value){
  if(!project||!['captionStyle','captionFont','captionSize','captionPosition','captionColor','captionAccent'].includes(key))return null;
  if(key==='captionStyle'&&value==='dynamic'&&!project.wordsJson?.words?.length)return null;
  if(project.settings[key]===value)return null;
  return ()=>{project.settings[key]=value;};
}

export function multiEffectEdit(project,selection,value,allowed){
  const indices=selection.filter(item=>item.type==='scene'&&project?.scenes?.[item.index]).map(item=>item.index);
  if(!indices.length||value!=='global'&&!allowed.includes(value))return null;
  return ()=>{for(const index of indices)project.scenes[index].effectOverride=value==='global'?null:value;};
}

export function multiHideSubtitlesEdit(project,selection){
  const indices=selection.filter(item=>item.type==='subtitle'&&project?.subtitleCues?.[item.index]).map(item=>item.index);
  return indices.length?()=>{for(const index of indices)project.subtitleCues[index].hidden=true;}:null;
}

export function multiDeleteTextEdit(project,selection){
  const indices=selection.filter(item=>item.type==='text'&&project?.textLayers?.[item.index]).map(item=>item.index).sort((a,b)=>b-a);
  return indices.length?()=>{for(const index of indices)project.textLayers.splice(index,1);}:null;
}

export function overlayEdit(project,index,key,value){
  const scene=project?.scenes?.[index];
  if(!scene||!['overlayId','overlayStart','overlayDuration','overlayPosition','overlaySize','overlayOpacity','overlayAnimation'].includes(key))return null;
  return ()=>{scene[key]=key==='overlayId'?value||null:value;};
}

export function toggleSequenceEdit(project,key,value,allowed){
  if(!project||!allowed.includes(value)||!['transitionSequence','effectSequence'].includes(key))return null;
  return ()=>{
    const list=project.settings[key],index=list.indexOf(value);
    if(index>=0)list.splice(index,1);
    else{
      if(key==='transitionSequence'&&list.length===1&&list[0]==='remotion:none'&&value!=='remotion:none')list.length=0;
      list.push(value);
    }
    if(key==='transitionSequence'&&!list.length)list.push('remotion:none');
  };
}

export function settingEdit(project,key,value,allowed){
  return project&&allowed.includes(key)?()=>{project.settings[key]=value;}:null;
}

export function moveTextEdit(project,index,range){
  const layer=project?.textLayers?.[index];
  return layer?()=>{layer.start=range.start;layer.end=range.end;}:null;
}

export function trimBoundaryEdit(project,index,time){
  const scene=project?.scenes?.[index],next=project?.scenes?.[index+1];
  return scene&&next?()=>{scene.end=time;next.start=time;}:null;
}

export function trimCueEdit(project,type,index,edge,time){
  const item=type==='text'?project?.textLayers?.[index]:(project?.subtitleCues?.length?project.subtitleCues:project?.cues)?.[index];
  if(!item||!['start','end'].includes(edge))return null;
  const snapped=Math.round(Math.max(0,time)*30)/30;
  return ()=>{
    if(edge==='start')item.start=Math.max(0,Math.min(item.end-1/30,snapped));
    else item.end=Math.max(item.start+1/30,Math.min(project.scenes.at(-1).end,snapped));
  };
}
