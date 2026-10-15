import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync,statSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {optimizePreview,previewIsReady,schedulePreview} from './preview-optimizer.mjs';

test('editor proxy is smaller, seekable and generated only once',async t=>{
  if(spawnSync('ffmpeg',['-version']).status!==0){t.skip('FFmpeg no disponible');return;}
  const dir=mkdtempSync(join(tmpdir(),'clip-preview-'));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const input=join(dir,'source.mp4'),output=join(dir,'preview.mp4');
  const sample=spawnSync('ffmpeg',['-y','-hide_banner','-loglevel','error','-f','lavfi','-i','testsrc2=size=1920x1080:rate=30','-t','1.2','-c:v','libx264','-preset','ultrafast','-pix_fmt','yuv420p',input]);
  assert.equal(sample.status,0,String(sample.stderr));
  assert.equal(previewIsReady(input,output),false);
  assert.equal(await optimizePreview(input,output),true);
  assert.equal(previewIsReady(input,output),true);
  const probe=spawnSync('ffprobe',['-v','error','-select_streams','v:0','-show_entries','stream=width,height,r_frame_rate','-of','json',output]);
  assert.equal(probe.status,0,String(probe.stderr));
  assert.deepEqual(JSON.parse(probe.stdout).streams[0],{width:1280,height:720,r_frame_rate:'30/1'});
  const keys=spawnSync('ffprobe',['-v','error','-select_streams','v:0','-skip_frame','nokey','-show_entries','frame=best_effort_timestamp_time','-of','csv=p=0',output]);
  assert.equal(keys.status,0,String(keys.stderr));
  assert.ok(String(keys.stdout).trim().split('\n').length>=2);
  const size=statSync(output).size;
  assert.ok(size<statSync(input).size);
  assert.equal(await optimizePreview(input,output),false);
  assert.equal(statSync(output).size,size);
  const automatic=join(dir,'automatic.mp4');
  schedulePreview(input,automatic);
  const deadline=Date.now()+3000;
  while(!previewIsReady(input,automatic)&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,25));
  assert.equal(previewIsReady(input,automatic),true);
  assert.notEqual(readFileSync(output).length,0);
});
