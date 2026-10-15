export const MEDIA_PAGE_SIZE=15;

export function saveAutofillSource(sequence,{index,type,provider}){
  if(type==='videos'&&provider==='google')throw Error('Google Images solo permite imágenes');
  if(!['videos','photos'].includes(type)||!['google','pexels','storyblocks'].includes(provider))throw Error('Fuente de medios inválida');
  const current=Array.isArray(sequence)?sequence:[];
  if(index===-1){
    if(current.length>=40)throw Error('La secuencia admite hasta 40 fuentes');
    return [...current.map(entry=>({...entry})),{type,provider}];
  }
  if(!Number.isInteger(index)||!current[index])throw Error('Fuente de medios no disponible');
  return current.map((entry,position)=>position===index?{type,provider}:{...entry});
}

export function removeAutofillSource(sequence,index){
  const current=Array.isArray(sequence)?sequence:[];
  return current.filter((_,position)=>position!==index).map(entry=>({...entry}));
}

export function missingMediaIndices(project){
  if(!project)return [];
  const available=new Set((project.assets||[]).map(asset=>asset.id));
  const missing=[];
  for(const [index,scene] of (project.scenes||[]).entries())if(!available.has(scene.assetId))missing.push(index);
  return missing;
}

export function mediaBoardIndices(project,missingOnly=false,missing=missingMediaIndices(project)){
  return missingOnly?missing:(project?.scenes||[]).map((_,index)=>index);
}

export function nextMissingScene(project,from=0,missing=missingMediaIndices(project)){
  return missing.find(index=>index>=from)??(project?.scenes?.length||0);
}

export function sceneSearchTerm(scene){
  return String(scene?.searchTerm||scene?.text||'').trim().slice(0,160);
}

export function pagination(total,page,size=MEDIA_PAGE_SIZE){
  const pages=Math.ceil(total/size);
  return {pages,current:Math.max(0,Math.min(page||0,Math.max(0,pages-1))),total};
}

export function mediaBoardView(project,session,page,size=MEDIA_PAGE_SIZE){
  const missing=missingMediaIndices(project),missingOnly=!!session.missingOnly&&missing.length>0;
  const indices=mediaBoardIndices(project,missingOnly,missing);
  const pageInfo=pagination(indices.length,page,size);
  const sceneCount=project?.scenes?.length||0;
  let active=session.activeScene;
  if(missingOnly&&!indices.includes(active))active=indices[0]??0;
  if(sceneCount&&active>=sceneCount)active=sceneCount-1;
  const assetById=new Map((project?.assets||[]).map(asset=>[asset.id,asset]));
  const chapterById=new Map((project?.chapters||[]).map(chapter=>[chapter.id,chapter]));
  const rows=indices.slice(pageInfo.current*size,(pageInfo.current+1)*size).map(index=>{
    const scene=project.scenes[index],asset=assetById.get(scene.assetId),chapter=chapterById.get(scene.chapterId);
    return {index,start:scene.start,end:scene.end,cueStart:scene.cueStart??index,cueEnd:scene.cueEnd??index,text:scene.text||'',searchTerm:scene.searchTerm||'',chapter:chapter?.name||'',assetId:scene.assetId||'',asset:asset?{id:asset.id,name:asset.name,type:asset.type}:null};
  });
  return {
    missing,missingItems:missing.map(index=>({index,text:project.scenes[index]?.text||''})),
    missingOnly,indices,page:pageInfo,active,
    target:session.assetTargetScene!=null&&project?.scenes?.[session.assetTargetScene]?session.assetTargetScene:null,
    targetScenes:(project?.scenes||[]).map((scene,index)=>({index,cueStart:scene.cueStart??index,cueEnd:scene.cueEnd??index})),
    rows,visualAssets:(project?.assets||[]).filter(asset=>asset.type==='image'||asset.type==='video').map(asset=>({id:asset.id,name:asset.name})),
    query:session.query||sceneSearchTerm(project?.scenes?.[active])
  };
}
