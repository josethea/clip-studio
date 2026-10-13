const $=id=>document.getElementById(id);
let connected=false,searchTabId=null,searches=0,server='';
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function log(message){$('log').textContent=`[${new Date().toLocaleTimeString()}] ${message}\n`+$('log').textContent.slice(0,6000);}
function status(message){$('state').textContent=message;}
function baseUrl(value){
  const url=new URL(value.trim());
  if(url.protocol!=='http:'||!['127.0.0.1','localhost'].includes(url.hostname)||!url.port)throw Error('Usa la dirección local de Clip Studio, por ejemplo http://127.0.0.1:4173');
  return url.origin;
}
async function api(path,body){
  const response=await fetch(`${server}/api/studio/google-bridge/${path}`,body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const data=await response.json();if(!response.ok)throw Error(data.error||`Clip Studio respondió ${response.status}`);return data;
}
async function waitComplete(tabId){
  const current=await chrome.tabs.get(tabId);if(current.status==='complete')return;
  await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>{chrome.tabs.onUpdated.removeListener(listener);reject(Error('Google tardó demasiado en cargar'));},30000);const listener=(id,info)=>{if(id===tabId&&info.status==='complete'){clearTimeout(timeout);chrome.tabs.onUpdated.removeListener(listener);resolve();}};chrome.tabs.onUpdated.addListener(listener);});
}
async function scan(tabId){
  for(let attempt=0;attempt<4;attempt++){try{return await chrome.tabs.sendMessage(tabId,{type:'COLLECT_GOOGLE_IMAGES',candidateGoal:10});}catch(error){if(attempt===3)throw error;await sleep(500);}}
}
async function search(job){
  searches++;
  if(searches>1)await sleep(2000+Math.floor(Math.random()*1001));
  if(searches>1&&(searches-1)%50===0){status('Pausa preventiva de 30 segundos');await sleep(30000);}
  const url=`https://www.google.com/search?tbm=isch&udm=2&safe=active&q=${encodeURIComponent(job.query)}`;
  if(searchTabId){try{await chrome.tabs.get(searchTabId);}catch{searchTabId=null;}}
  if(searchTabId)await chrome.tabs.update(searchTabId,{url});
  else searchTabId=(await chrome.tabs.create({url,active:false})).id;
  await waitComplete(searchTabId);
  let result=await scan(searchTabId);
  while(connected&&result?.captcha){
    status(`Google solicita verificación para «${job.query}». Resuélvela en la pestaña de Google.`);
    await chrome.tabs.update(searchTabId,{active:true});
    await sleep(1800);
    const check=await chrome.tabs.sendMessage(searchTabId,{type:'CHECK_GOOGLE_CAPTCHA'}).catch(()=>({captcha:true}));
    if(!check?.captcha&&check?.ready)result=await scan(searchTabId);
  }
  if(!connected)throw Error('Puente desconectado');
  if(result?.error)throw Error(result.error);
  return (result?.candidates||[]).map(x=>x.url).filter(Boolean).slice(0,10);
}
async function loop(){
  while(connected){
    try{
      await api('heartbeat',{});
      const {job}=await api('next');
      if(job){
        status(`Buscando «${job.query}»…`);log(`Búsqueda: ${job.query}`);
        try{
          const candidates=await search(job);
          await api('submit',{id:job.id,candidates});
          status(`${candidates.length} candidatos enviados a Clip Studio para revisar texto, logos y marcas de agua.`);
          log(`Candidatos enviados: ${candidates.length}`);
        }catch(error){await api('submit',{id:job.id,error:String(error.message||error)}).catch(()=>{});status(`Error: ${error.message}`);log(`Error: ${error.message}`);}
      }else status('Conectado · esperando búsquedas desde Clip Studio');
      await sleep(1500);
    }catch(error){status(`Sin conexión: ${error.message}`);log(error.message);connected=false;break;}
  }
  $('connect').disabled=false;$('disconnect').disabled=true;
}
$('connect').onclick=async()=>{
  try{server=baseUrl($('server').value);await api('heartbeat',{});connected=true;$('connect').disabled=true;$('disconnect').disabled=false;await chrome.storage.local.set({clipStudioServer:server});log(`Conectado a ${server}`);loop();}
  catch(error){status(error.message);}
};
$('disconnect').onclick=()=>{connected=false;status('Desconectado');};
setInterval(()=>{if(connected)api('heartbeat',{}).catch(()=>{});},5000);
chrome.storage.local.get('clipStudioServer').then(value=>{if(value.clipStudioServer)$('server').value=value.clipStudioServer;});
