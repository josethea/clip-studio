import test from 'node:test';
import assert from 'node:assert/strict';
import {buildTimelineView} from './timeline-model.mjs';

test('timeline model keeps the cut, selected scene and transition centered',()=>{
  const project={settings:{transitionSequence:['remotion:fade'],transitionDuration:1,effectSequence:[],imageFit:'fill'},assets:[{id:'image-1',type:'image',name:'Primera imagen'}],scenes:[{start:0,end:4,assetId:'image-1',text:'Primera'},{start:4,end:8,assetId:null,text:'Segunda'}],cues:[{start:0,end:3,text:'Voz uno'},{start:4,end:8,text:'Voz dos'}],subtitleCues:[],textLayers:[{start:1,end:3,text:'Título'}]};
  const view=buildTimelineView(project,{scale:20,selection:{type:'scene',index:0}});
  assert.equal(view.duration,8);
  assert.equal(view.scale,20);
  assert.equal(view.lanes.timeline[0].label,'1 · Primera imagen');
  assert.equal(view.lanes.timeline[0].selected,true);
  assert.deepEqual(view.lanes.timeline[1],{key:'boundary-0',boundary:0,start:4});
  assert.deepEqual([view.lanes.timeline[2].start,view.lanes.timeline[2].end],[4,4]);
  assert.equal(view.lanes.timeline[2].selectType,'transition');
  assert.equal(view.lanes.timeline[2].icon,true);
  assert.deepEqual(view.lanes['effect-timeline'],[]);
  assert.equal(view.lanes['audio-timeline'][1].kind,'gap');
  assert.equal(view.lanes['text-timeline'][0].handles,true);
  assert.equal(view.ticks[0].left,64);
});

test('timeline model keeps empty lanes and derives scale for an empty storyboard',()=>{
  const view=buildTimelineView({settings:{},assets:[],scenes:[],cues:[],subtitleCues:[],textLayers:[]});
  assert.equal(view.duration,0);
  assert.equal(view.scale,100);
  assert.deepEqual(view.lanes.timeline,[]);
  assert.deepEqual(view.lanes['music-timeline'],[]);
});
