import test from 'node:test';
import assert from 'node:assert/strict';
import {pointerTime,shiftTextRange,boundaryTime} from './timeline-geometry.mjs';

test('timeline coordinates follow the scrolled content and text keeps its duration',()=>{
  assert.equal(pointerTime(400,300,20),1.8);
  assert.equal(pointerTime(300,400,20),0);
  assert.deepEqual(shiftTextRange(2,5,1,8),{start:3,end:6});
  assert.deepEqual(shiftTextRange(2,5,20,8),{start:5,end:8});
  assert.deepEqual(shiftTextRange(2,5,-20,8),{start:0,end:3});
});

test('scene boundary stays between adjacent scene limits',()=>{
  assert.equal(boundaryTime(-1,2.05,8.95),2.05);
  assert.equal(boundaryTime(20,2.05,8.95),8.95);
  assert.equal(boundaryTime(5.4,2.05,8.95),5.4);
});
