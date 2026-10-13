import {lookup} from 'node:dns/promises';
import {isIP} from 'node:net';

function privateAddress(address){
  if(isIP(address)===4){
    const [a,b]=address.split('.').map(Number);
    return a===0||a===10||a===127||a>=224||a===169&&b===254||a===172&&b>=16&&b<=31||a===192&&b===168||a===100&&b>=64&&b<=127||a===192&&b===0||a===198&&[18,19].includes(b);
  }
  const value=address.toLowerCase();
  return value==='::1'||value==='::'||value.startsWith('fc')||value.startsWith('fd')||value.startsWith('fe8')||value.startsWith('fe9')||value.startsWith('fea')||value.startsWith('feb')||value.startsWith('::ffff:');
}

export async function validateGoogleImageUrl(raw,resolveHost=lookup){
  const url=new URL(String(raw||''));
  if(url.protocol!=='https:'||url.username||url.password||url.port)throw Error('URL de imagen no permitida');
  const host=url.hostname.toLowerCase();
  if(host==='localhost'||host.endsWith('.localhost')||host.endsWith('.local')||host.endsWith('.internal'))throw Error('Host local no permitido');
  if(isIP(host)&&privateAddress(host))throw Error('Dirección privada no permitida');
  const records=await resolveHost(host,{all:true});
  if(!records.length||records.some(record=>privateAddress(record.address)))throw Error('Dirección privada no permitida');
  return url;
}

export async function downloadGoogleImage(raw,{resolveHost=lookup,request=fetch,maxBytes=15_000_000,signal}={}){
  let url=await validateGoogleImageUrl(raw,resolveHost);
  for(let redirects=0;redirects<=3;redirects++){
    signal?.throwIfAborted();
    const response=await request(url,{redirect:'manual',signal:signal?AbortSignal.any([signal,AbortSignal.timeout(15000)]):AbortSignal.timeout(15000),headers:{'User-Agent':'Mozilla/5.0 ClipStudioImageCollector/1.0'}});
    if([301,302,303,307,308].includes(response.status)){
      if(redirects===3)throw Error('Demasiadas redirecciones');
      url=await validateGoogleImageUrl(new URL(response.headers.get('location')||'',url).href,resolveHost);
      continue;
    }
    if(!response.ok)throw Error(`El sitio de origen respondió ${response.status}`);
    const mime=String(response.headers.get('content-type')||'').split(';')[0].toLowerCase();
    if(!['image/jpeg','image/png','image/webp','image/avif','image/gif'].includes(mime))throw Error('El resultado no es una imagen compatible');
    if(Number(response.headers.get('content-length')||0)>maxBytes)throw Error('Imagen demasiado grande');
    const parts=[];let total=0;
    for await(const chunk of response.body){total+=chunk.length;if(total>maxBytes)throw Error('Imagen demasiado grande');parts.push(chunk);}
    if(total<1000)throw Error('Imagen incompleta');
    return {bytes:Buffer.concat(parts),mime,url:url.href};
  }
  throw Error('No se pudo descargar la imagen');
}
