const allowed=new Set(['gemini','pexels','storyblocksPublic','storyblocksSecret']);
let credentials=Object.freeze({gemini:'',pexels:'',storyblocksPublic:'',storyblocksSecret:''});
const listeners=new Set();

export const getCredentials=()=>credentials;
export const getCredential=key=>credentials[key]||'';
export function setCredential(key,value){
  if(!allowed.has(key))throw Error('Clave desconocida');
  const next=String(value??'');if(credentials[key]===next)return;
  credentials=Object.freeze({...credentials,[key]:next});
  for(const listener of listeners)listener();
}
export function subscribeCredentials(listener){listeners.add(listener);return ()=>listeners.delete(listener);}
