// MV3 service worker -- placeholder for Phase 1
console.log('[megawallet] background service worker started');

chrome.runtime.onInstalled.addListener(() => {
  console.log('[megawallet] extension installed');
});
