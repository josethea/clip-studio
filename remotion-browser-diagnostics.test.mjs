import test from 'node:test';
import assert from 'node:assert/strict';
import {browserLaunchError} from './remotion-browser-diagnostics.mjs';

test('Linux browser errors retain the missing library and never mention Finder',()=>{
  const message=browserLaunchError(new Error('Failed to launch the browser process!\nlibnss3.so: cannot open shared object file'), 'linux');
  assert.match(message,/libnss3\.so/);
  assert.match(message,/check:browser/);
  assert.doesNotMatch(message,/Finder|Codex/);
});

test('restricted macOS launch explains the local workaround',()=>{
  const message=browserLaunchError(new Error('Failed to launch the browser process!\nmach_port_rendezvous: Permission denied (1100)'), 'darwin');
  assert.match(message,/Finder/);
});
