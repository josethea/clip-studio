import {createHmac} from 'node:crypto';

const base='https://api.storyblocks.com';
export function signedStoryblocksUrl(path,params,publicKey,secretKey,now=Date.now()){
  if(!/^\/api\/v2\/(videos|images)\//.test(path))throw Error('Ruta de Storyblocks inválida');
  const expires=String(Math.floor(now/1000)+3600);
  const hmac=createHmac('sha256',`${secretKey}${expires}`).update(path).digest('hex');
  const url=new URL(path,base);
  for(const [key,value] of Object.entries(params))if(value!==undefined&&value!==null)url.searchParams.set(key,String(value));
  url.searchParams.set('APIKEY',publicKey);url.searchParams.set('EXPIRES',expires);url.searchParams.set('HMAC',hmac);
  return url;
}

function formats(item,kind){
  const groups=item.download_formats||{},preferred=Object.entries(groups).filter(([name])=>kind==='image'?/^(JPG|JPEG|PNG)$/i.test(name):/^MP4$/i.test(name));
  return (preferred.length?preferred.map(([,group])=>group):Object.values(groups)).flatMap(group=>group&&typeof group==='object'&&('width'in group||'height'in group)?[group]:Object.values(group||{})).filter(x=>x&&typeof x==='object');
}
export function storyblocksDimensions(item,kind='video'){
  const dimensions=formats(item,kind).map(x=>({width:Number(x.width)||0,height:Number(x.height)||0})).sort((a,b)=>b.width*b.height-a.width*a.height)[0];
  if(dimensions?.width&&dimensions?.height)return dimensions;
  const label=String(item.maxResolution||'').toLowerCase();
  const height=Number(item.maxResolution)||(/8k/.test(label)?4320:/4k/.test(label)?2160:/hd/.test(label)?1080:Number(label.match(/\d+/)?.[0])||0);
  const aspect=Number(item.aspectRatio||item.aspect_ratio)||0;
  return {width:height&&aspect?Math.round(height*aspect):0,height};
}
export function rankStoryblocks(items,kind='video'){
  return [...items].sort((a,b)=>{
    const da=storyblocksDimensions(a,kind),db=storyblocksDimensions(b,kind);
    const ra=Number(a.aspectRatio||a.aspect_ratio)||da.width/da.height||0;
    const rb=Number(b.aspectRatio||b.aspect_ratio)||db.width/db.height||0;
    const fit=r=>r?Math.abs(Math.log(r/(16/9))):Infinity;
    const horizontal=x=>x.orientation==='horizontal'||storyblocksDimensions(x,kind).width>storyblocksDimensions(x,kind).height;
    const a16=horizontal(a)&&fit(ra)<=0.08,b16=horizontal(b)&&fit(rb)<=0.08;
    const pixels=db.width*db.height-da.width*da.height;
    if(pixels)return pixels;
    if(a16!==b16)return a16?-1:1;
    if(horizontal(a)!==horizontal(b))return horizontal(a)?-1:1;
    return fit(ra)-fit(rb);
  });
}
export function bestStoryblocksMp4(downloads){
  const entries=Object.entries(downloads?.MP4||{}).filter(([,url])=>typeof url==='string'&&url.startsWith('https://'));
  return entries.sort(([a],[b])=>Number(b.match(/\d+/)?.[0]||0)-Number(a.match(/\d+/)?.[0]||0))[0]?.[1]||null;
}
export function bestStoryblocksImage(downloads){
  const candidates=[];
  for(const format of ['JPG','JPEG','PNG']){
    if(typeof downloads?.[format]==='string'&&downloads[format].startsWith('https://'))candidates.push({url:downloads[format],format,score:format==='PNG'?1:2});
    for(const [label,value] of Object.entries(typeof downloads?.[format]==='object'?downloads[format]:{})){
      if(typeof value==='string'&&value.startsWith('https://'))candidates.push({url:value,format,score:Number(label.match(/\d+/)?.[0]||0)});
      else if(value&&typeof value==='object')for(const item of Object.values(value))if(typeof item==='string'&&item.startsWith('https://'))candidates.push({url:item,format,score:Number(label.match(/\d+/)?.[0]||0)});
    }
  }
  candidates.sort((a,b)=>b.score-a.score);
  return candidates[0]||null;
}
