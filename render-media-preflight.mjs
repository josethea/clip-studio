import {mkdirSync,readFileSync,renameSync,rmSync,statSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';

const execute=promisify(execFile);

async function videoFormat(file){
  const {stdout}=await execute('ffprobe',['-v','error','-select_streams','v:0','-show_entries','stream=codec_name,pix_fmt,width,height,duration:format=duration','-of','json',file]);
  const data=JSON.parse(stdout),stream=data.streams?.[0];
  if(!stream)throw Error('El video no contiene una pista visual');
  return {...stream,duration:Number(data.format?.duration||stream.duration)||0};
}

export async function preparePlayableVideoAssets(project,folder,prepared,update=()=>{}){
  const used=new Set((project.scenes||[]).map(scene=>scene.assetId));
  const videos=(project.assets||[]).filter(asset=>asset.type==='video'&&used.has(asset.id));
  const proxies=join(folder,'renders','compatible');mkdirSync(proxies,{recursive:true});
  let converted=0;
  for(const [index,asset] of videos.entries()){
    const source=join(folder,'assets',asset.file),format=await videoFormat(source);
    const scenes=(prepared.scenes||[]).filter(scene=>scene.assetId===asset.id);
    const trimStart=Math.max(0,Math.min(...scenes.map(scene=>Number(scene.sourceStart)||0)));
    const trimEnd=Math.max(...scenes.map(scene=>(Number(scene.sourceStart)||0)+Math.max(0,scene.end-scene.start)+.5));
    const trimDuration=Math.max(.1,trimEnd-trimStart);
    const maxWidth=Math.min(1920,Math.max(2,prepared.width||1920));
    const maxHeight=Math.min(1920,Math.max(2,prepared.height||1080));
    const compatible=format.codec_name==='h264'&&format.pix_fmt==='yuv420p';
    const oversized=format.width>maxWidth||format.height>maxHeight;
    const tooLong=format.duration>trimEnd+2;
    const tooShort=format.duration<trimEnd-.1;
    const target=prepared.assets.find(item=>item.id===asset.id);
    if(target)target.offthread=true;
    if(compatible&&!oversized&&!tooLong&&!tooShort)continue;
    const proxy=join(proxies,`${asset.id}.mp4`),metadata=`${proxy}.json`,sourceStat=statSync(source);
    const signature={version:2,size:sourceStat.size,mtimeMs:sourceStat.mtimeMs,maxWidth,maxHeight,trimStart,trimDuration};
    let fresh=false;
    try{
      const proxyStat=statSync(proxy),proxyFormat=await videoFormat(proxy);
      fresh=proxyStat.size>0&&JSON.stringify(JSON.parse(readFileSync(metadata,'utf8')))===JSON.stringify(signature)&&proxyFormat.codec_name==='h264'&&proxyFormat.pix_fmt==='yuv420p'&&proxyFormat.width<=maxWidth&&proxyFormat.height<=maxHeight;
    }catch{}
    update(1+Math.round(index/Math.max(1,videos.length)*8),`Preparando extracto ${index+1}/${videos.length}: ${asset.name}`);
    if(!fresh){
      const temporary=join(proxies,`${asset.id}.${process.pid}.tmp.mp4`);
      try{
        await execute('ffmpeg',['-y','-hide_banner','-loglevel','error',...(tooShort?['-stream_loop','-1']:[]),'-ss',String(trimStart),'-i',source,'-t',String(trimDuration),'-map','0:v:0','-an','-vf',`scale=${maxWidth}:${maxHeight}:force_original_aspect_ratio=decrease:force_divisible_by=2,fps=30`,'-c:v','libx264','-preset','veryfast','-crf','18','-g','30','-pix_fmt','yuv420p','-movflags','+faststart',temporary],{maxBuffer:2_000_000});
        const result=await videoFormat(temporary);
        if(result.codec_name!=='h264'||result.pix_fmt!=='yuv420p')throw Error('La conversión no produjo H.264 compatible');
        renameSync(temporary,proxy);
        writeFileSync(metadata,JSON.stringify(signature));
      }catch(error){rmSync(temporary,{force:true});throw Error(`No se pudo preparar «${asset.name}» para exportar: ${error.message}`);}
      converted++;
    }
    if(target)target.url+=`?renderProxy=1`;
    for(const scene of scenes)scene.sourceStart=Math.max(0,(Number(scene.sourceStart)||0)-trimStart);
  }
  return {checked:videos.length,converted};
}
