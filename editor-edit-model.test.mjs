import test from 'node:test';
import assert from 'node:assert/strict';
import {transitionOverrideEdit,transitionDurationEdit,inheritTransitionEdit,captionSettingEdit,multiDeleteTextEdit,toggleSequenceEdit,trimBoundaryEdit,trimCueEdit} from './editor-edit-model.mjs';

const project=()=>({
  scenes:[{start:0,end:3},{start:3,end:6},{start:6,end:9}],
  cues:[{start:0,end:3},{start:3,end:6}],
  subtitleCues:[{start:0,end:3},{start:3,end:6}],
  textLayers:[{start:1,end:2},{start:4,end:5},{start:6,end:7}],
  settings:{transitionSequence:['remotion:none'],effectSequence:[],captionStyle:'classic'},
  wordsJson:null
});

test('transition edits preserve valid Remotion options and inherited settings',()=>{
  const p=project(),allowed=['remotion:none','remotion:slide:bottom'];
  assert.equal(transitionOverrideEdit(p,0,'flash',allowed),null);
  assert.equal(transitionDurationEdit(p,0,2.1),null);
  transitionOverrideEdit(p,0,'remotion:slide:bottom',allowed)();
  transitionDurationEdit(p,0,.6)();
  assert.equal(p.scenes[0].transitionOverride,'remotion:slide:bottom');
  assert.equal(p.scenes[0].transitionDurationOverride,.6);
  inheritTransitionEdit(p,0)();
  assert.equal('transitionOverride' in p.scenes[0],false);
  assert.equal('transitionDurationOverride' in p.scenes[0],false);
  toggleSequenceEdit(p,'transitionSequence','remotion:slide:bottom',allowed)();
  assert.deepEqual(p.settings.transitionSequence,['remotion:slide:bottom']);
  toggleSequenceEdit(p,'transitionSequence','remotion:slide:bottom',allowed)();
  assert.deepEqual(p.settings.transitionSequence,['remotion:none']);
});

test('caption and bulk text edits reject unavailable actions and preserve other layers',()=>{
  const p=project();
  assert.equal(captionSettingEdit(p,'captionStyle','dynamic'),null);
  assert.equal(captionSettingEdit(p,'captionStyle','classic'),null);
  p.wordsJson={words:[{word:'hola'}]};
  captionSettingEdit(p,'captionStyle','dynamic')();
  assert.equal(p.settings.captionStyle,'dynamic');
  multiDeleteTextEdit(p,[{type:'text',index:0},{type:'text',index:2},{type:'scene',index:1}])();
  assert.deepEqual(p.textLayers,[{start:4,end:5}]);
});

test('timeline trims keep neighboring scenes joined and cues within video duration',()=>{
  const p=project();
  trimBoundaryEdit(p,0,2.5)();
  assert.equal(p.scenes[0].end,2.5);
  assert.equal(p.scenes[1].start,2.5);
  trimCueEdit(p,'subtitle',0,'end',30)();
  assert.equal(p.subtitleCues[0].end,9);
  trimCueEdit(p,'text',0,'start',1.467)();
  assert.equal(p.textLayers[0].start,Math.round(1.467*30)/30);
  assert.equal(trimBoundaryEdit(p,2,8),null);
});
