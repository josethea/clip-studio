import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareRemotionProject} from './remotion-data.mjs';

test('editor preview uses optional video proxies while exports retain original assets',()=>{
  const project={id:'sample',settings:{ratio:'16:9'},scenes:[],assets:[{id:'clip',type:'video'},{id:'still',type:'image'}]};
  const original=prepareRemotionProject(project,'http://localhost:4173');
  const preview=prepareRemotionProject(project,'http://localhost:4173',{preview:true});
  assert.equal(original.assets[0].url,'http://localhost:4173/api/studio/projects/sample/assets/clip');
  assert.equal(preview.assets[0].url,'http://localhost:4173/api/studio/projects/sample/assets/clip?editorPreview=1');
  assert.equal(preview.assets[1].url,original.assets[1].url);
});
