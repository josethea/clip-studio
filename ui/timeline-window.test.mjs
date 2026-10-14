import test from 'node:test';
import assert from 'node:assert/strict';
import {visibleTimelineItems,visibleTimelineTicks} from './timeline-window.mjs';

test('windowing keeps overlapping blocks and nearby resize boundaries',()=>{
  const items=[
    {key:'old',start:0,end:3},
    {key:'long',start:0,end:100},
    {key:'boundary',start:20},
    {key:'near',start:22,end:24},
    {key:'far',start:80,end:84}
  ];
  assert.deepEqual(visibleTimelineItems(items,20,450,100,0).map(item=>item.key),['long','boundary','near']);
  assert.deepEqual(visibleTimelineTicks([{left:64},{left:464},{left:864}],450,100,0).map(tick=>tick.left),[464]);
});

test('a 666 scene timeline mounts only blocks around the viewport',()=>{
  const scenes=Array.from({length:666},(_,index)=>({key:`scene-${index}`,start:index*4,end:(index+1)*4}));
  const first=visibleTimelineItems(scenes,18,0,900);
  const middle=visibleTimelineItems(scenes,18,18000,900);
  assert.ok(first.length<25);
  assert.ok(middle.length<30);
  assert.ok(middle.some(item=>item.start*18+64<=18000&&item.end*18+64>=18000));
});
