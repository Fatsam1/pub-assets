// Priv8Agent Content Script — injected on every page
(function () {
  if (window.__priv8AgentLoaded) return;
  window.__priv8AgentLoaded = true;

  // ── Computer Use: execute commands from the agent ─────────────────────────
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === 'COMPUTER_COMMAND') {
      const { commandId, action, params } = msg;
      let result = 'ok';
      try {
        switch (action) {
          case 'navigate':
            window.location.href = params.url;
            result = 'navigating to ' + params.url;
            break;

          case 'click': {
            let el = null;
            if (params.selector) {
              el = document.querySelector(params.selector);
            } else if (params.x != null && params.y != null) {
              el = document.elementFromPoint(params.x, params.y);
            }
            if (el) {
              el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX: params.x || 0, clientY: params.y || 0 }));
              result = 'clicked ' + (el.tagName + (el.id ? '#' + el.id : '') + (el.className ? '.' + String(el.className).split(' ')[0] : ''));
            } else {
              result = 'element not found';
            }
            break;
          }

          case 'type': {
            let el = params.selector ? document.querySelector(params.selector) : document.activeElement;
            if (!el) el = document.activeElement;
            if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) {
              if (el.isContentEditable) {
                el.focus();
                document.execCommand('insertText', false, params.text);
              } else {
                el.focus();
                const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
                  || Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
                if (nativeInputValueSetter) nativeInputValueSetter.call(el, (el.value || '') + params.text);
                else el.value = (el.value || '') + params.text;
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
              }
              result = 'typed: ' + params.text.slice(0, 50);
            } else {
              result = 'no editable element focused';
            }
            break;
          }

          case 'key': {
            const target = document.activeElement || document.body;
            const keyStr = String(params.key || '');
            const parts = keyStr.toLowerCase().split('+');
            const key = parts[parts.length - 1];
            const keyMap = { enter: 'Enter', tab: 'Tab', escape: 'Escape', backspace: 'Backspace', delete: 'Delete', arrowup: 'ArrowUp', arrowdown: 'ArrowDown', arrowleft: 'ArrowLeft', arrowright: 'ArrowRight', f5: 'F5', home: 'Home', end: 'End', pageup: 'PageUp', pagedown: 'PageDown' };
            const keyCode = keyMap[key] || key.charAt(0).toUpperCase() + key.slice(1);
            const opts = { bubbles: true, cancelable: true, key: keyCode, ctrlKey: parts.includes('ctrl'), shiftKey: parts.includes('shift'), altKey: parts.includes('alt'), metaKey: parts.includes('cmd') || parts.includes('meta') };
            target.dispatchEvent(new KeyboardEvent('keydown', opts));
            target.dispatchEvent(new KeyboardEvent('keyup', opts));
            result = 'key: ' + keyStr;
            break;
          }

          case 'scroll': {
            const amount = params.amount || 300;
            const dir = params.direction || 'down';
            const dx = dir === 'left' ? -amount : dir === 'right' ? amount : 0;
            const dy = dir === 'up' ? -amount : dir === 'down' ? amount : 0;
            if (params.x != null && params.y != null) {
              const el = document.elementFromPoint(params.x, params.y);
              (el || window).scrollBy({ left: dx, top: dy, behavior: 'smooth' });
            } else {
              window.scrollBy({ left: dx, top: dy, behavior: 'smooth' });
            }
            result = 'scrolled ' + dir + ' ' + amount + 'px';
            break;
          }

          case 'hover': {
            let el = params.selector ? document.querySelector(params.selector) : params.x != null ? document.elementFromPoint(params.x, params.y) : null;
            if (el) {
              el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, clientX: params.x || 0, clientY: params.y || 0 }));
              el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
              result = 'hovered ' + el.tagName;
            } else {
              result = 'element not found';
            }
            break;
          }

          case 'read_page':
            result = JSON.stringify({
              title: document.title,
              url: window.location.href,
              text: document.body?.innerText?.slice(0, 10000) || '',
              links: [...document.links].slice(0, 30).map(a => ({ text: a.innerText.trim().slice(0, 80), href: a.href })),
              inputs: [...document.querySelectorAll('input,textarea,select')].slice(0, 20).map(el => ({ tag: el.tagName, type: el.type || '', name: el.name || '', placeholder: el.placeholder || '', value: el.value?.slice(0, 100) || '' })),
            });
            break;

          case 'find_element': {
            let found = null;
            if (params.selector) {
              found = document.querySelector(params.selector);
            } else if (params.text) {
              const allEls = document.querySelectorAll('a,button,input,label,h1,h2,h3,p,span,div,li');
              for (const el of allEls) {
                if (el.innerText?.toLowerCase().includes(params.text.toLowerCase()) || el.value?.toLowerCase().includes(params.text.toLowerCase())) {
                  found = el;
                  break;
                }
              }
            }
            if (found) {
              const rect = found.getBoundingClientRect();
              result = JSON.stringify({ found: true, tag: found.tagName, text: found.innerText?.slice(0, 100), x: Math.round(rect.left + rect.width / 2), y: Math.round(rect.top + rect.height / 2), rect: { top: Math.round(rect.top), left: Math.round(rect.left), width: Math.round(rect.width), height: Math.round(rect.height) } });
            } else {
              result = JSON.stringify({ found: false });
            }
            break;
          }

          default:
            result = 'unknown action: ' + action;
        }
      } catch (e) {
        result = 'error: ' + e.message;
      }
      sendResponse({ commandId, result });
      return true;
    }
  });

  // Listen for messages from the side panel / background
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === 'GET_PAGE_CONTENT') {
      const title = document.title;
      const url = window.location.href;
      const selectedText = window.getSelection()?.toString() || '';
      const bodyText = document.body?.innerText?.slice(0, 8000) || '';
      const metaDesc = document.querySelector('meta[name="description"]')?.getAttribute('content') || '';
      const h1 = document.querySelector('h1')?.innerText || '';

      // Get all images with alt text
      const images = [...document.images].slice(0, 5).map(img => ({
        src: img.src,
        alt: img.alt,
      }));

      sendResponse({ title, url, selectedText, bodyText, metaDesc, h1, images });
      return true;
    }

    if (msg.type === 'HIGHLIGHT_TEXT') {
      // Highlight text matching the query on the page
      if (msg.text) {
        try {
          const selection = window.getSelection();
          const range = document.createRange();
          const result = document.evaluate(
            `//text()[contains(., '${msg.text.substring(0, 50).replace(/'/g, "\\'")}')]`,
            document.body, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null
          );
          if (result.singleNodeValue) {
            range.selectNode(result.singleNodeValue);
            selection?.removeAllRanges();
            selection?.addRange(range);
            result.singleNodeValue.parentElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        } catch {}
      }
      sendResponse({ ok: true });
      return true;
    }

    if (msg.type === 'INSERT_TEXT') {
      // Insert text into focused input/textarea
      const el = document.activeElement;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) {
        if (el.isContentEditable) {
          el.innerText += msg.text;
        } else {
          const start = el.selectionStart;
          const end = el.selectionEnd;
          const val = el.value;
          el.value = val.slice(0, start) + msg.text + val.slice(end);
          el.selectionStart = el.selectionEnd = start + msg.text.length;
          el.dispatchEvent(new Event('input', { bubbles: true }));
        }
        sendResponse({ ok: true });
      } else {
        sendResponse({ ok: false, reason: 'no active text input' });
      }
      return true;
    }
  });

  // Floating quick-access button (hidden by default, shown on Alt+P)
  let floatingBtn = null;

  function createFloatingBtn() {
    if (floatingBtn) return;
    floatingBtn = document.createElement('div');
    floatingBtn.id = '__priv8_btn';
    floatingBtn.innerHTML = '🐍';
    floatingBtn.style.cssText = `
      position: fixed; bottom: 20px; right: 20px; z-index: 2147483647;
      width: 44px; height: 44px; border-radius: 50%;
      background: #0d1117;
      border: 1.5px solid rgba(0,255,65,0.5);
      display: flex; align-items: center; justify-content: center;
      font-size: 20px; cursor: pointer;
      box-shadow: 0 4px 16px rgba(0,255,65,0.25), 0 0 0 0 rgba(0,255,65,0.15);
      transition: transform 0.2s, box-shadow 0.2s;
      user-select: none;
    `;
    floatingBtn.title = 'Priv8Agent (Alt+P)';
    floatingBtn.addEventListener('mouseenter', () => {
      floatingBtn.style.transform = 'scale(1.1)';
      floatingBtn.style.boxShadow = '0 6px 24px rgba(0,255,65,0.5), 0 0 0 4px rgba(0,255,65,0.1)';
    });
    floatingBtn.addEventListener('mouseleave', () => {
      floatingBtn.style.transform = 'scale(1)';
      floatingBtn.style.boxShadow = '0 4px 16px rgba(0,255,65,0.25)';
    });
    floatingBtn.addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'OPEN_SIDEPANEL' });
    });
    document.body.appendChild(floatingBtn);
  }

  document.addEventListener('keydown', (e) => {
    if (e.altKey && e.key === 'p') {
      e.preventDefault();
      if (!floatingBtn) {
        createFloatingBtn();
      } else {
        floatingBtn.style.display = floatingBtn.style.display === 'none' ? 'flex' : 'none';
      }
    }
  });

  // Right-click selection: send to side panel automatically
  document.addEventListener('mouseup', () => {
    const sel = window.getSelection()?.toString().trim();
    if (sel && sel.length > 10) {
      // Store in local for quick access
      chrome.runtime.sendMessage({ type: 'SELECTION_CHANGED', text: sel }).catch(() => {});
    }
  });
})();
