import {mkdirSync,renameSync,rmSync,statSync} from 'node:fs';
import {join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';

const execute=promisify(execFile);

export async function prepareRenderImages(project,folder,prepared,update=()=>{}){
  const scenes=project.scenes||[];
  const used=new Set(scenes.map(scene=>scene.assetId));
  const images=(project.assets||[]).filter(asset=>asset.type==='image'&&used.has(asset.id));
  const width=prepared.width,height=prepared.height;
  const directory=join(folder,'renders','images');mkdirSync(directory,{recursive:true});
  let converted=0;
  for(const [index,asset] of images.entries()){
    // Cropped images need their source resolution. Contained and framed images
    // cannot display more detail than the export canvas can show.
    if(asset.width<=width&&asset.height<=height||scenes.some(scene=>scene.assetId===asset.id&&scene.fit==='fill'))continue;
    const source=join(folder,'assets',asset.file),proxy=join(directory,`${asset.id}.png`);
    let fresh=false;
    try{const original=statSync(source),cached=statSync(proxy);fresh=cached.size>0&&cached.mtimeMs>=original.mtimeMs;}catch{}
    if(!fresh){
      update(9+Math.round(index/Math.max(1,images.length)*2),`Optimizando imagen ${index+1}/${images.length}`);
      const temporary=join(directory,`${asset.id}.${process.pid}.tmp.png`);
      try{
        await execute('ffmpeg',['-y','-hide_banner','-loglevel','error','-i',source,'-vf',`scale=${width}:${height}:force_original_aspect_ratio=decrease:force_divisible_by=2`,'-frames:v','1','-update','1',temporary],{maxBuffer:2_000_000});
        if(!statSync(temporary).size)throw Error('FFmpeg produjo una imagen vacía');
        renameSync(temporary,proxy);
      }catch(error){rmSync(temporary,{force:true});throw Error(`No se pudo preparar «${asset.name}» para exportar: ${error.message}`);}
      converted++;
    }
    const target=prepared.assets.find(item=>item.id===asset.id);
    if(target)target.url+='?renderImage=1';
  }
  return {checked:images.length,converted};
}
