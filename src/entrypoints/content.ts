// Content script -- injects inpage.js into the page's MAIN world
// and relays messages between page (window.postMessage) and background (chrome.runtime)
export {}; // TS module isolation (builds as IIFE)

const script = document.createElement('script');
script.src = chrome.runtime.getURL('inpage.js');
script.type = 'text/javascript';
(document.head || document.documentElement).appendChild(script);
script.onload = () => script.remove();

// ---------------------------------------------------------------------------
// Message relay
// ---------------------------------------------------------------------------

const CHANNEL = 'vibewallet-provider';

function getFavicon(): string {
  const link = document.querySelector<HTMLLinkElement>('link[rel~="icon"]');
  return link?.href ?? `${window.location.origin}/favicon.ico`;
}

// Page -> Background relay
window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  if (event.data?.channel !== CHANNEL) return;
  if (event.data?.direction !== 'to-background') return;

  // Attach page metadata -- origin from content script's actual location (NEVER from message payload)
  const msg = {
    type: 'dapp:rpc' as const,
    id: event.data.id as number,
    method: event.data.method as string,
    params: event.data.params as unknown[] | undefined,
    origin: window.location.origin,
    favicon: getFavicon(),
    title: document.title,
  };

  chrome.runtime.sendMessage(msg, (response) => {
    if (chrome.runtime.lastError) {
      window.postMessage(
        {
          channel: CHANNEL,
          direction: 'to-page',
          id: event.data.id,
          error: { code: 4900, message: 'Extension disconnected' },
        },
        '*',
      );
      return;
    }
    window.postMessage(
      {
        channel: CHANNEL,
        direction: 'to-page',
        id: event.data.id,
        ...response,
      },
      '*',
    );
  });
});

// Background -> Page relay (events like accountsChanged, chainChanged)
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'dapp:event') {
    window.postMessage(
      {
        channel: CHANNEL,
        direction: 'to-page',
        event: msg.event,
        data: msg.data,
      },
      '*',
    );
  }
  if (msg.type === 'dapp:rpcResponse') {
    // SW-restart fallback: background lost in-memory callback, sends response via tab
    window.postMessage(
      {
        channel: CHANNEL,
        direction: 'to-page',
        id: msg.rpcId,
        result: msg.result,
        error: msg.error,
      },
      '*',
    );
  }
});
