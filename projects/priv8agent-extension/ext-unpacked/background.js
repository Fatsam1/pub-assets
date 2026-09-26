// Priv8Agent Background Service Worker
const API_BASE = 'https://app.privatehash.online';
const WS_URL = 'wss://app.privatehash.online/ws';
// Direct VPS endpoint for computer-use relay (port 3002 is now open in firewall)
const COMPUTER_API = 'http://37.60.232.250:3002';

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
    const { code } = await r.json();
    if (!code) throw new Error('Invalid response from server');

    await chrome.storage.local.set({ pendingAuthCode: code });

    // Open the CLI login page where the user approves the connection
    const extLoginUrl = API_BASE + '/cli-login?code=' + encodeURIComponent(code);
    const tab = await chrome.tabs.create({ url: extLoginUrl, active: true });
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
          await chrome.storage.local.set({ authToken: data.token, computerUseActive: true });
          await chrome.storage.local.remove('pendingAuthCode');
          // Close the auth tab
          if (_authTabId) {
            try { await chrome.tabs.remove(_authTabId); } catch {}
            _authTabId = null;
          }
          // Auto-open sidepanel on the active tab
          try {
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tabs[0]?.id) await chrome.sidePanel.open({ tabId: tabs[0].id });
          } catch {}
          // Notify any open side panels
          chrome.runtime.sendMessage({ type: 'AUTH_COMPLETE', token: data.token }).catch(() => {});
          chrome.notifications.create({ type: 'basic', iconUrl: 'icons/icon48.png', title: 'Priv8Agent', message: '✅ Extension connected! Computer Use is ON 🖥️' });
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

// Open sidepanel on action click (instead of popup)
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});

// ── Auto-fetch token from privatehash.online if user is already logged in ──
// Opens a hidden tab on the website, reads localStorage token, then closes it immediately.
async function tryAutoFetchToken() {
  try {
    const { authToken } = await chrome.storage.local.get('authToken');
    if (authToken) return; // already have token

    // Create a short-lived tab to read the token from the website's localStorage
    const tab = await chrome.tabs.create({ url: API_BASE + '/silent-auth', active: false });
    const tabId = tab.id;

    // Wait for the tab to load then inject script to read token
    await new Promise((resolve) => {
      const listener = (updatedTabId, info) => {
        if (updatedTabId === tabId && info.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          resolve();
        }
      };
      chrome.tabs.onUpdated.addListener(listener);
      // Timeout after 8 seconds
      setTimeout(() => { chrome.tabs.onUpdated.removeListener(listener); resolve(); }, 8000);
    });

    // Read token from localStorage of the website (Priv8Hash uses key "token")
    let fetchedToken = null;
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
          return localStorage.getItem('token') ||
                 localStorage.getItem('p8a_token') ||
                 localStorage.getItem('authToken') ||
                 sessionStorage.getItem('token') ||
                 null;
        }
      });
      fetchedToken = results?.[0]?.result || null;
    } catch {}

    // Close the tab immediately
    try { await chrome.tabs.remove(tabId); } catch {}

    if (fetchedToken) {
      await chrome.storage.local.set({ authToken: fetchedToken, computerUseActive: true });
      chrome.runtime.sendMessage({ type: 'AUTH_COMPLETE', token: fetchedToken }).catch(() => {});
      console.log('Priv8Agent: auto-fetched token from website session');
    }
  } catch (e) {
    console.log('Priv8Agent: auto-fetch failed:', e.message);
  }
}

// ── Startup: check if already authenticated ────────────────────────────────
chrome.runtime.onStartup.addListener(async () => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
  const { authToken } = await chrome.storage.local.get('authToken');
  if (authToken) {
    await chrome.storage.local.set({ computerUseActive: true });
  } else {
    // Try auto-fetch — user might be logged in on the website
    await tryAutoFetchToken();
  }
  // If active tab is local/chrome page, open a real HTTPS tab so sidepanel loop works
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const t = tabs[0];
    if (t && (!t.url || t.url.startsWith('file://') || t.url.startsWith('chrome://') || t.url.startsWith('http://work/'))) {
      await chrome.tabs.create({ url: 'https://example.com', active: true });
    }
  } catch {}
});

// Install: set up context menus only
chrome.runtime.onInstalled.addListener(async () => {
  // Migrate away from any hardcoded token that was stored before
  const { authToken } = await chrome.storage.local.get('authToken');
  if (authToken) {
    try {
      const payload = JSON.parse(atob(authToken.split('.')[1]));
      if (payload.userId === 15 && payload.email === 'fathynassar147@gmail.com') {
        await chrome.storage.local.remove('authToken');
        console.log('Priv8Agent: removed old hardcoded token, please reconnect your account');
        // No token now — try auto-fetch
        setTimeout(() => tryAutoFetchToken(), 2000);
      } else {
        // Valid token — enable Computer Use automatically
        await chrome.storage.local.set({ computerUseActive: true });
      }
    } catch {}
  } else {
    // No token at install — try to auto-fetch from existing website session
    setTimeout(() => tryAutoFetchToken(), 2000);
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
  if (msg.type === 'RELOAD_EXTENSION') {
    sendResponse({ ok: true });
    setTimeout(() => chrome.runtime.reload(), 100);
    return true;
  }
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
  if (msg.type === 'TRY_AUTO_FETCH_TOKEN') {
    tryAutoFetchToken().then(() => sendResponse({ ok: true })).catch(() => sendResponse({ ok: false }));
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

// Side panel opens automatically via setPanelBehavior above

// ── Native Messaging Host (Claude Code bridge) ────────────────────────────────
let _nativePort = null;
function connectNativeHost() {
  try {
    _nativePort = chrome.runtime.connectNative('com.priv8agent.host');
    _nativePort.onMessage.addListener(async (cmd) => {
      let result = 'ok';
      try {
        if (cmd.type === 'reload') {
          chrome.runtime.reload();
        } else if (cmd.type === 'set_storage') {
          await chrome.storage.local.set(cmd.data || {});
        } else if (cmd.type === 'get_storage') {
          result = await chrome.storage.local.get(cmd.keys || null);
        } else if (cmd.type === 'open_sidepanel') {
          // Try sidepanel first, fallback to tab
          try {
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tabs[0]?.id) await chrome.sidePanel.open({ tabId: tabs[0].id });
          } catch {
            await chrome.tabs.create({ url: chrome.runtime.getURL('sidepanel.html'), active: true });
          }
        } else if (cmd.type === 'open_tab') {
          // Open sidepanel as a regular tab (no user gesture needed)
          await chrome.tabs.create({ url: chrome.runtime.getURL('sidepanel.html'), active: true });
          result = 'tab_opened';
        } else if (cmd.type === 'ping') {
          result = 'pong';
        } else if (cmd.type === 'computer_tick') {
          await computerUseTick();
          result = 'tick_done';
        } else if (cmd.type === 'get_tabs') {
          const tabs = await chrome.tabs.query({ currentWindow: true });
          result = tabs.map(t => ({ id: t.id, url: t.url, active: t.active, title: t.title }));
        }
      } catch(e) { result = 'error: ' + e.message; }
      _nativePort.postMessage({ type: 'result', id: cmd.id, result });
    });
    _nativePort.onDisconnect.addListener(() => {
      _nativePort = null;
      // Retry after 10s
      setTimeout(connectNativeHost, 10000);
    });
  } catch(e) { setTimeout(connectNativeHost, 10000); }
}
connectNativeHost();

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

  // 1. Get active tab — skip chrome:// and chrome-extension:// (sidepanel itself)
  let tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  let tab = tabs[0];

  // If active tab is extension/chrome page, find the most-recently-used real tab
  if (!tab?.id || tab.url?.startsWith('chrome://') || tab.url?.startsWith('chrome-extension://')) {
    const allTabs = await chrome.tabs.query({ currentWindow: true });
    tab = allTabs.find(t => t.url && !t.url.startsWith('chrome://') && !t.url.startsWith('chrome-extension://'));
    if (!tab) return; // no real tab available
  }

  // Capture screenshot — fails on DRM/protected sites (YouTube etc), continue without it
  let dataUrl = null;
  try {
    dataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'jpeg', quality: 60 });
  } catch { /* screenshot failed (DRM or minimized) — proceed with URL-only ping */ }

  // Send screenshot (or URL-only ping) to backend to keep connected:true
  try {
    const body = dataUrl
      ? { dataUrl, width: tab.width || 1280, height: tab.height || 720, url: tab.url }
      : { url: tab.url };
    await fetch(COMPUTER_API + '/api/computer/screenshot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + authToken },
      body: JSON.stringify(body),
    });
  } catch { return; }

  // 2. Poll for pending commands
  let commands = [];
  try {
    const r = await fetch(COMPUTER_API + '/api/computer/poll?token=' + encodeURIComponent(authToken));
    const data = await r.json();
    commands = data.commands || [];
  } catch { return; }

  // 3. Execute each command
  for (const cmd of commands) {
    let cmdResult = 'ok';
    try {
      if (cmd.action === 'navigate' && cmd.params?.url) {
        // Use tabs.update directly — works even without content script (YouTube, DRM sites)
        await new Promise(r => chrome.tabs.update(tab.id, { url: cmd.params.url }, r));
        cmdResult = 'navigating to ' + cmd.params.url;
      } else {
        // Auto-inject content script if not present
        try {
          await new Promise((res, rej) => chrome.tabs.sendMessage(tab.id, { type: 'PING' }, r => {
            chrome.runtime.lastError ? rej(chrome.runtime.lastError) : res(r);
          }));
        } catch {
          try {
            await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
            await new Promise(r => setTimeout(r, 400));
          } catch {}
        }
        const response = await chrome.tabs.sendMessage(tab.id, {
          type: 'COMPUTER_COMMAND',
          commandId: cmd.id,
          action: cmd.action,
          params: cmd.params,
        });
        cmdResult = response?.result || 'ok';
      }
    } catch (e) { cmdResult = 'error: ' + e.message; }
    try {
      await fetch(COMPUTER_API + '/api/computer/result', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + authToken },
        body: JSON.stringify({ commandId: cmd.id, result: cmdResult }),
      });
    } catch {}
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
  // Sidepanel keepalive — triggers a screenshot+poll cycle immediately
  if (msg.type === 'COMPUTER_TICK') {
    computerUseTick().catch(() => {});
    sendResponse({ ok: true });
    return true;
  }
  // Sidepanel relays computer commands to content script
  if (msg.type === 'COMPUTER_COMMAND') {
    const tabId = msg.tabId;
    chrome.tabs.sendMessage(tabId, {
      type: 'COMPUTER_COMMAND',
      commandId: msg.commandId,
      action: msg.action,
      params: msg.params,
    }).then(r => sendResponse(r)).catch(e => sendResponse({result: 'error: ' + e.message}));
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
