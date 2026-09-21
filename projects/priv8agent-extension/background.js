// Priv8Agent Background Service Worker
const API_BASE = 'https://app.privatehash.online';
const WS_URL = 'wss://app.privatehash.online/ws';

const PRECONFIGURED_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjE1LCJlbWFpbCI6ImZhdGh5bmFzc2FyMTQ3QGdtYWlsLmNvbSIsInJvbGUiOiJ1c2VyIiwiaWF0IjoxNzg5OTYzMDQyLCJleHAiOjE4MjE0OTkwNDJ9.AHfP2QE72pceSz_qTl1cyD65tJfpssJowsf5xuTrPyY';

// Always ensure token is set (runs on every startup too)
chrome.runtime.onStartup.addListener(async () => {
  const { authToken } = await chrome.storage.local.get('authToken');
  if (!authToken) await chrome.storage.local.set({ authToken: PRECONFIGURED_TOKEN, serverUrl: API_BASE });
});

// Install: set up context menus
chrome.runtime.onInstalled.addListener(async () => {
  // Always pre-configure token (overwrite on reinstall/update)
  await chrome.storage.local.set({ authToken: PRECONFIGURED_TOKEN, serverUrl: API_BASE });
  chrome.contextMenus.create({
    id: 'priv8-ask',
    title: 'Ask Priv8Agent about "%s"',
    contexts: ['selection'],
  });
  chrome.contextMenus.create({
    id: 'priv8-page',
    title: 'Analyze this page with Priv8Agent',
    contexts: ['page'],
  });
  chrome.contextMenus.create({
    id: 'priv8-image',
    title: 'Analyze image with Priv8Agent',
    contexts: ['image'],
  });
  chrome.contextMenus.create({
    id: 'priv8-link',
    title: 'Summarize link with Priv8Agent',
    contexts: ['link'],
  });
});

// Context menu handler
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const { sessionStorage } = await chrome.storage.local.get(['sessionStorage']);

  let prompt = '';
  switch (info.menuItemId) {
    case 'priv8-ask':
      prompt = `"${info.selectionText}" — explain and analyze this for me`;
      break;
    case 'priv8-page':
      prompt = `Analyze this page: ${info.pageUrl}`;
      break;
    case 'priv8-image':
      prompt = `Describe this image: ${info.srcUrl}`;
      break;
    case 'priv8-link':
      prompt = `Summarize this link: ${info.linkUrl}`;
      break;
  }

  if (prompt) {
    // Store pending prompt for side panel to pick up
    await chrome.storage.local.set({ pendingPrompt: prompt, pendingTab: tab?.id });
    // Open side panel
    if (tab?.id) {
      await chrome.sidePanel.open({ tabId: tab.id });
    }
  }
});

// Keyboard shortcut handler
chrome.commands.onCommand.addListener(async (command, tab) => {
  switch (command) {
    case 'open_sidepanel':
      if (tab?.id) await chrome.sidePanel.open({ tabId: tab.id });
      break;
    case 'quick_chat':
      if (tab?.id) {
        await chrome.sidePanel.open({ tabId: tab.id });
        await chrome.storage.local.set({ focusInput: true });
      }
      break;
    case 'capture_page':
      if (tab?.id) {
        await capturePageAndSend(tab);
      }
      break;
  }
});

// Capture page content and send to side panel
async function capturePageAndSend(tab) {
  try {
    // Get page text content
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const title = document.title;
        const url = window.location.href;
        // Get main text content (up to 5000 chars)
        const body = document.body?.innerText?.slice(0, 5000) || '';
        return { title, url, body };
      },
    });

    if (results?.[0]?.result) {
      const { title, url, body } = results[0].result;
      const prompt = `Page content:\n**${title}**\n${url}\n\n${body}\n\n---\nSummarize this page and extract the key points`;
      await chrome.storage.local.set({ pendingPrompt: prompt });
      await chrome.sidePanel.open({ tabId: tab.id });
    }
  } catch (e) {
    console.error('Priv8Agent capture error:', e);
  }
}

// Message handler from content scripts and popup
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'GET_TOKEN') {
    chrome.storage.local.get(['authToken'], (r) => sendResponse({ token: r.authToken }));
    return true;
  }
  if (msg.type === 'SET_TOKEN') {
    chrome.storage.local.set({ authToken: msg.token }, () => sendResponse({ ok: true }));
    return true;
  }
  if (msg.type === 'CAPTURE_PAGE') {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      if (tabs[0]) await capturePageAndSend(tabs[0]);
      sendResponse({ ok: true });
    });
    return true;
  }
  if (msg.type === 'OPEN_SIDEPANEL') {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      if (tabs[0]?.id) await chrome.sidePanel.open({ tabId: tabs[0].id });
      sendResponse({ ok: true });
    });
    return true;
  }
  if (msg.type === 'TAKE_SCREENSHOT') {
    chrome.tabs.captureVisibleTab(null, { format: 'png' }, (dataUrl) => {
      sendResponse({ dataUrl });
    });
    return true;
  }
});

// Handle side panel open on action click
chrome.action.onClicked.addListener(async (tab) => {
  if (tab?.id) {
    await chrome.sidePanel.open({ tabId: tab.id });
  }
});

// Keep service worker alive via periodic alarm
chrome.alarms.create('keepalive', { periodInMinutes: 0.4 });
chrome.alarms.onAlarm.addListener(() => {});
