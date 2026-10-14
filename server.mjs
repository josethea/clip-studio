import http from 'node:http';
import {createReadStream,existsSync,statSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {studioRequest} from './studio-server.mjs';

const ROOT=resolve(import.meta.dirname),PUBLIC=join(ROOT,'public'),PORT=Number(process.env.PORT||4173);
const files=new Map([
  ['/','studio.html'],['/studio.html','studio.html'],['/studio.js','studio.js'],
  ['/studio.css','studio.css'],['/style.css','style.css'],['/remotion-player.js','remotion-player.js'],['/studio-ui.js','studio-ui.js']
]);
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8'};
function error(res,code,message){const body=JSON.stringify({error:message});res.writeHead(code,{'content-type':'application/json; charset=utf-8','content-length':Buffer.byteLength(body)});res.end(body);}
const server=http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,`http://127.0.0.1:${PORT}`);
    if(await studioRequest(req,res,url))return;
    if(req.method!=='GET')return error(res,404,'Ruta no encontrada');
    const name=files.get(url.pathname),font=/^\/fonts\/[a-z0-9-]+\.ttf$/.test(url.pathname),file=font?join(PUBLIC,url.pathname):['/studio-core.mjs','/reference-transcript.mjs','/remotion-data.mjs','/editor-session.mjs','/editor-preview-session.mjs','/export-view.mjs','/credential-session.mjs','/media-service.mjs','/media-search.mjs','/timeline-model.mjs','/editor-inspector-model.mjs','/editor-text-model.mjs','/editor-edit-model.mjs','/storyboard-model.mjs','/project-model.mjs'].includes(url.pathname)?join(ROOT,url.pathname.slice(1)):name?join(PUBLIC,name):null;
    if(!file||!existsSync(file))return error(res,404,'Ruta no encontrada');
    const ext=file.slice(file.lastIndexOf('.'));res.writeHead(200,{'content-type':ext==='.ttf'?'font/ttf':types[ext]||'application/octet-stream','content-length':statSync(file).size,...(font?{'access-control-allow-origin':'*'}:{})});createReadStream(file).pipe(res);
  }catch(e){error(res,500,String(e.message||e));}
});
server.listen(PORT,'127.0.0.1',()=>console.log(`Clip Studio: http://127.0.0.1:${PORT}`));
