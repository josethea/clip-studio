const pixels=item=>(Number(item.width)||0)*(Number(item.height)||0);

export function rankByResolution(items){
  return [...items].sort((a,b)=>pixels(b)-pixels(a)||(Number(b.width)||0)-(Number(a.width)||0));
}

export function bestPexelsVideoFile(video){
  return rankByResolution((video.video_files||[]).filter(file=>file.file_type==='video/mp4'&&file.link))[0]||null;
}

export function pexelsSearchItems(data,type){
  const items=type==='photos'?(data.photos||[]).map(photo=>({
    id:photo.id,type:'image',name:`Pexels ${photo.id}`,preview:photo.src?.medium,
    url:photo.src?.original||photo.src?.large2x,source:photo.url,creator:photo.photographer,
    width:Number(photo.width)||0,height:Number(photo.height)||0
  })):(data.videos||[]).map(video=>{
    const file=bestPexelsVideoFile(video);
    return {id:video.id,type:'video',name:`Pexels ${video.id}`,preview:video.image,
      url:file?.link,source:video.url,creator:video.user?.name,duration:video.duration,
      width:Number(file?.width)||0,height:Number(file?.height)||0};
  });
  return rankByResolution(items.filter(item=>item.url));
}
