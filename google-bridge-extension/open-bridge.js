document.getElementById('openClipBridge')?.addEventListener('click', () => chrome.tabs.create({url: chrome.runtime.getURL('bridge.html')}));
