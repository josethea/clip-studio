import {join} from 'node:path';
import {createWorker} from 'tesseract.js';

const WATERMARK_TERMS=/\b(?:shutterstock|alamy|getty\s*images?|istock|adobe\s*stock|dreamstime|depositphotos|123rf|freepik|envato|vecteezy|watermark|sample|preview)\b|©/i;
const LOGO_TERMS=/\b(?:youtube|tiktok|instagram|facebook|pinterest|snapchat|twitter|x\.com|linkedin)\b/i;
const slots=Array.from({length:5},()=>({workerPromise:null,busy:false}));
const waiters=[];
const abortError=()=>Object.assign(Error('Análisis cancelado'),{name:'AbortError'});

function linesFromBlocks(blocks){
  return (blocks||[]).flatMap(block=>(block.paragraphs||[]).flatMap(paragraph=>paragraph.lines||[]));
}

function coveredFraction(boxes,width,height){
  const cells=new Uint8Array(10000);
  for(const box of boxes){
    const x0=Math.max(0,Math.min(99,Math.floor(box.x0/width*100)));
    const y0=Math.max(0,Math.min(99,Math.floor(box.y0/height*100)));
    const x1=Math.max(x0+1,Math.min(100,Math.ceil(box.x1/width*100)));
    const y1=Math.max(y0+1,Math.min(100,Math.ceil(box.y1/height*100)));
    for(let y=y0;y<y1;y++)cells.fill(1,y*100+x0,y*100+x1);
  }
  return cells.reduce((sum,value)=>sum+value,0)/10000;
}

export function assessRecognizedText(blocks,width,height,{maxTextFraction=.10,sourceUrl=''}={}){
  if(!(width>0&&height>0))throw Error('Dimensiones de imagen inválidas');
  const lines=linesFromBlocks(blocks),words=lines.flatMap(line=>line.words||[]).filter(word=>word.bbox&&String(word.text||'').trim());
  const reliable=words.filter(word=>Number(word.confidence)>=55&&/[\p{L}\p{N}]{2,}/u.test(word.text));
  const recognized=reliable.map(word=>word.text).join(' ');
  const sourceHost=(()=>{try{const host=new URL(sourceUrl).hostname.replace(/^www\./,'').split('.')[0];return ['images','image','img','cdn','media','static','assets','photo','photos'].includes(host)?'':host;}catch{return '';}})();
  const sourceMark=sourceHost.length>=5&&reliable.some(word=>word.text.toLowerCase().includes(sourceHost.toLowerCase()));
  const watermark=sourceMark||WATERMARK_TERMS.test(recognized);
  const logoText=LOGO_TERMS.test(recognized);
  const regions=lines.flatMap(line=>{
    const lineWords=(line.words||[]).filter(word=>reliable.includes(word));
    if(!lineWords.length)return [];
    return [{x0:Math.min(...lineWords.map(word=>word.bbox.x0)),y0:Math.min(...lineWords.map(word=>word.bbox.y0)),x1:Math.max(...lineWords.map(word=>word.bbox.x1)),y1:Math.max(...lineWords.map(word=>word.bbox.y1))}];
  });
  const fraction=coveredFraction(regions,width,height);
  const tooMuchText=fraction>maxTextFraction;
  const approved=!watermark&&!logoText&&!tooMuchText;
  const reason=watermark?'Marca de agua o crédito detectado':logoText?'Marca o logotipo con texto detectado':tooMuchText?`Texto ocupa ${Math.round(fraction*100)}% de la imagen (máximo ${Math.round(maxTextFraction*100)}%)`:'Texto dentro del límite';
  return {approved,textPercent:Math.round(fraction*1000)/10,maxTextPercent:Math.round(maxTextFraction*100),wordCount:reliable.length,watermarkDetected:watermark,logoTextDetected:logoText,reason,engine:'Tesseract OCR local',visualLogoReviewRequired:true};
}

function acquire(signal){
  if(signal?.aborted)return Promise.reject(abortError());
  const slot=slots.find(item=>!item.busy);
  if(slot){slot.busy=true;return Promise.resolve(slot);}
  return new Promise((resolve,reject)=>{
    const waiter={resolve,reject,signal};
    waiter.abort=()=>{const index=waiters.indexOf(waiter);if(index>=0)waiters.splice(index,1);reject(abortError());};
    signal?.addEventListener('abort',waiter.abort,{once:true});waiters.push(waiter);
  });
}
function release(slot){
  while(waiters.length){const waiter=waiters.shift();waiter.signal?.removeEventListener('abort',waiter.abort);if(waiter.signal?.aborted){waiter.reject(abortError());continue;}waiter.resolve(slot);return;}
  slot.busy=false;
}
export async function screenLocalImage(file,width,height,options={}){
  const {signal,...assessment}=options;
  const slot=await acquire(signal);
  let worker;
  try{
    if(signal?.aborted)throw abortError();
    slot.workerPromise??=createWorker(['eng','spa'],1,{langPath:join(import.meta.dirname,'models','tessdata'),cacheMethod:'none'}).catch(error=>{slot.workerPromise=null;throw error;});
    worker=await slot.workerPromise;
    if(signal?.aborted)throw abortError();
    let onAbort;
    const stopped=new Promise((_,reject)=>{onAbort=()=>reject(abortError());signal?.addEventListener('abort',onAbort,{once:true});});
    try{
      const {data}=await (signal?Promise.race([worker.recognize(file,{}, {blocks:true}),stopped]):worker.recognize(file,{}, {blocks:true}));
      return assessRecognizedText(data.blocks,width,height,assessment);
    }finally{signal?.removeEventListener('abort',onAbort);}
  }catch(error){
    if(error.name==='AbortError'&&worker){slot.workerPromise=null;await worker.terminate().catch(()=>{});}
    else if(error.name!=='AbortError')slot.workerPromise=null;
    throw error;
  }finally{release(slot);}
}
