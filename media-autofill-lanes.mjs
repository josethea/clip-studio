// Each lane runs asynchronous searches and short-lived FFmpeg processes. No persistent
// worker threads are needed; the promises and their references end with the batch.
export async function runMediaAutofillLanes(items,processItem,{videoConcurrency=2,imageConcurrency=1,onSettled=()=>{}}={}){
  const lanes={videos:[],photos:[]};
  for(const item of items)lanes[item.choice.type].push(item);
  let stopped=false,firstError=null;
  const worker=async queue=>{
    while(queue.length&&!stopped){
      const item=queue.shift();
      try{await processItem(item);onSettled(item);}
      catch(error){firstError??=error;stopped=true;}
    }
  };
  await Promise.all([
    ...Array.from({length:Math.min(videoConcurrency,lanes.videos.length)},()=>worker(lanes.videos)),
    ...Array.from({length:Math.min(imageConcurrency,lanes.photos.length)},()=>worker(lanes.photos))
  ]);
  if(firstError)throw firstError;
}
