// Priv8Agent Background Service Worker
const API_BASE = 'https://app.privatehash.online';
const WS_URL = 'wss://app.privatehash.online/ws';

// ── Auth: device-flow login ────────────────────────────────────────────────
let _authTabId = null;
let _authPollInterval = null;
let _authPollTimeout = null;

async function startExtLogin() {
  // Cancel any existing login attempt
  clearInterval(_authPollInterval);
  clearTimeout(_authPollTimeout);
  _authPollInterval = null;

  try {
    const r = await fetch(API_BASE + '/api/agent/cli/auth/start', { method: 'POST' });
    if (!r.ok) throw new Error('Server error ' + r.status);
    const { code, verifyUrl } = await r.json();
    if (!code || !verifyUrl) throw new Error('Invalid response from server');

    await chrome.storage.local.set({ pendingAuthCode: code });

    // Open the authorization page in a new tab
    const tab = await chrome.tabs.create({ url: verifyUrl, active: true });
    _authTabId = tab.id;

    // Poll for token every 2 seconds
    _authPollInterval = setInterval(async () => {
      try {
        const pollR = await fetch(API_BASE + '/api/agent/cli/auth/poll?code=' + encodeURIComponent(code));
        const data = await pollR.json();
        if (data.status === 'ok' && data.token) {
          clearInterval(_authPollInterval);
          clearTimeout(_authPollTimeout);
          _authPollInterval = null;
          await chrome.storage.local.set({ authToken: data.token });
          await chrome.storage.local.remove('pendingAuthCode');
          // Close the auth tab
          if (_authTabId) {
            try { await chrome.tabs.remove(_authTabId); } catch {}
            _authTabId = null;
          }
          // Notify any open side panels
          chrome.runtime.sendMessage({ type: 'AUTH_COMPLETE', token: data.token }).catch(() => {});
          chrome.notifications.create({ type: 'basic', iconUrl: 'icons/icon48.png', title: 'Priv8Agent', message: '✅ Extension connected successfully!' });
        } else if (data.status === 'expired') {
          clearInterval(_authPollInterval);
          _authPollInterval = null;
          chrome.notifications.create({ type: 'basic', iconUrl: 'icons/icon48.png', title: 'Priv8Agent', message: '⏱️ Login expired. Please try connecting again.' });
        }
        // status === 'pending' → keep polling
      } catch {}
    }, 2000);

    // Timeout after 5 minutes
    _authPollTimeout = setTimeout(() => {
      clearInterval(_authPollInterval);
      _authPollInterval = null;
      chrome.notifications.create({ type: 'basic', iconUrl: 'icons/icon48.png', title: 'Priv8Agent', message: '⏱️ Login timed out. Please try connecting again.' });
    }, 5 * 60 * 1000);

  } catch (e) {
    chrome.notifications.create({ type: 'basic', iconUrl: 'icons/icon48.png', title: 'Priv8Agent', message: '❌ Login failed: ' + (e.message || 'Unknown error') });
  }
}

// ── Startup: check if already authenticated ────────────────────────────────
chrome.runtime.onStartup.addListener(async () => {
  // Just verify existing token — do NOT set a hardcoded one
  const { authToken } = await chrome.storage.local.get('authToken');
  if (!authToken) {
    // Will show login screen when side panel opens
    console.log('Priv8Agent: no token, waiting for user to connect account');
  }
});

// Install: set up context menus only
chrome.runtime.onInstalled.addListener(async () => {
  // Migrate away from any hardcoded token that was stored before
  // (remove only if it matches the old preconfigured pattern — starts with eyJhbGci and userId=15)
  const { authToken } = await chrome.storage.local.get('authToken');
  if (authToken) {
    try {
      const payload = JSON.parse(atob(authToken.split('.')[1]));
      if (payload.userId === 15 && payload.email === 'fathynassar147@gmail.com') {
        // This is the old hardcoded token — remove it so user must log in properly
        await chrome.storage.local.remove('authToken');
        console.log('Priv8Agent: removed old hardcoded token, please reconnect your account');
      }
    } catch {}
  }

  chrome.contextMenus.create({ id: 'priv8-ask', title: 'Ask Priv8Agent about "%s"', contexts: ['selection'] });
  chrome.contextMenus.create({ id: 'priv8-page', title: 'Analyze this page with Priv8Agent', contexts: ['page'] });
  chrome.contextMenus.create({ id: 'priv8-image', title: 'Analyze image with Priv8Agent', contexts: ['image'] });
  chrome.contextMenus.create({ id: 'priv8-link', title: 'Summarize link with Priv8Agent', contexts: ['link'] });
});

// Context menu handler
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const { sessionStorage } = await chrome.storage.local.get(['sessionStorage']);

  let prompt = '';
  switch (info.menuItemId) {
    case 'priv8-ask': prompt = `"${info.selectionText}" — explain and analyze this for me`; break;
    case 'priv8-page': prompt = `Analyze this page: ${info.pageUrl}`; break;
    case 'priv8-image': prompt = `Describe this image: ${info.srcUrl}`; break;
    case 'priv8-link': prompt = `Summarize this link: ${info.linkUrl}`; break;
  }

  if (prompt) {
    await chrome.storage.local.set({ pendingPrompt: prompt, pendingTab: tab?.id });
    if (tab?.id) await chrome.sidePanel.open({ tabId: tab.id });
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
      if (tab?.id) await capturePageAndSend(tab);
      break;
  }
});

// Capture page content and send to side panel
async function capturePageAndSend(tab) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const title = document.title;
        const url = window.location.href;
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
  if (msg.type === 'EXT_LOGIN_START') {
    startExtLogin().then(() => sendResponse({ ok: true })).catch(() => sendResponse({ ok: false }));
    return true;
  }
  if (msg.type === 'GET_AUTH_STATUS') {
    chrome.storage.local.get(['authToken'], (r) => {
      sendResponse({ hasToken: !!r.authToken, loggedIn: !!r.authToken });
    });
    return true;
  }
  if (msg.type === 'LOGOUT') {
    chrome.storage.local.remove(['authToken', 'pendingAuthCode'], () => sendResponse({ ok: true }));
    return true;
  }
});

// Handle side panel open on action click
chrome.action.onClicked.addListener(async (tab) => {
  if (tab?.id) await chrome.sidePanel.open({ tabId: tab.id });
});

// Track last selection per tab
const tabSelections = new Map();
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'SELECTION_CHANGED' && sender.tab?.id) {
    tabSelections.set(sender.tab.id, msg.text);
    sendResponse({ ok: true });
    return true;
  }
});

// Keep service worker alive via periodic alarm
chrome.alarms.create('keepalive', { periodInMinutes: 0.4 });

// ══════════════════════════════════════════════════════
// Computer Use — Agent controls user's real Chrome browser
// ══════════════════════════════════════════════════════

async function computerUseTick() {
  const { authToken, computerUseActive } = await chrome.storage.local.get(['authToken', 'computerUseActive']);
  if (!computerUseActive || !authToken) return;

  // 1. Get active tab and take screenshot
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  if (!tab?.id || tab.url?.startsWith('chrome://') || tab.url?.startsWith('chrome-extension://')) return;

  // Capture screenshot
  let dataUrl = null;
  try {
    dataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'jpeg', quality: 60 });
  } catch { return; }

  // Send screenshot to backend
  try {
    await fetch(API_BASE + '/api/agent/computer/screenshot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + authToken },
      body: JSON.stringify({ dataUrl, width: tab.width || 1280, height: tab.height || 720, url: tab.url }),
    });
  } catch { return; }

  // 2. Poll for pending commands
  let commands = [];
  try {
    const r = await fetch(API_BASE + '/api/agent/computer/poll?token=' + encodeURIComponent(authToken));
    const data = await r.json();
    commands = data.commands || [];
  } catch { return; }

  // 3. Execute each command via content script
  for (const cmd of commands) {
    try {
      const response = await chrome.tabs.sendMessage(tab.id, {
        type: 'COMPUTER_COMMAND',
        commandId: cmd.id,
        action: cmd.action,
        params: cmd.params,
      });
      await fetch(API_BASE + '/api/agent/computer/result', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + authToken },
        body: JSON.stringify({ commandId: cmd.id, result: response?.result || 'ok' }),
      });
    } catch (e) {
      try {
        await fetch(API_BASE + '/api/agent/computer/result', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + authToken },
          body: JSON.stringify({ commandId: cmd.id, result: 'error: ' + e.message }),
        });
      } catch {}
    }
  }
}

// Start/stop computer use from side panel
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'COMPUTER_USE_START') {
    chrome.storage.local.set({ computerUseActive: true });
    sendResponse({ ok: true });
    return true;
  }
  if (msg.type === 'COMPUTER_USE_STOP') {
    chrome.storage.local.set({ computerUseActive: false });
    sendResponse({ ok: true });
    return true;
  }
});

// Poll every 1 second via alarm
chrome.alarms.create('computer-use-poll', { periodInMinutes: 1 / 60 }); // ~1s

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'computer-use-poll') {
    computerUseTick().catch(() => {});
  }
});
