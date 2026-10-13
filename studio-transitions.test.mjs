import test from 'node:test';
import assert from 'node:assert/strict';
import {legacyTransitions,transitions,normalizeTransition,migrateProjectTransitions,effectiveScene,transitionSeconds} from './studio-core.mjs';

test('only Remotion transitions appear in the editor picker',()=>{
  assert.ok(transitions.every(name=>name.startsWith('remotion:')));
  assert.ok(legacyTransitions.every(name=>!transitions.includes(name)));
  assert.equal(transitions[0],'remotion:none');
});

test('old transition names migrate to safe Remotion choices',()=>{
  const project={settings:{transitionSequence:['Flash','Corte','Blur','remotion:slide:bottom']},scenes:[
    {start:0,end:2,transition:'Flash',transitionOverride:'Blur'},
    {start:2,end:4,transition:'Corte'}
  ]};
  assert.equal(migrateProjectTransitions(project),true);
  assert.deepEqual(project.settings.transitionSequence,['remotion:slide:bottom','remotion:none','remotion:slide:bottom','remotion:slide:bottom']);
  assert.equal(project.scenes[0].transitionOverride,'remotion:slide:bottom');
  assert.equal(project.scenes[1].transition,'remotion:none');
  assert.equal(migrateProjectTransitions(project),false);
  assert.equal(normalizeTransition('remotion:slide:bottom'),'remotion:slide:bottom');
});

test('legacy settings cannot activate an old effect while exporting',()=>{
  const project={settings:{transitionSequence:['Flash'],transitionDuration:1},scenes:[
    {start:0,end:2},{start:2,end:4}
  ]};
  assert.equal(effectiveScene(project,project.scenes[0],0).transition,'remotion:slide:bottom');
  assert.equal(transitionSeconds(project,0),1);
  project.settings.transitionSequence=['Corte'];
  assert.equal(transitionSeconds(project,0),0);
});
