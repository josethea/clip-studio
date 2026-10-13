// Lógica de segmentación trasladada de la herramienta Beat Console proporcionada por el usuario.
  function extractTranscriptPayload(data){
    const candidates=Array.isArray(data)?data:[data];
    const payload=candidates.find(item=>item&&typeof item==="object"&&typeof item.text==="string"&&Array.isArray(item.words));
    if(!payload)throw new Error('El JSON debe contener un objeto con los campos "text" y "words".');
    if(!payload.text.trim())throw new Error('El campo "text" está vacío.');
    if(!payload.words.length)throw new Error('El campo "words" está vacío.');
    return payload;
  }

  function isDigit(char){return /\d/.test(char||"")}
  function splitIdeasWithOffsets(text){
    const segments=[];let segmentStart=0;let index=0;
    const closingChars=/["'”’»\)\]\}]/;
    while(index<text.length){
      const char=text[index];let separator=false;const dashSeparator=char==="—"||char==="–"||(char==="-"&&(/\s/.test(text[index-1]||"")||/\s/.test(text[index+1]||"")));
      if(char==="?"||char==="!"||char===";"||char==="…"||dashSeparator)separator=true;
      else if(char==="."||char===","||char===":")separator=!(isDigit(text[index-1])&&isDigit(text[index+1]));
      if(!separator){index++;continue}
      let boundary=index+1;
      if(char==="."){while(text[boundary]===".")boundary++}
      while(boundary<text.length&&closingChars.test(text[boundary]))boundary++;
      let cleanStart=segmentStart;while(cleanStart<boundary&&/\s/.test(text[cleanStart]))cleanStart++;
      let cleanEnd=boundary;while(cleanEnd>cleanStart&&/\s/.test(text[cleanEnd-1]))cleanEnd--;
      if(cleanEnd>cleanStart)segments.push({startChar:cleanStart,endChar:cleanEnd,text:text.slice(cleanStart,cleanEnd).replace(/\s+/g," ").trim()});
      segmentStart=boundary;index=boundary;
    }
    let cleanStart=segmentStart;while(cleanStart<text.length&&/\s/.test(text[cleanStart]))cleanStart++;
    let cleanEnd=text.length;while(cleanEnd>cleanStart&&/\s/.test(text[cleanEnd-1]))cleanEnd--;
    if(cleanEnd>cleanStart)segments.push({startChar:cleanStart,endChar:cleanEnd,text:text.slice(cleanStart,cleanEnd).replace(/\s+/g," ").trim()});
    return segments;
  }

  function comparisonTokensWithOffsets(value){
    const source=String(value);const tokens=[];
    const pattern=/\d+(?:[.,]\d+)*\s*%|[$£€]?\d[\d,]*(?:\.\d+)?(?:st|nd|rd|th|s)?|[A-Za-zÀ-ÖØ-öø-ÿ]+(?:['’][A-Za-zÀ-ÖØ-öø-ÿ]+)*/g;
    let match;
    while((match=pattern.exec(source))){
      const raw=match[0];let normalized=[];
      if(raw.endsWith("%")){
        normalized=percentageToWords(raw,source).split(/\s+/);
      }else if(/^[$£€]?\d/.test(raw)){
        const currency=raw[0]==="$"?"dollars":raw[0]==="£"?"pounds":raw[0]==="€"?"euros":"";
        const numberRaw=currency?raw.slice(1):raw;
        normalized=numericLiteralToWords(numberRaw).split(/\s+/);
        if(currency)normalized.push(currency);
      }else{
        normalized=[raw.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/[’‘]/g,"'")];
      }
      normalized.filter(Boolean).forEach(token=>tokens.push({value:token,startChar:match.index,endChar:match.index+raw.length}));
    }
    return tokens;
  }

  function alignComparisonTokens(left,right){
    const columns=right.length+1;const directions=new Uint8Array((left.length+1)*columns);
    let previous=new Uint16Array(columns);let current=new Uint16Array(columns);
    for(let j=1;j<columns;j++){previous[j]=j;directions[j]=3}
    for(let i=1;i<=left.length;i++){
      current[0]=i;directions[i*columns]=2;
      for(let j=1;j<=right.length;j++){
        const diagonal=previous[j-1]+(left[i-1].value===right[j-1].value?0:1);
        const up=previous[j]+1;const across=current[j-1]+1;const offset=i*columns+j;
        if(diagonal<=up&&diagonal<=across){current[j]=diagonal;directions[offset]=1}
        else if(up<=across){current[j]=up;directions[offset]=2}
        else{current[j]=across;directions[offset]=3}
      }
      const swap=previous;previous=current;current=swap;
    }
    const mapping=new Array(left.length).fill(null);let i=left.length;let j=right.length;
    while(i>0||j>0){
      const direction=directions[i*columns+j];
      if(i>0&&j>0&&direction===1){mapping[i-1]=j-1;i--;j--}
      else if(i>0&&(direction===2||j===0))i--;
      else if(j>0)j--;
      else break;
    }
    return mapping;
  }

  function projectScriptBoundaries(script,jsonText){
    const scriptTokens=comparisonTokensWithOffsets(script);const jsonTokens=comparisonTokensWithOffsets(jsonText);
    if(!scriptTokens.length||!jsonTokens.length)return [];
    const mapping=alignComparisonTokens(scriptTokens,jsonTokens);const scriptIdeas=splitIdeasWithOffsets(script);const boundaries=[];
    scriptIdeas.slice(0,-1).forEach(idea=>{
      let scriptTokenIndex=-1;
      for(let i=0;i<scriptTokens.length&&scriptTokens[i].startChar<idea.endChar;i++)scriptTokenIndex=i;
      if(scriptTokenIndex<0)return;
      let jsonTokenIndex=mapping[scriptTokenIndex];
      if(jsonTokenIndex===null){
        for(let distance=1;distance<scriptTokens.length;distance++){
          const before=scriptTokenIndex-distance;const after=scriptTokenIndex+distance;
          if(before>=0&&mapping[before]!==null){jsonTokenIndex=mapping[before];break}
          if(after<mapping.length&&mapping[after]!==null){jsonTokenIndex=mapping[after];break}
        }
      }
      if(jsonTokenIndex===null||jsonTokenIndex===undefined)return;
      let boundary=jsonTokens[jsonTokenIndex].endChar;
      while(boundary<jsonText.length&&!/[A-Za-z0-9À-ÖØ-öø-ÿ]/.test(jsonText[boundary]))boundary++;
      if(boundary>0&&boundary<jsonText.length)boundaries.push(boundary);
    });
    return boundaries;
  }

  function ideasFromBoundaries(text,boundaries){
    const ideas=[];let start=0;
    [...new Set(boundaries.concat(text.length))].sort((a,b)=>a-b).forEach(boundary=>{
      let cleanStart=start;while(cleanStart<boundary&&/\s/.test(text[cleanStart]))cleanStart++;
      let cleanEnd=boundary;while(cleanEnd>cleanStart&&/\s/.test(text[cleanEnd-1]))cleanEnd--;
      const segmentText=text.slice(cleanStart,cleanEnd).replace(/\s+/g," ").trim();
      if(segmentText&&comparisonTokensWithOffsets(segmentText).length)ideas.push({startChar:cleanStart,endChar:cleanEnd,text:segmentText});
      start=boundary;
    });
    return ideas;
  }

  function percentageToWords(raw,context){
    const spanish=/\b(el|la|los|las|un|una|que|por|para|con|del)\b/i.test(context);
    const number=Number(raw.replace(/\s*%$/,"").replace(",","."));
    if(!spanish)return numericLiteralToWords(String(number))+" percent";
    const units=["cero","uno","dos","tres","cuatro","cinco","seis","siete","ocho","nueve","diez","once","doce","trece","catorce","quince","dieciseis","diecisiete","dieciocho","diecinueve","veinte","veintiuno","veintidos","veintitres","veinticuatro","veinticinco","veintiseis","veintisiete","veintiocho","veintinueve"];
    const tens=["","","","treinta","cuarenta","cincuenta","sesenta","setenta","ochenta","noventa"];
    const whole=n=>n<30?units[n]:n<100?tens[Math.floor(n/10)]+(n%10?" y "+units[n%10]:""):n===100?"cien":String(n);
    const parts=String(number).split(".");
    return whole(Number(parts[0]))+(parts[1]?" coma "+parts[1].split("").map(d=>units[Number(d)]).join(" "):"")+" por ciento";
  }

  function isInsidePercentage(text,boundary){
    for(const match of text.matchAll(/\d+(?:[.,]\d+)*\s*%/g)){
      if(boundary>match.index&&boundary<match.index+match[0].length)return true;
    }
    return false;
  }

  function splitTimedIdea(idea,timed,text,maxMs){
    if(!Number.isFinite(maxMs)||maxMs<=0||timed[timed.length-1].end*1000-timed[0].start*1000<=maxMs){
      return [{start:timed[0].start*1000,end:timed[timed.length-1].end*1000,text:idea.text}];
    }
    const cues=[];const boundaryWords=new Set(["and","but","because","which","that","who","with","from","to","for","while","when","where","as","or","so"]);let startIndex=0;
    while(startIndex<timed.length){
      const startTime=timed[startIndex].start*1000;const finalEnd=timed[timed.length-1].end*1000;
      if(finalEnd-startTime<=maxMs){
        const textStart=startIndex===0?idea.startChar:timed[startIndex].startChar;
        const cueText=text.slice(textStart,idea.endChar).replace(/^[\s,;:—–-]+|\s+$/g,"").replace(/\s+/g," ");
        cues.push({start:startTime,end:finalEnd,text:cueText});break;
      }
      let maxIndex=startIndex;
      while(maxIndex+1<timed.length&&timed[maxIndex+1].end*1000-startTime<=maxMs)maxIndex++;
      if(timed[maxIndex+1]&&isInsidePercentage(text,timed[maxIndex+1].startChar)){
        let safeIndex=maxIndex;
        while(safeIndex>=startIndex&&timed[safeIndex+1]&&isInsidePercentage(text,timed[safeIndex+1].startChar))safeIndex--;
        if(safeIndex>=startIndex)maxIndex=safeIndex;
        else while(maxIndex+1<timed.length&&isInsidePercentage(text,timed[maxIndex+1].startChar))maxIndex++;
      }
      const remainingDuration=finalEnd-startTime;const target=startTime+(remainingDuration<=maxMs*2?remainingDuration/2:maxMs*.82);const minChunk=Math.min(1800,maxMs*.25);let bestIndex=maxIndex;let bestScore=Infinity;
      for(let i=startIndex;i<=maxIndex&&i<timed.length-1;i++){
        if(isInsidePercentage(text,timed[i+1].startChar))continue;
        const endTime=timed[i].end*1000;const nextStart=timed[i+1].start*1000;
        if(endTime-startTime<minChunk||finalEnd-nextStart<minChunk)continue;
        const nextWord=timed[i+1].text.toLowerCase().replace(/[^a-z']/g,"");const gap=Math.max(0,nextStart-endTime);
        let score=Math.abs(endTime-target)-Math.min(gap,500)*1.5;
        if(boundaryWords.has(nextWord))score-=maxMs*.16;
        if(score<bestScore){bestScore=score;bestIndex=i}
      }
      const nextToken=timed[bestIndex+1];const textStart=startIndex===0?idea.startChar:timed[startIndex].startChar;const textEnd=nextToken?nextToken.startChar:idea.endChar;
      const cueText=text.slice(textStart,textEnd).replace(/^[\s,;:—–-]+|\s+$/g,"").replace(/\s+/g," ");
      cues.push({start:startTime,end:timed[bestIndex].end*1000,text:cueText});startIndex=bestIndex+1;
    }
    return cues.filter(cue=>cue.text);
  }

  function mapIdeasToTimestamps(text,words,script,useScriptCuts,maxMs,silenceThreshold=1){
    let cursor=0;
    const tokens=words.map((word,index)=>{
      const tokenText=word&&typeof word.text==="string"?word.text:"";
      const token={index,text:tokenText,startChar:cursor,endChar:cursor+tokenText.length,start:word&&word.start,end:word&&word.end,type:word&&word.type};
      cursor+=tokenText.length;return token;
    });
    const joined=tokens.map(token=>token.text).join("");
    if(joined!==text)throw new Error('El contenido de "words" no reconstruye exactamente el campo "text"; no es posible asignar tiempos con seguridad.');
    const jsonBoundaries=splitIdeasWithOffsets(text).slice(0,-1).map(idea=>idea.endChar);
    const scriptBoundaries=useScriptCuts?projectScriptBoundaries(script,text):[];
    // Algunas transcripciones asignan al spacing un intervalo de duración cero
    // aunque exista una pausa real entre el end y el siguiente start.
    const silenceBoundaries=[];let previousWord=null;let hasLongSpacing=false;
    tokens.forEach(token=>{
      if(token.type==="spacing"||!token.text.trim()){
        if(Number.isFinite(token.start)&&Number.isFinite(token.end)&&token.end-token.start>silenceThreshold+1e-9)hasLongSpacing=true;
        return;
      }
      if(!Number.isFinite(token.start)||!Number.isFinite(token.end))return;
      if(previousWord&&(hasLongSpacing||token.start-previousWord.end>silenceThreshold+1e-9))silenceBoundaries.push(token.startChar);
      previousWord=token;hasLongSpacing=false;
    });
    const boundaries=jsonBoundaries.concat(scriptBoundaries,silenceBoundaries).filter(boundary=>!isInsidePercentage(text,boundary));
    const ideas=ideasFromBoundaries(text,boundaries);
    return ideas.flatMap((idea,index)=>{
      const timed=tokens.filter(token=>token.endChar>idea.startChar&&token.startChar<idea.endChar&&token.text.trim()&&typeof token.start==="number"&&Number.isFinite(token.start)&&typeof token.end==="number"&&Number.isFinite(token.end));
      if(!timed.length)throw new Error("No se encontraron timestamps para la idea "+(index+1)+': "'+idea.text.slice(0,70)+'".');
      return splitTimedIdea(idea,timed,text,maxMs);
    });
  }

  const smallNumbers=["zero","one","two","three","four","five","six","seven","eight","nine","ten","eleven","twelve","thirteen","fourteen","fifteen","sixteen","seventeen","eighteen","nineteen"];
  const tensNumbers=["","","twenty","thirty","forty","fifty","sixty","seventy","eighty","ninety"];
  function integerToWords(number){
    const n=Math.floor(Math.abs(number));
    if(n<20)return smallNumbers[n];
    if(n<100)return tensNumbers[Math.floor(n/10)]+(n%10?" "+smallNumbers[n%10]:"");
    if(n<1000)return smallNumbers[Math.floor(n/100)]+" hundred"+(n%100?" "+integerToWords(n%100):"");
    if(n<1000000)return integerToWords(Math.floor(n/1000))+" thousand"+(n%1000?" "+integerToWords(n%1000):"");
    if(n<1000000000)return integerToWords(Math.floor(n/1000000))+" million"+(n%1000000?" "+integerToWords(n%1000000):"");
    return integerToWords(Math.floor(n/1000000000))+" billion"+(n%1000000000?" "+integerToWords(n%1000000000):"");
  }
  function makeOrdinal(words){
    const irregular={one:"first",two:"second",three:"third",five:"fifth",eight:"eighth",nine:"ninth",twelve:"twelfth"};
    const parts=words.split(" ");const last=parts.pop();
    parts.push(irregular[last]||(last.endsWith("y")?last.slice(0,-1)+"ieth":last+"th"));return parts.join(" ");
  }
  function numericLiteralToWords(raw){
    const lower=raw.toLowerCase();const suffix=(lower.match(/(st|nd|rd|th|s)$/)||[])[1]||"";
    const core=lower.slice(0,lower.length-suffix.length).replace(/,/g,"");
    const parts=core.split(".");let words=integerToWords(Number(parts[0]||0));
    if(parts.length>1)words+=" point "+parts[1].split("").map(digit=>smallNumbers[Number(digit)]).join(" ");
    if(["st","nd","rd","th"].includes(suffix))words=makeOrdinal(words);
    else if(suffix==="s")words+=" s";
    return words;
  }
  function normalizedComparisonTokens(value){
    let text=String(value).toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"");
    const context=text;
    text=text.replace(/\d+(?:[.,]\d+)*\s*%/g,raw=>percentageToWords(raw,context));
    text=text.replace(/\$(\d[\d,]*(?:\.\d+)?)/g,(_,number)=>numericLiteralToWords(number)+" dollars");
    text=text.replace(/£(\d[\d,]*(?:\.\d+)?)/g,(_,number)=>numericLiteralToWords(number)+" pounds");
    text=text.replace(/€(\d[\d,]*(?:\.\d+)?)/g,(_,number)=>numericLiteralToWords(number)+" euros");
    text=text.replace(/\b\d[\d,]*(?:\.\d+)?(?:st|nd|rd|th|s)?\b/g,match=>numericLiteralToWords(match));
    return text.replace(/[’‘]/g,"'").replace(/[^a-z0-9']+/g," ").trim().split(/\s+/).filter(Boolean);
  }
  function tokenSimilarity(leftText,rightText){
    const left=normalizedComparisonTokens(leftText);const right=normalizedComparisonTokens(rightText);
    if(!left.length&&!right.length)return 1;
    let previous=new Uint16Array(right.length+1);let current=new Uint16Array(right.length+1);
    for(let j=0;j<=right.length;j++)previous[j]=j;
    for(let i=1;i<=left.length;i++){
      current[0]=i;
      for(let j=1;j<=right.length;j++)current[j]=left[i-1]===right[j-1]?previous[j-1]:Math.min(previous[j-1],previous[j],current[j-1])+1;
      const swap=previous;previous=current;current=swap;
    }
    return 1-previous[right.length]/Math.max(left.length,right.length);
  }

export function referenceWordsToSrt(payload,{maxSeconds=5,silenceSeconds=1,script='' }={}) {
  const raw=extractTranscriptPayload(payload);
  const similarity=script?tokenSimilarity(script,raw.text):0;
  const max=Number(maxSeconds),silence=Number(silenceSeconds);
  if(!Number.isFinite(max)||max<1)throw Error('El máximo por bloque debe ser de al menos 1 segundo');
  if(!Number.isFinite(silence)||silence<0)throw Error('El umbral de silencio debe ser mayor o igual a cero');
  return mapIdeasToTimestamps(raw.text,raw.words,script,similarity>=.8,max*1000,silence).map((cue,id)=>({id:id+1,start:cue.start/1000,end:cue.end/1000,text:cue.text}));
}
