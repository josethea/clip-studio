import {effectiveScene,transitionSeconds} from './studio-core.mjs';

export function prepareRemotionProject(project,origin){
  const p=project,ratio=p.settings?.ratio==='16:9'?'16:9':'9:16',quality=p.settings?.quality==='1080p'?1080:720;
  const width=ratio==='9:16'?quality:Math.round(quality*16/9/2)*2;
  const height=ratio==='9:16'?Math.round(quality*16/9/2)*2:quality;
  const base=String(origin).replace(/\/$/,'');
  return {
    id:p.id,width,height,duration:p.scenes?.at(-1)?.end||0,fontBase:`${base}/fonts`,settings:{...p.settings,ratio},
    scenes:(p.scenes||[]).map((scene,i)=>({...effectiveScene(p,scene,i),transitionSeconds:transitionSeconds(p,i)})),
    assets:(p.assets||[]).map(asset=>({...asset,url:`${base}/api/studio/projects/${encodeURIComponent(p.id)}/assets/${encodeURIComponent(asset.id)}`})),
    narrationId:p.narrationId,musicId:p.musicId,cues:p.cues||[],subtitleCues:p.subtitleCues||[],
    textLayers:p.textLayers||[],words:p.wordsJson?.words||[]
  };
}
