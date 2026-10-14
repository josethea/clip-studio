import test from 'node:test';
import assert from 'node:assert/strict';
import {getCredential,getCredentials,setCredential,subscribeCredentials} from './credential-session.mjs';

test('credentials stay in the session and notify dependent media controls',()=>{
  let changes=0;const unsubscribe=subscribeCredentials(()=>changes++);
  const before=getCredentials();setCredential('pexels','temporary-key');
  assert.equal(getCredential('pexels'),'temporary-key');
  assert.equal(before.pexels,'');
  assert.equal(changes,1);
  setCredential('pexels','temporary-key');assert.equal(changes,1);
  assert.throws(()=>setCredential('unknown','x'),/Clave desconocida/);
  unsubscribe();setCredential('pexels','');assert.equal(changes,1);
});
