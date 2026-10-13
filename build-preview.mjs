import {build} from 'esbuild';
import {join,resolve} from 'node:path';
const root=resolve(import.meta.dirname);
await build({entryPoints:[join(root,'remotion/player.jsx')],bundle:true,format:'esm',platform:'browser',target:['chrome110'],jsx:'automatic',outfile:join(root,'public/remotion-player.js'),minify:true,logLevel:'warning'});
await build({entryPoints:[join(root,'ui/studio-ui.jsx')],bundle:true,format:'esm',platform:'browser',target:['chrome110'],jsx:'automatic',outfile:join(root,'public/studio-ui.js'),minify:true,logLevel:'warning'});
