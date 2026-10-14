import test from 'node:test';
import assert from 'node:assert/strict';
import {buildInspectorView} from './editor-inspector-model.mjs';

const project={
  scenes:[{start:0,end:3,assetId:'image',effectOverride:'warm',transitionDurationOverride:0.8,sfxId:'sound',sfxVolume:42},{start:3,end:6,assetId:'image'}],
  assets:[{id:'image',name:'Imagen',type:'image'},{id:'sound',name:'Sonido',type:'audio'}],
  textLayers:[{start:1,end:2,text:'Título',color:'yellow',accent:'#FF537E'}],
  cues:[{start:0,end:3,text:'Base'}],subtitleCues:[{start:0.5,end:2.5,text:'Subtítulo'}],
  wordsJson:{words:[{text:'Subtítulo'}]},narrationId:'sound',settings:{transitionSequence:['remotion:fade'],musicVolume:35,captionFont:'Anton',captionColor:'cyan'}
};
const view=(type,index=0,options={})=>buildInspectorView(project,{selection:{type,index},...options});

test('inspector model derives each selection without changing the project',()=>{
  const original=JSON.stringify(project);
  assert.deepEqual(buildInspectorView(null),{selection:{type:'empty',heading:'PROPIEDADES',time:''},panel:null});
  assert.equal(view('scene').selection.time,'00:00.000–00:03.000');
  const effect=view('effect');
  assert.equal(effect.panel.override,'warm');
  assert.equal(effect.selection.heading,'EFECTO VISUAL');
  const transition=view('transition');
  assert.equal(transition.panel.transition,'remotion:fade');
  assert.equal(transition.panel.duration,0.8);
  assert.equal(transition.selection.time,'00:03.000');
  assert.equal(view('transition',1).panel,null);
  const text=view('text',0,{templates:[{id:'headline',name:'Titular'}]});
  assert.equal(text.panel.layer.color,'#ffe36c');
  assert.equal(text.panel.layer.accent,'#ff537e');
  assert.deepEqual(text.panel.templates,[{id:'headline',name:'Titular'}]);
  assert.equal(text.selection.time,'00:01.000–00:02.000');
  const subtitle=view('subtitle');
  assert.equal(subtitle.panel.cue.text,'Subtítulo');
  assert.equal(subtitle.panel.settings.captionFont,'Anton');
  assert.equal(subtitle.panel.settings.captionColor,'#73efff');
  assert.equal(subtitle.panel.hasWords,true);
  assert.equal(view('sfx').panel.assets[0].id,'sound');
  assert.equal(view('voice').panel.narrationId,'sound');
  assert.equal(view('music').panel.musicVolume,35);
  const multi=view('multi',-1,{multiSelection:[{type:'scene',index:0},{type:'text',index:0}]});
  assert.equal(multi.panel.count,2);
  assert.equal(multi.panel.hasText,true);
  assert.equal(multi.panel.hasSubtitles,false);
  assert.equal(JSON.stringify(project),original);
});
