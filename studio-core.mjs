import {referenceWordsToSrt} from './reference-transcript.mjs';
export const transitions = ['Corte','Left','Pick Another','Zoom Swipe','Dive & Bounce','Snapshot Glam','Pull & Reveal','Fundido','Deslizar derecha','Deslizar arriba','Deslizar abajo','Barrido izquierda','Barrido derecha','Círculo cierre','Disolver','Pixelado','Blur','Flash'];
export const transitionFilters = { 'Left':'slideleft', 'Pick Another':'fade', 'Zoom Swipe':'zoomin', 'Dive & Bounce':'circleopen', 'Snapshot Glam':'fadeblack', 'Pull & Reveal':'wiperight','Fundido':'fade','Deslizar derecha':'slideright','Deslizar arriba':'slideup','Deslizar abajo':'slidedown','Barrido izquierda':'wipeleft','Barrido derecha':'wiperight','Círculo cierre':'circleclose','Disolver':'dissolve','Pixelado':'pixelize','Blur':'hblur','Flash':'fadewhite' };
export const videoEffects = ['warm','cool','mono','vivid','vintage','contrast','soft','fade','green','purple'];
export const imageMotions = ['static','zoom-in','zoom-out','pan-left','pan-right','pan-up','pan-down','pulse'];
export function effectiveScene(project,scene,index){
  const settings=project.settings||{};
  const mediaType=project.assets?.find(a=>a.id===scene.assetId)?.type;
  const transitionSequence=Array.isArray(settings.transitionSequence)?settings.transitionSequence.filter(x=>transitions.includes(x)):[scene.transition||'Corte'];
  const effectSequence=Array.isArray(settings.effectSequence)?settings.effectSequence.filter(x=>videoEffects.includes(x)):[scene.effect||'none'];
  return {...scene,
    transition:scene.transitionOverride||transitionSequence[index%Math.max(1,transitionSequence.length)]||'Corte',
    transitionDuration:Number(scene.transitionDurationOverride??settings.transitionDuration??scene.transitionDuration??.45),
    effect:scene.effectOverride||effectSequence[index%Math.max(1,effectSequence.length)]||'none',
    fit:scene.fitOverride||(mediaType==='video'?(settings.videoFit||'fill'):(settings.imageFit||settings.fit||scene.fit||'blur')),
    blur:Number(settings.blur??scene.blur??20),
    blurOpacity:Number(settings.blurOpacity??0),
    motion:scene.motionOverride||settings.motion||scene.motion||'static',
    zoomPercent:Number(scene.zoomPercentOverride??settings.zoomPercent??10)};
}
export function transitionSeconds(project,index){
  const scenes=project.scenes||[],raw=scenes[index],next=scenes[index+1];if(!raw||!next)return 0;
  const scene=effectiveScene(project,raw,index),seconds=Number(scene.transitionDuration);
  return scene.transition!=='Corte'&&Number.isFinite(seconds)&&seconds>0&&raw.end-raw.start+1e-6>=seconds&&next.end-next.start+1e-6>=seconds?seconds:0;
}

export function parseSrt(source) {
  const text=String(source||'').replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n').trim();
  if(!text) return [];
  const stamp='(\\d{1,3}):(\\d{2}):(\\d{2})[,.](\\d{1,3})';
  const re=new RegExp(`^${stamp}\\s*-->\\s*${stamp}`);
  const ms=(h,m,s,f)=>((+h*60+ +m)*60+ +s)*1000+Number(String(f).padEnd(3,'0'));
  const cues=[];
  for(const block of text.split(/\n\s*\n/)) {
    const lines=block.split('\n'), index=lines.findIndex(line=>re.test(line.trim()));
    if(index<0) continue;
    const parts=lines[index].trim().match(re);
    const start=ms(...parts.slice(1,5))/1000,end=ms(...parts.slice(5,9))/1000;
    const label=lines.slice(index+1).join(' ').replace(/<[^>]*>/g,'').replace(/\s+/g,' ').trim();
    if(!label||end<start) throw Error(`Bloque SRT inválido cerca de ${lines[index]}`);
    cues.push({id:cues.length+1,start,end,text:label});
  }
  if(!cues.length) throw Error('No se encontraron bloques SRT válidos');
  if(cues.some((cue,i)=>i&&cue.start<cues[i-1].start)) throw Error('El SRT no está en orden cronológico');
  return cues;
}

export function serializeSrt(cues) {
  const time=seconds=>{const n=Math.max(0,Math.round(seconds*1000)),h=Math.floor(n/3600000),m=Math.floor(n/60000)%60,s=Math.floor(n/1000)%60,ms=n%1000;return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')},${String(ms).padStart(3,'0')}`;};
  return cues.map((c,i)=>`${i+1}\n${time(c.start)} --> ${time(c.end)}\n${c.text}`).join('\n\n')+(cues.length?'\n':'');
}

export function mergeSrt(cues,maxSeconds) {
  const max=Number(maxSeconds);if(!Number.isFinite(max)||max<=0) throw Error('Duración máxima inválida');
  const out=[];
  for(const cue of cues){const last=out.at(-1);if(last&&Math.round(cue.end*1000)-Math.round(last.start*1000)<=max*1000){last.end=Math.max(last.end,cue.end);last.text+=' '+cue.text;}else out.push({...cue,id:out.length+1});}
  return out;
}

export function normalizeWordsPayload(payload) {
  const raw=Array.isArray(payload)?payload.find(x=>x&&Array.isArray(x.words)):payload;
  if(!raw||!Array.isArray(raw.words)) throw Error('El JSON necesita un objeto con words, o una lista que contenga ese objeto');
  return raw;
}

export function wordsToSrt(payload,{maxSeconds=5,silenceSeconds=1,script=''}={}) {
  const raw=normalizeWordsPayload(payload);
  if(typeof raw.text==='string'&&raw.words.map(word=>word?.text||'').join('')===raw.text)return referenceWordsToSrt(raw,{maxSeconds,silenceSeconds,script});
  const max=Number(maxSeconds),silence=Number(silenceSeconds);
  if(!(max>0)||!(silence>=0)) throw Error('Duración o silencio inválido');
  const fragments=raw.words.map(w=>String(w?.text||''));
  const joined=fragments.join('');
  const source=String(raw.text||(/\s/.test(joined)?joined:fragments.join(' ')));
  const timed=raw.words.filter(w=>w&&w.type!=='spacing'&&String(w.text||'').trim()&&Number.isFinite(Number(w.start))&&Number.isFinite(Number(w.end)));
  if(!timed.length) throw Error('No hay palabras con tiempos válidos');
  const words=[];let cursor=0;
  for(const w of timed){
    const value=String(w.text).trim(),at=source.toLocaleLowerCase().indexOf(value.toLocaleLowerCase(),cursor);
    const startChar=at<0?cursor:at,endChar=startChar+value.length;
    words.push({text:value,start:Number(w.start),end:Number(w.end),startChar,endChar});cursor=endChar;
  }
  const cuts=new Set(),isDigit=c=>/\d/.test(c||'');
  for(let i=0;i<source.length;i++){
    const c=source[i],dash=c==='—'||c==='–'||(c==='-'&&(/\s/.test(source[i-1]||'')||/\s/.test(source[i+1]||'')));
    const punctuation='.,:;!?…'.includes(c)||dash;
    if(!punctuation||('.,:'.includes(c)&&isDigit(source[i-1])&&isDigit(source[i+1])))continue;
    const before=words.findLastIndex(w=>w.startChar<=i);
    if(before>=0&&before<words.length-1)cuts.add(before);
  }
  // El guion puede conservar comas que el transcriptor omitió. Trasladamos
  // sus cortes cuando las palabras de ambos textos siguen el mismo orden.
  if(script){
    const scriptText=String(script),tokens=[...scriptText.matchAll(/[\p{L}\p{N}]+(?:['’][\p{L}]+)?|[.,:;!?…—–]/gu)];
    const normalized=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
    const spoken=tokens.map(t=>t[0]).filter(t=>normalized(t)),matches=spoken.filter((t,i)=>normalized(t)===normalized(words[i]?.text)).length;
    if(spoken.length&&matches/Math.max(spoken.length,words.length)>=.8){
      let wi=-1;for(const token of tokens){const value=token[0];if(normalized(value))wi++;else if('.,:;!?…—–'.includes(value)&&wi>=0&&wi<words.length-1&&!(('.,:'.includes(value))&&isDigit(scriptText[token.index-1])&&isDigit(scriptText[token.index+1])))cuts.add(wi);}
    }
  }
  const cues=[];let batch=[];
  const flush=()=>{if(!batch.length)return;const first=batch[0],last=batch.at(-1),next=words[words.indexOf(last)+1];let label=source.slice(first.startChar,next?next.startChar:source.length).trim();if(!label)label=batch.map(w=>w.text).join(' ');cues.push({id:cues.length+1,start:first.start,end:last.end,text:label.replace(/\s+/g,' ')});batch=[];};
  for(let i=0;i<words.length;i++){
    const word=words[i],previous=batch.at(-1);
    if(previous&&(word.start-previous.end>silence||word.end-batch[0].start>max+1e-6))flush();
    batch.push(word);
    if(cuts.has(i))flush();
  }
  flush();return cues;
}

export function planAudioGaps(cues,targetSeconds,audioDuration) {
  if(!cues.length) throw Error('Carga un SRT antes de ajustar pausas');
  const targets=Array.isArray(targetSeconds)?targetSeconds:Array(Math.max(0,cues.length-1)).fill(targetSeconds);
  if(targets.length!==cues.length-1||targets.some(value=>!Number.isFinite(Number(value))||Number(value)<0||Number(value)>5)) throw Error('Cada pausa debe estar entre 0 y 5 segundos');
  if(cues.at(-1).end>audioDuration+.05) throw Error('El SRT excede la duración del audio');
  const cuts=[],adjusted=[];let removed=0;
  for(let i=0;i<cues.length;i++){
    const cue=cues[i];adjusted.push({...cue,start:cue.start-removed,end:cue.end-removed});
    if(i===cues.length-1)continue;
    const next=cues[i+1],gap=next.start-cue.end,target=Number(targets[i]);
    if(gap>target+1e-3){const cutStart=cue.end+target/2,cutEnd=next.start-target/2;cuts.push({start:cutStart,end:cutEnd});removed+=cutEnd-cutStart;}
  }
  return {cuts,cues:adjusted,removed,duration:audioDuration-removed};
}

export function promptList(input,field='prompt') {
  const parsed=typeof input==='string'?JSON.parse(input):input;
  const list=Array.isArray(parsed)?parsed:Array.isArray(parsed?.beats)?parsed.beats:Array.isArray(parsed?.items)?parsed.items:null;
  if(!list) throw Error('El JSON debe contener un array de beats o items');
  return list.map((item,i)=>{const value=item?.[field];if(value===undefined||value===null||String(value).trim()==='')return null;return `[${item.id??i+1}] ${typeof value==='string'?value:JSON.stringify(value)}`;}).filter(Boolean).join('\n\n');
}

export function renamedAsset(name) {
  const match=String(name).match(/^(\d+)_([a-zA-Z0-9]+)-.*\.(png|jpe?g|webp|gif|bmp|tiff?|avif|heic|mp4|mov|m4v|avi|mkv|webm|mpe?g|mpg|wmv)$/i);
  return match?`${match[2]}.${match[3].toLowerCase()}`:null;
}

const norm=text=>String(text||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const tokens=text=>norm(text).split(' ').filter(Boolean);
function findTokens(haystack,needle,from=0){
  if(!needle.length)return -1;
  for(let i=from;i<=haystack.length-needle.length;i++)if(needle.every((word,j)=>haystack[i+j]===word))return i;
  return -1;
}
export function resolveChapters(chapters,cues,script=''){
  const list=Array.isArray(chapters)?chapters:Array.isArray(chapters?.chapters)?chapters.chapters:[];
  if(!list.length)throw Error('El JSON de capítulos debe contener un array no vacío');
  if(!cues?.length)throw Error('Carga el SRT de trabajo antes de validar los capítulos');
  const definitions=list.map((source,i)=>{
    const name=String(source?.chapter||source?.name||'').trim(),startText=String(source?.startText||'').trim(),endText=String(source?.endText||'').trim();
    if(!name||!startText||!endText)throw Error(`Capítulo ${i+1}: faltan chapter, startText o endText`);
    const terms=source.searchTerm??source.searchTerms??[];
    return {id:i+1,name,startText,endText,searchTerms:(Array.isArray(terms)?terms:[terms]).map(x=>String(x).trim()).filter(Boolean)};
  });
  const scriptWords=tokens(script),flatCues=cues.flatMap((cue,index)=>tokens(cue.text).map(word=>({word,index}))),cueWords=flatCues.map(x=>x.word);
  let scriptCursor=0,cueCursor=0;
  const located=[];
  for(const [i,chapter] of definitions.entries()){
    const phrase=tokens(chapter.startText),scriptStart=scriptWords.length?findTokens(scriptWords,phrase,scriptCursor):-1;
    if(scriptWords.length&&scriptStart<0)throw Error(`No se encontró en el guion el inicio de «${chapter.name}»: ${chapter.startText}`);
    if(i===0&&scriptWords.length&&scriptStart!==0)throw Error(`El primer capítulo debe comenzar al inicio del guion: «${chapter.name}»`);
    const cueWordStart=findTokens(cueWords,phrase,cueCursor);
    if(cueWordStart<0)throw Error(`No se encontró en el SRT el inicio de «${chapter.name}»: ${chapter.startText}`);
    const cueStart=flatCues[cueWordStart].index;
    if(i===0&&cueStart!==0)throw Error('El SRT contiene bloques anteriores al primer capítulo');
    if(i>0&&cueStart<=located[i-1].cueStart)throw Error(`El inicio de «${chapter.name}» cae dentro del mismo bloque SRT que el capítulo anterior. Divide ese bloque antes de crear el storyboard.`);
    located.push({...chapter,cueStart,scriptStart,warning:[]});
    if(scriptWords.length)scriptCursor=scriptStart+phrase.length;
    cueCursor=cueWordStart+phrase.length;
  }
  return located.map((chapter,i)=>{
    const next=located[i+1],cueEnd=next?next.cueStart-1:cues.length-1,scriptEnd=next?next.scriptStart-1:scriptWords.length-1;
    if(scriptWords.length){const endPhrase=tokens(chapter.endText),endAt=findTokens(scriptWords,endPhrase,chapter.scriptStart);if(endAt<0||endAt+endPhrase.length-1!==scriptEnd)chapter.warning.push('endText no coincide con el cierre del guion; se usó el inicio del siguiente capítulo');}
    const terms=chapter.searchTerms;
    return {...chapter,cueEnd,cueCount:cueEnd-chapter.cueStart+1,scriptEnd,start:chapter.cueStart===0?0:cues[chapter.cueStart].start,end:next?cues[next.cueStart].start:cues.at(-1).end,searchTerms:terms};
  });
}

export function validateSearchTerms(raw,cues){
  const list=Array.isArray(raw)?raw:Array.isArray(raw?.items)?raw.items:[];
  if(!list.length)throw Error('El JSON de search terms debe contener un array no vacío');
  if(!cues?.length)throw Error('Carga el SRT de trabajo antes de validar los search terms');
  if(list.length!==cues.length)throw Error(`El JSON tiene ${list.length} search terms y el SRT de trabajo ${cues.length} bloques. Deben coincidir 1 a 1.`);
  const warnings=[];
  const rows=list.map((row,i)=>{
    const id=Number(row?.id),term=String(row?.searchTerm||'').trim();
    if(!term)throw Error(`Bloque ${i+1}: falta searchTerm`);
    if(!Number.isInteger(id)||id!==Number(cues[i].id))throw Error(`Bloque ${i+1}: ID ${row?.id??'vacío'} no coincide con el SRT (${cues[i].id})`);
    if(row.text&&norm(row.text)!==norm(cues[i].text))warnings.push(i+1);
    return {id,searchTerm:term,text:String(row.text||'')};
  });
  return {rows,warnings};
}

export function makeScenes(cues,chapters=[],mode='srt',options={}) {
  if(!cues.length)return [];
  const groups=[];
  if(mode==='chapter'&&chapters.length){
    for(const chapter of chapters){
      const size=Math.max(1,Math.min(chapter.cueCount,Math.floor(Number(options.grouping?.[chapter.id])||1)));
      for(let first=chapter.cueStart,local=0;first<=chapter.cueEnd;first+=size,local++){
        const last=Math.min(chapter.cueEnd,first+size-1);
        groups.push({first,last,chapter,chapterSceneIndex:local,searchTerm:options.searchTerms?.[first]?.searchTerm||chapter.searchTerms?.[local%(chapter.searchTerms?.length||1)]||''});
      }
    }
  }else for(let i=0;i<cues.length;i++){
    const chapter=chapters.find(ch=>i>=ch.cueStart&&i<=ch.cueEnd);
    groups.push({first:i,last:i,chapter,chapterSceneIndex:chapter?i-chapter.cueStart:i,searchTerm:options.searchTerms?.[i]?.searchTerm||chapter?.searchTerms?.[(i-chapter.cueStart)%(chapter.searchTerms?.length||1)]||''});
  }
  return groups.map(({first,last,chapter,chapterSceneIndex,searchTerm},i)=>({id:i+1,start:i===0?0:cues[first].start,end:cues[last+1]?.start??cues[last].end,text:cues.slice(first,last+1).map(c=>c.text).join(' '),cueStart:first,cueEnd:last,chapterId:chapter?.id||null,chapterSceneIndex,searchTerm,assetId:null,sourceStart:0,fit:'blur',blur:20,motion:'static',effect:'none',transition:'Corte',transitionDuration:.45,sfxId:null,sfxVolume:70,sfxAlign:'center',sfxOffset:0})).filter(s=>s.end>s.start);
}
