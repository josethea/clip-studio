const templateFields=['type','font','size','color','accent','background','animation'];

export function createTextLayer(project,template,previewTime,id){
  const end=project.scenes.at(-1)?.end||0;
  if(!end)throw Error('Crea primero el storyboard');
  const start=Math.min(previewTime,Math.max(0,end-.3)),duration=Math.min(3,end-start);
  return {...template,id,templateId:template.id,text:'Nuevo texto',highlight:'',start,end:start+duration};
}

export function templateStylePatch(template){
  return Object.fromEntries([...templateFields,'templateId'].map(key=>[key,key==='templateId'?template.id:template[key]]));
}

export function textFieldValue(project,index,key,raw){
  const layer=project?.textLayers?.[index];if(!layer)return null;
  const value=['start','end','size','background'].includes(key)?Number(raw):raw;
  if(key==='start'&&!(value>=0&&value<layer.end-.03))return null;
  if(key==='end'&&!(value>layer.start+.03&&value<=project.scenes.at(-1).end))return null;
  return {value};
}

export function subtitleFieldValue(project,index,key,raw){
  const cue=(project?.subtitleCues?.length?project.subtitleCues:project?.cues)?.[index];if(!cue)return null;
  const value=key==='text'?raw:Number(raw),end=project.scenes.at(-1)?.end||0;
  if(key==='start'&&!(value>=0&&value<cue.end-.03))return null;
  if(key==='end'&&!(value>cue.start+.03&&value<=end))return null;
  return {value};
}
