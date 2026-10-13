import {execFileSync} from 'node:child_process';
import {ensureBrowser,openBrowser} from '@remotion/renderer';

const executable=process.env.CLIP_STUDIO_CHROME||undefined;
console.log(`Sistema: ${process.platform} ${process.arch}`);
console.log(`Chrome configurado: ${executable||'detección automática de Remotion'}`);
try{
  const status=await ensureBrowser({browserExecutable:executable,logLevel:'info'});
  console.log('Binario de Chrome:',status);
  if(process.platform==='linux'&&status.path){
    const dependencies=execFileSync('ldd',[status.path],{encoding:'utf8'});
    const missing=dependencies.split('\n').filter(line=>line.includes('not found'));
    console.log(missing.length?`Bibliotecas faltantes:\n${missing.join('\n')}`:'Bibliotecas compartidas: todas encontradas');
  }
  const browser=await openBrowser('chrome',{browserExecutable:executable,logLevel:'verbose'});
  await browser.close();
  console.log('Chrome inició y cerró correctamente.');
}catch(error){
  console.error('Chrome no pudo iniciarse. Error completo:\n',error);
  process.exitCode=1;
}
