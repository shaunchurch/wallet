// Content script -- injects inpage.js into the page's MAIN world
const script = document.createElement('script');
script.src = chrome.runtime.getURL('inpage.js');
script.type = 'text/javascript';
(document.head || document.documentElement).appendChild(script);
script.onload = () => script.remove();
