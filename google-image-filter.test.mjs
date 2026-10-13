import test from 'node:test';
import assert from 'node:assert/strict';
import {validateGoogleImageUrl,downloadGoogleImage} from './google-image-filter.mjs';
import {assessRecognizedText} from './local-image-screening.mjs';

const publicDns=async()=>[{address:'93.184.215.14'}];

test('rejects local, private and non HTTPS image URLs',async()=>{
  for(const url of ['http://example.com/a.jpg','https://localhost/a.jpg','https://127.0.0.1/a.jpg','https://example.com:8443/a.jpg']){
    await assert.rejects(validateGoogleImageUrl(url,publicDns));
  }
  await assert.rejects(validateGoogleImageUrl('https://example.com/a.jpg',async()=>[{address:'192.168.1.2'}]));
  assert.equal((await validateGoogleImageUrl('https://example.com/a.jpg',publicDns)).hostname,'example.com');
});

test('validates redirects and image MIME before accepting download',async()=>{
  const bytes=Buffer.alloc(1200,7);
  const request=async(url)=>url.hostname==='example.com'?new Response(null,{status:302,headers:{location:'https://images.example.org/file.jpg'}}):new Response(bytes,{headers:{'content-type':'image/jpeg'}});
  const result=await downloadGoogleImage('https://example.com/start',{resolveHost:publicDns,request});
  assert.equal(result.mime,'image/jpeg');assert.equal(result.bytes.length,1200);
  await assert.rejects(downloadGoogleImage('https://example.com/start',{resolveHost:publicDns,request:async()=>new Response(null,{status:302,headers:{location:'http://127.0.0.1/private'}})}));
});

test('local OCR allows a short title and rejects text over ten percent',()=>{
  const blocks=words=>[{paragraphs:[{lines:[{words}]}]}];
  const word=(text,x0,y0,x1,y1,confidence=90)=>({text,bbox:{x0,y0,x1,y1},confidence});
  assert.equal(assessRecognizedText(blocks([word('Title',100,100,300,180)]),1000,1000).approved,true);
  const dense=assessRecognizedText(blocks([word('Infographic',100,100,700,400)]),1000,1000);
  assert.equal(dense.approved,false);assert.ok(dense.textPercent>10);
  assert.equal(assessRecognizedText(blocks([word('Headline',0,0,1000,100)]),1000,1000).approved,true);
  assert.equal(assessRecognizedText(blocks([word('Shutterstock',50,50,180,80)]),1000,1000).watermarkDetected,true);
  assert.equal(assessRecognizedText(blocks([word('YouTube',50,50,180,80)]),1000,1000).logoTextDetected,true);
  assert.equal(assessRecognizedText(blocks([word('Pry',0,0,700,400,42)]),1000,1000).approved,true);
});
