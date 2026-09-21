// Priv8Agent Content Script — injected on every page
(function () {
  if (window.__priv8AgentLoaded) return;
  window.__priv8AgentLoaded = true;

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
      background: linear-gradient(135deg, #7c3aed, #4f46e5);
      display: flex; align-items: center; justify-content: center;
      font-size: 22px; cursor: pointer; box-shadow: 0 4px 16px rgba(124,58,237,0.5);
      transition: transform 0.2s, box-shadow 0.2s;
      user-select: none;
    `;
    floatingBtn.title = 'Priv8Agent (Alt+P)';
    floatingBtn.addEventListener('mouseenter', () => {
      floatingBtn.style.transform = 'scale(1.1)';
      floatingBtn.style.boxShadow = '0 6px 24px rgba(124,58,237,0.7)';
    });
    floatingBtn.addEventListener('mouseleave', () => {
      floatingBtn.style.transform = 'scale(1)';
      floatingBtn.style.boxShadow = '0 4px 16px rgba(124,58,237,0.5)';
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
