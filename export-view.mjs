const formatTime=value=>{const n=Number(value)||0;return `${String(Math.floor(n/60)).padStart(2,'0')}:${String(Math.floor(n%60)).padStart(2,'0')}.${String(Math.round(n%1*1000)).padStart(3,'0')}`;};

export function exportView(project){
  if(!project)return {projectId:null,title:'',problems:['Crea o abre un proyecto'],summary:'',resolutionNote:'',exports:[],ready:null};
  const scenes=project.scenes||[],assets=project.assets||[],cues=project.cues||[],settings=project.settings||{};
  const available=new Set(assets.map(asset=>asset.id));
  const missing=scenes.filter(scene=>!available.has(scene.assetId)).length;
  const problems=[];
  if(!cues.length)problems.push('Falta el transcript SRT');
  if(!scenes.length)problems.push('Faltan escenas');
  if(missing)problems.push(`${missing} escenas sin asset`);
  const end=scenes.at(-1)?.end||0,voice=assets.find(asset=>asset.id===project.narrationId);
  if(voice&&voice.duration+0.5<end)problems.push(`La narración termina ${(end-voice.duration).toFixed(1)} s antes del video`);
  const vertical=settings.ratio!=='16:9',full=settings.quality==='1080p'?1080:720;
  const width=vertical?full:Math.round(full*16/9/2)*2,height=vertical?Math.round(full*16/9/2)*2:full;
  const used=new Set(scenes.map(scene=>scene.assetId));
  const visuals=assets.filter(asset=>used.has(asset.id)&&(asset.type==='image'||asset.type==='video'));
  const small=visuals.filter(asset=>asset.width&&asset.height&&(asset.width<width||asset.height<height));
  const resolutionNote=small.length?`${small.length} de ${visuals.length} medios visuales usados tienen menos de ${width}×${height} píxeles y se ampliarán. La exportación de alta calidad conserva mejor sus detalles, pero no puede crear detalle ausente en el original. Para máxima nitidez, usa medios de al menos ${width}×${height}.`:`Salida: ${width}×${height}. Calidad del MP4: ${{balanced:'Equilibrada',high:'Alta',maximum:'Máxima'}[settings.exportQuality]||'Alta'}.`;
  const exports=[...(project.exports||[])];
  return {projectId:project.id,title:project.title||'',problems,summary:`${scenes.length} escenas · ${formatTime(end)} · ${settings.ratio||'9:16'} · ${settings.quality||'720p'}`,resolutionNote,exports,ready:exports[0]?.renderDurationMs!=null?exports[0]:null};
}
