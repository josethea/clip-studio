const copy=cues=>(cues||[]).map(cue=>({...cue}));
const labels={original:'SRT original',combined:'SRT combinado',generated:'SRT generado',current:'Subtítulos actuales'};

export function ensureSubtitleSources(project){
  if(project.subtitleSources)return false;
  const original=copy(project.sourceCues);
  const current=copy(project.subtitleCues?.length?project.subtitleCues:original);
  const same=JSON.stringify(original)===JSON.stringify(current);
  project.subtitleSources={original};
  if(!same)project.subtitleSources.current=current;
  project.subtitleSource=same?'original':'current';
  return true;
}
export function subtitleSourceOptions(project){
  return Object.entries(project.subtitleSources||{}).filter(([,cues])=>cues?.length).map(([id])=>({id,label:labels[id]||id}));
}
export function selectSubtitleSource(project,id){
  if(!project.subtitleSources?.[id]?.length)return false;
  if(project.subtitleSource&&project.subtitleSources[project.subtitleSource])project.subtitleSources[project.subtitleSource]=copy(project.subtitleCues);
  project.subtitleSource=id;
  project.subtitleCues=copy(project.subtitleSources[id]);
  return true;
}
