import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {pexelsSearchItems} from './stock-resolution.mjs';
import {rankStoryblocks} from './storyblocks-api.mjs';

test('Pexels shows original photo dimensions and highest resolution video file first',()=>{
  const photos=pexelsSearchItems({photos:[
    {id:1,width:1280,height:720,src:{original:'https://example.com/1.jpg'}},
    {id:2,width:4000,height:3000,src:{original:'https://example.com/2.jpg'}}
  ]},'photos');
  assert.deepEqual(photos.map(x=>[x.id,x.width,x.height]),[[2,4000,3000],[1,1280,720]]);
  const videos=pexelsSearchItems({videos:[
    {id:3,video_files:[{file_type:'video/mp4',width:640,height:360,link:'https://example.com/sd.mp4'},{file_type:'video/mp4',width:3840,height:2160,link:'https://example.com/4k.mp4'}]},
    {id:4,video_files:[{file_type:'video/mp4',width:1920,height:1080,link:'https://example.com/hd.mp4'}]}
  ]},'videos');
  assert.deepEqual(videos.map(x=>[x.id,x.width,x.height]),[[3,3840,2160],[4,1920,1080]]);
  assert.equal(videos[0].url,'https://example.com/4k.mp4');
});

test('Storyblocks orders by resolution before aspect ratio',()=>{
  const items=rankStoryblocks([
    {id:1,orientation:'horizontal',aspectRatio:16/9,download_formats:{MP4:{hd:{width:1920,height:1080}}}},
    {id:2,orientation:'vertical',aspectRatio:9/16,download_formats:{MP4:{uhd:{width:2160,height:3840}}}}
  ]);
  assert.deepEqual(items.map(x=>x.id),[2,1]);
});
