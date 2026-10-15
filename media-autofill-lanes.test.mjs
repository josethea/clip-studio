import test from 'node:test';
import assert from 'node:assert/strict';
import {runMediaAutofillLanes} from './media-autofill-lanes.mjs';

test('autofill runs at most two videos and one image concurrently',async()=>{
  const items=Array.from({length:5},(_,i)=>({id:`v${i}`,choice:{type:'videos'}})).concat(
    Array.from({length:3},(_,i)=>({id:`p${i}`,choice:{type:'photos'}})));
  const active={videos:0,photos:0},peak={videos:0,photos:0},settled=[];
  await runMediaAutofillLanes(items,async item=>{
    const type=item.choice.type;
    active[type]++;peak[type]=Math.max(peak[type],active[type]);
    await new Promise(resolve=>setTimeout(resolve,8));
    active[type]--;
  },{onSettled:item=>settled.push(item.id)});
  assert.deepEqual(peak,{videos:2,photos:1});
  assert.deepEqual(active,{videos:0,photos:0});
  assert.deepEqual(settled.sort(),items.map(item=>item.id).sort());
});

test('autofill waits for active jobs and stops scheduling after an error',async()=>{
  const items=Array.from({length:5},(_,i)=>({id:i,choice:{type:'videos'}}));
  const started=[],finished=[];
  await assert.rejects(runMediaAutofillLanes(items,async item=>{
    started.push(item.id);
    if(item.id===0)throw Error('search failed');
    await new Promise(resolve=>setTimeout(resolve,8));finished.push(item.id);
  }),/search failed/);
  assert.deepEqual(started,[0,1]);
  assert.deepEqual(finished,[1]);
});
