
const API = 'https://app.privatehash.online';
const WS_PATH = '/agent/ws'; // Nginx proxies /agent/ws → backend /ws (bypasses Cloudflare WS block)
let token = '', ws = null, sessionId = null, streaming = false, buf = '', pendingMsg = null, model = '', reconnects = 0, reconnTimer = null;
let systemPrompt = '', forceLang = '', quality = 'normal';
let attachedImages = []; // [{ dataUrl, name, mimeType }, ...]
let searchMatches = [], searchIdx = -1;
let incognito = false;
let currentMode = 'chat'; // chat | code | artifacts
let projects = []; // { id, name, color, sessionIds[] }
let activeProjectFilter = null;

const $= id => document.getElementById(id);
const authScreen=$('auth-screen'), statusPill=$('status-pill'), statusText=$('status-text');
const messagesEl=$('messages'), welcomeEl=$('welcome'), chatInput=$('chat-input');
const btnSend=$('btn-send'), btnStop=$('btn-stop');

// ─── Init ───
async function init() {
  const s = await chrome.storage.local.get(['authToken','serverUrl','defaultModel','systemPrompt','forceLang','quality','theme']);
  token = s.authToken || '';
  model = s.defaultModel || '';
  systemPrompt = s.systemPrompt || '';
  forceLang = s.forceLang || '';
  if (s.quality) { quality = s.quality; $('quality-select').value = s.quality; }
  if (s.defaultModel) { $('model-select').value = s.defaultModel; $('s-model').value = s.defaultModel; }
  if (s.serverUrl) $('s-server').value = s.serverUrl;
  if (s.systemPrompt) $('s-system').value = s.systemPrompt;
  if (s.forceLang) $('s-lang').value = s.forceLang;
  applyTheme(s.theme||'dark');
  if (!token) { showLoginScreen(); return; }
  const ps = await chrome.storage.local.get(['p8Projects']);
  projects = ps.p8Projects || [];
  renderProjectsBar();
  boot();
}

// ─── Login Screen (device-flow) ───
let _loginPollTimer = null;
function showLoginScreen() {
  authScreen.classList.add('visible');
  $('auth-step-connect').style.display = '';
  $('auth-step-waiting').style.display = 'none';
  $('auth-error').style.display = 'none';
}

$('btn-auth') && $('btn-auth').addEventListener('click', async () => {
  $('auth-error').style.display = 'none';
  $('auth-step-connect').style.display = 'none';
  $('auth-step-waiting').style.display = '';

  // Tell background to start the device-flow login
  chrome.runtime.sendMessage({ type: 'EXT_LOGIN_START' }, (r) => {
    if (!r?.ok) {
      $('auth-step-waiting').style.display = 'none';
      $('auth-step-connect').style.display = '';
      $('auth-error').style.display = '';
    }
  });

  // Poll localStorage until token appears (background sets it when approved)
  clearInterval(_loginPollTimer);
  _loginPollTimer = setInterval(async () => {
    const { authToken } = await chrome.storage.local.get('authToken');
    if (authToken) {
      clearInterval(_loginPollTimer);
      _loginPollTimer = null;
      token = authToken;
      authScreen.classList.remove('visible');
      // Resume normal init
      const ps = await chrome.storage.local.get(['p8Projects']);
      projects = ps.p8Projects || [];
      renderProjectsBar();
      boot();
    }
  }, 1500);
});

$('btn-auth-cancel') && $('btn-auth-cancel').addEventListener('click', () => {
  clearInterval(_loginPollTimer);
  _loginPollTimer = null;
  $('auth-step-waiting').style.display = 'none';
  $('auth-step-connect').style.display = '';
});

// Listen for AUTH_COMPLETE from background (fast path)
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'AUTH_COMPLETE' && msg.token && !token) {
    clearInterval(_loginPollTimer);
    _loginPollTimer = null;
    token = msg.token;
    authScreen.classList.remove('visible');
    chrome.storage.local.get(['p8Projects']).then(ps => {
      projects = ps.p8Projects || [];
      renderProjectsBar();
      boot();
    });
  }
});
function applyTheme(t) {
  $('app').dataset.theme=t;
  // update theme buttons active state
  const lt=$('btn-theme-light'), dk=$('btn-theme-dark');
  if(lt&&dk){
    const activeStyle='flex:1;padding:8px;border-radius:var(--radius-sm);background:var(--accent-dim);border:1px solid rgba(0,255,65,.25);color:var(--accent);cursor:pointer;font-size:12px;font-family:inherit;transition:all .15s;';
    const idleStyle='flex:1;padding:8px;border-radius:var(--radius-sm);background:var(--bg-input);border:1px solid var(--border);color:var(--text-secondary);cursor:pointer;font-size:12px;font-family:inherit;transition:all .15s;';
    lt.style.cssText=t==='light'?activeStyle:idleStyle;
    dk.style.cssText=t==='dark'?activeStyle:idleStyle;
  }
}
window.setTheme=(t)=>{
  applyTheme(t);
  chrome.storage.local.set({theme:t});
}

// ─── Boot ───
async function boot() {
  // Auto-enable Computer Use when logged in
  chrome.storage.local.set({ computerUseActive: true });
  chrome.runtime.sendMessage({ type: 'COMPUTER_USE_START' }).catch(() => {});
  connectWs();
  const {lastSession} = await chrome.storage.local.get('lastSession');
  if (lastSession) { sessionId = lastSession; await loadHistory(lastSession); }
  loadSessions();
  checkPending();
}

// ─── WebSocket ───
function connectWs() {
  if (ws && ws.readyState <= 1) return;
  const url = API.replace('https://','wss://').replace('http://','ws://') + WS_PATH + '?token=' + encodeURIComponent(token);
  try { ws = new WebSocket(url); } catch { scheduleRecon(); return; }
  ws.onopen = () => { statusPill.className='online'; statusText.textContent='Connected'; reconnects=0; if(sessionId) ws.send(JSON.stringify({type:'hello',sessionId})); };
  ws.onclose = () => {
    statusPill.className = reconnects >= 3 ? 'error' : '';
    statusText.textContent = reconnects >= 3 ? 'Error' : 'Offline';
    scheduleRecon();
  };
  ws.onerror = () => { statusPill.className=''; statusText.textContent='Error'; };
  ws.onmessage = e => { try { onWsEvent(JSON.parse(e.data)); } catch {} };
}
function scheduleRecon() {
  if (reconnTimer) return;
  reconnects++;
  reconnTimer = setTimeout(() => { reconnTimer=null; connectWs(); }, Math.min(1000*Math.pow(1.5,reconnects),30000));
}
function onWsEvent(ev) {
  switch(ev.type) {
    case 'token': case 'text_delta': case 'assistant_token':
    case 'assistant_text_delta': appendToken(ev.content||ev.delta||ev.token||''); break;
    case 'turn_start': case 'step_status': if(!pendingMsg) startAi(); break;
    case 'turn_end': case 'done': case 'turn_complete':
    case 'assistant_message_done': finishAi(); break;
    case 'thinking': case 'thinking_delta': showThink(ev.content||ev.delta||''); break;
    case 'error': finishAi(); addMsg('ai',`❌ ${ev.message||'An error occurred'}`); break;
    case 'session_created': case 'session_id':
      if(ev.sessionId){sessionId=ev.sessionId;chrome.storage.local.set({lastSession:ev.sessionId});}
      break;
    case 'media': if(ev.url||ev.dataUrl) addImage(ev.url||ev.dataUrl); break;
    case 'pong': case 'status': case 'terminal': case 'plan':
    case 'plan_update': case 'step_complete': case 'file_changed': break;
  }
}

// ─── Sessions ───
async function loadSessions() {
  try {
    const el = $('sessions-list');
    if(!el.childElementCount) {
      el.innerHTML='<div style="padding:8px 6px;display:flex;flex-direction:column;gap:4px;">' +
        Array(5).fill('<div style="height:44px;border-radius:8px;background:var(--bg-secondary);animation:skel 1.2s ease-in-out infinite;"></div>').join('') + '</div>';
    }
    const r = await fetch(`${API}/api/agent/sessions`,{headers:{Authorization:`Bearer ${token}`}});
    if(!r.ok) return;
    const rawList = await r.json();
    const list = filterSessionsByProject(rawList);
    el.innerHTML='';
    if(!list.length){
      el.innerHTML='<div style="padding:24px 16px;text-align:center;color:var(--text-muted);font-size:12px;line-height:1.8;">No conversations yet<br><span style="font-size:20px">💬</span><br>Start chatting to see history here</div>';
      return;
    }
    list.slice(0,40).forEach(s => {
      const d=document.createElement('div'); d.className='session-item'+(s.id===sessionId?' current':'');
      d.style.display='flex'; d.style.alignItems='center'; d.style.gap='6px';
      const info=document.createElement('div'); info.style.cssText='flex:1;min-width:0;';
      info.innerHTML=`<div class="si-title">${esc(s.title||'Conversation')}</div><div class="si-meta">${s.messageCount||0} messages</div>`;
      // double-click to rename
      info.querySelector('.si-title').addEventListener('dblclick', e => {
        e.stopPropagation();
        const titleEl=e.target; const old=titleEl.textContent;
        const inp=document.createElement('input'); inp.value=old;
        inp.className='si-title'; titleEl.replaceWith(inp); inp.focus(); inp.select();
        const save=async()=>{
          const nv=inp.value.trim()||old;
          inp.replaceWith(Object.assign(document.createElement('div'),{className:'si-title',textContent:nv}));
          try{ await fetch(`${API}/api/agent/session/${encodeURIComponent(s.id)}`,{method:'PATCH',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({title:nv})}); }catch{}
        };
        inp.addEventListener('blur',save);
        inp.addEventListener('keydown',e2=>{if(e2.key==='Enter')inp.blur();if(e2.key==='Escape'){inp.value=old;inp.blur();}});
      });
      const del=document.createElement('button'); del.className='si-del'; del.textContent='🗑';
      del.title='Delete conversation';
      del.onclick=async e=>{
        e.stopPropagation();
        if(!confirm('Delete this conversation?')) return;
        try{ await fetch(`${API}/api/agent/session/${encodeURIComponent(s.id)}`,{method:'DELETE',headers:{Authorization:`Bearer ${token}`}}); }catch{}
        if(s.id===sessionId) newChat();
        loadSessions();
      };
      d.appendChild(info); d.appendChild(del);
      d.onclick=()=>switchSession(s.id);
      d.oncontextmenu = e => {
        e.preventDefault();
        if (!projects.length) { showToast('No projects — create one in Sessions bar'); return; }
        const opts = projects.map((p,i)=>`${i+1}. ${p.name}`).join('\n');
        const choice = prompt(`Assign to project (0 to remove):\n${opts}`);
        if (choice === null) return;
        const idx = parseInt(choice) - 1;
        projects.forEach(p => { p.sessionIds = p.sessionIds.filter(id=>id!==s.id); });
        if (idx >= 0 && idx < projects.length) projects[idx].sessionIds.push(s.id);
        saveProjects();
      };
      el.appendChild(d);
    });
  } catch {}
}
async function switchSession(id) {
  sessionId=id; chrome.storage.local.set({lastSession:id});
  messagesEl.innerHTML=''; messagesEl.style.display='none'; welcomeEl.style.display='flex';
  if(ws?.readyState===1) ws.send(JSON.stringify({type:'hello',sessionId:id}));
  await loadHistory(id); showPanel('chat'); loadSessions();
}
async function loadHistory(id) {
  try {
    const r=await fetch(`${API}/api/agent/session/${encodeURIComponent(id)}/history`,{headers:{Authorization:`Bearer ${token}`}});
    if(!r.ok) return;
    const data=await r.json();
    const msgs=data.messages||data||[];
    if(msgs.length){
      welcomeEl.style.display='none'; messagesEl.style.display='flex';
      msgs.forEach(m=>{
        const ts=m.createdAt||m.timestamp||m.created_at;
        if(m.role==='user') addMsg('user',m.content||'',false,ts);
        else if(m.role==='assistant') addMsg('ai',m.content||'',false,ts);
      });
      scrollBot(); patchAiBubbles();
    }
  } catch {}
}
function newChat() {
  sessionId=null; chrome.storage.local.remove('lastSession');
  messagesEl.innerHTML=''; messagesEl.style.display='none'; welcomeEl.style.display='flex';
  userScrolled=false; $('btn-scroll-bot').style.display='none';
  if(ws?.readyState===1) ws.send(JSON.stringify({type:'hello'}));
  showPanel('chat');
}

// ─── Messaging ───
function send(content) {
  if((!content.trim()&&!attachedImages.length)||streaming) return;
  if(!token){authScreen.classList.add('visible');return;}
  if(!ws||ws.readyState!==1){connectWs();setTimeout(()=>send(content),600);return;}

  let effectiveContent = content.trim();
  if(forceLang) {
    const langNames = {ar:'Arabic',en:'English',fr:'French',de:'German',es:'Spanish'};
    effectiveContent = (effectiveContent ? effectiveContent + '\n\n' : '') + `[Please reply in ${langNames[forceLang]||forceLang}]`;
  }
  const payload = {
    type:'user_message',
    content: effectiveContent || '',
    ...(sessionId?{sessionId}:{}),
    ...(model?{model}:{}),
    ...(systemPrompt&&!sessionId?{systemPrompt}:{}),
    ...(quality&&quality!=='normal'?{quality}:{}),
    ...(currentMode==='code'?{mode:'code'}:{}),
    ...(incognito?{incognito:true}:{})
  };

  // Attach images if present (support multiple)
  if(attachedImages.length) {
    if(attachedImages.length === 1) {
      payload.image = attachedImages[0].dataUrl;
      payload.imageName = attachedImages[0].name;
    } else {
      payload.images = attachedImages.map(i=>({data:i.dataUrl,name:i.name,mimeType:i.mimeType}));
    }
    // Show image previews in user bubble
    const g=document.createElement('div'); g.className='msg-group user';
    const imgs=attachedImages.map(i=>`<img src="${esc(i.dataUrl)}" style="max-width:100%;max-height:120px;border-radius:6px;border:1px solid var(--border);display:inline-block;margin:2px"/>`).join('');
    g.innerHTML=`<div class="msg-sender">You<div class="sender-avatar">👤</div></div><div class="bubble">${imgs}${content.trim()?`<div style="margin-top:6px">${esc(content.trim())}</div>`:''}</div>`;
    welcomeEl.style.display='none'; messagesEl.style.display='flex';
    messagesEl.appendChild(g); scrollBot(true);
    clearAttach();
  } else if(content.trim()) {
    addMsg('user',content);
    welcomeEl.style.display='none'; messagesEl.style.display='flex';
    scrollBot(true);
  }

  try { ws.send(JSON.stringify(payload)); } catch { toast('⚠️ Send failed — reconnecting…'); finishAi(); connectWs(); return; }
  userScrolled=false;
  streaming=true; btnSend.disabled=true; btnStop.classList.add('show'); startAi();
}
function startAi() {
  if(pendingMsg) return;
  buf='';
  const g=document.createElement('div'); g.className='msg-group ai';
  g.innerHTML=`<div class="msg-sender"><div class="sender-avatar"><svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M5 0.5L9 2.75V7.25L5 9.5L1 7.25V2.75L5 0.5Z" stroke="#00FF41" stroke-width="0.8"/></svg></div>Priv8Agent</div><div class="bubble"><div class="typing"><span></span><span></span><span></span></div></div>`;
  messagesEl.appendChild(g); pendingMsg=g; scrollBot();
}
function appendToken(t) {
  if(!pendingMsg) startAi();
  buf+=t;
  pendingMsg.querySelector('.bubble').innerHTML=renderMd(buf);
  scrollBot();
}
let thinkBuf = '';
function showThink(t) {
  if(!pendingMsg) startAi();
  thinkBuf += t;
  const bubble = pendingMsg.querySelector('.bubble');
  let thinkEl = bubble.querySelector('.think-block');
  if(!thinkEl) {
    bubble.innerHTML = `<details class="think-block" style="margin-bottom:6px"><summary style="cursor:pointer;font-size:11px;color:var(--text-muted);user-select:none">💭 Thinking…</summary><div class="think-body" style="font-size:12px;color:var(--text-muted);font-style:italic;margin-top:4px;white-space:pre-wrap;max-height:120px;overflow-y:auto;"></div></details>`;
    thinkEl = bubble.querySelector('.think-block');
  }
  thinkEl.querySelector('.think-body').textContent = thinkBuf;
}
function finishAi() {
  if(pendingMsg){
    const b=pendingMsg.querySelector('.bubble');
    if(buf){
      const thinkEl = b.querySelector('.think-block');
      if(thinkEl){
        // keep think block, append response after it
        const resp = document.createElement('div');
        resp.innerHTML = renderMd(buf);
        b.appendChild(resp);
        addCopyBtns(b); addInsertBtn(b);
      } else {
        b.innerHTML=renderMd(buf); addCopyBtns(b); addInsertBtn(b);
      }
    } else pendingMsg.remove();
    pendingMsg=null;
    const snippet=buf.slice(0,100); buf=''; thinkBuf='';
    // Completion notification (only when sidepanel is in background)
    if(document.hidden && snippet) {
      chrome.notifications.create({type:'basic',iconUrl:'icons/icon48.png',title:'Priv8Agent',message:snippet});
    }
  }
  streaming=false; btnSend.disabled=false; btnStop.classList.remove('show'); scrollBot(); loadSessions();
}
function fmtTime(d=new Date()){return d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});}

function addMsg(role,content,scroll=true,msgTime=null) {
  const g=document.createElement('div'); g.className=`msg-group ${role}`;
  const sender=role==='user'?'You':'Priv8Agent';
  const avatar=role==='user'?'👤':'<svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M5 0.5L9 2.75V7.25L5 9.5L1 7.25V2.75L5 0.5Z" stroke="#00FF41" stroke-width="0.8"/></svg>';
  const b=document.createElement('div'); b.className='bubble';
  if(role==='ai'){b.innerHTML=renderMd(content);addCopyBtns(b);addInsertBtn(b);}
  else b.textContent=content;
  const senderRow=document.createElement('div'); senderRow.className='msg-sender';
  senderRow.innerHTML=role==='user'?`${sender}<div class="sender-avatar">${avatar}</div>`:`<div class="sender-avatar">${avatar}</div>${sender}`;
  g.appendChild(senderRow); g.appendChild(b);
  // timestamp
  const ts=document.createElement('div'); ts.className='msg-time'; ts.textContent=msgTime?fmtTime(new Date(msgTime)):fmtTime();
  g.appendChild(ts);
  // edit button on user messages
  if(role==='user'){
    const editBtn=document.createElement('button'); editBtn.className='msg-edit-btn'; editBtn.title='Edit message'; editBtn.textContent='✏️';
    editBtn.onclick=()=>{
      const orig=b.textContent;
      b.innerHTML=`<textarea class="msg-edit-ta">${esc(orig)}</textarea><div class="msg-edit-btns"><button class="msg-edit-save">Send</button><button class="msg-edit-cancel">Cancel</button></div>`;
      const ta=b.querySelector('.msg-edit-ta'); ta.style.cssText='width:100%;background:var(--bg-input);border:1px solid var(--accent);color:var(--text-primary);border-radius:6px;padding:6px 8px;font-size:13px;font-family:inherit;resize:vertical;outline:none;';
      ta.focus(); ta.setSelectionRange(ta.value.length,ta.value.length);
      b.querySelector('.msg-edit-save').onclick=()=>{
        const nv=ta.value.trim(); if(!nv) return;
        b.textContent=nv;
        // Remove all messages after this one and re-send
        let next=g.nextSibling;
        while(next){const n2=next.nextSibling;next.remove();next=n2;}
        pendingMsg=null; buf=''; thinkBuf='';
        chatInput.value=''; resize();
        send(nv);
      };
      b.querySelector('.msg-edit-cancel').onclick=()=>{ b.textContent=orig; };
    };
    ts.appendChild(editBtn);
  }
  // reactions on AI messages
  if(role==='ai'){
    const rx=document.createElement('div'); rx.className='msg-reactions';
    ['👍','👎','❤️','🔁'].forEach(em=>{
      const btn=document.createElement('button'); btn.className='react-btn'; btn.textContent=em;
      btn.title=em==='👍'?'Good response':em==='👎'?'Bad response':em==='❤️'?'Love it':'Regenerate';
      btn.onclick=()=>{
        if(em==='🔁'){if(ws?.readyState===1&&sessionId) ws.send(JSON.stringify({type:'regenerate',sessionId})); return;}
        btn.classList.toggle('active');
        rx.querySelectorAll('.react-btn').forEach(b2=>{if(b2!==btn&&(b2.textContent==='👍'||b2.textContent==='👎')) b2.classList.remove('active');});
      };
      rx.appendChild(btn);
    });
    g.appendChild(rx);
  }
  messagesEl.appendChild(g);
  if(scroll) scrollBot();
}
function addImage(src) {
  const g=document.createElement('div'); g.className='msg-group ai';
  g.innerHTML=`<div class="msg-sender"><div class="sender-avatar"><svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M5 0.5L9 2.75V7.25L5 9.5L1 7.25V2.75L5 0.5Z" stroke="#00FF41" stroke-width="0.8"/></svg></div>Priv8Agent</div><div class="bubble"><img src="${esc(src)}" style="max-width:100%;border-radius:8px;margin-top:4px" /></div>`;
  messagesEl.appendChild(g); scrollBot();
}

// ─── Markdown ───
function renderMd(t) {
  if(!t) return '';
  let h=t;
  h=h.replace(/```(\w*)\n?([\s\S]*?)```/g,(_,lang,code)=>`<pre><button class="copy-btn" onclick="copyPre(this)">Copy</button><code>${esc(code.trim())}</code></pre>`);
  h=h.replace(/`([^`\n]+)`/g,'<code>$1</code>');
  h=h.replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>');
  h=h.replace(/\*(.+?)\*/g,'<em>$1</em>');
  h=h.replace(/^### (.+)$/gm,'<h3>$1</h3>');
  h=h.replace(/^## (.+)$/gm,'<h2>$1</h2>');
  h=h.replace(/^# (.+)$/gm,'<h1>$1</h1>');
  h=h.replace(/^[\-\*] (.+)$/gm,'<li>$1</li>');
  h=h.replace(/(<li>[\s\S]+?<\/li>)/g,'<ul>$1</ul>');
  h=h.replace(/\[([^\]]+)\]\(([^)]+)\)/g,'<a href="$2" target="_blank">$1</a>');
  h=h.replace(/\n/g,'<br>');
  return h;
}
function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function addCopyBtns(el){el.querySelectorAll('pre').forEach(p=>{if(!p.querySelector('.copy-btn')){const b=document.createElement('button');b.className='copy-btn';b.textContent='Copy';b.onclick=()=>copyPre(b);p.insertBefore(b,p.firstChild);}});}
window.copyPre=(btn)=>{const c=btn.parentElement?.querySelector('code');if(c){navigator.clipboard.writeText(c.textContent);btn.textContent='Copied!';setTimeout(()=>btn.textContent='Copy',1500);}};

// ─── Page actions ───
async function capturePage() {
  try {
    const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
    if(!tab?.id)return;
    const r=await chrome.scripting.executeScript({target:{tabId:tab.id},func:()=>({title:document.title,url:location.href,sel:getSelection()?.toString()||'',body:document.body?.innerText?.slice(0,7000)||''})});
    if(!r?.[0]?.result)return;
    const {title,url,sel,body}=r[0].result;
    const txt=sel?`Selected text:\n"${sel}"`:`Page content:\n${body.slice(0,6000)}`;
    showPanel('chat'); send(`Analyze this page:\n**${title}**\n${url}\n\n${txt}`);
  } catch { toast('⚠️ Could not capture page'); }
}
async function sendSel() {
  try {
    const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
    if(!tab?.id)return;
    const r=await chrome.scripting.executeScript({target:{tabId:tab.id},func:()=>getSelection()?.toString()||''});
    const sel=r?.[0]?.result?.trim();
    if(!sel){toast('⚠️ No text selected on page');return;}
    showPanel('chat'); send(`Explain this:\n"${sel}"`);
  } catch { toast('⚠️ Could not get selection'); }
}
async function doScreenshot() {
  chrome.runtime.sendMessage({type:'TAKE_SCREENSHOT'},res=>{
    if(res?.dataUrl){
      const g=document.createElement('div'); g.className='msg-group user';
      g.innerHTML=`<div class="msg-sender">You<div class="sender-avatar">👤</div></div><div class="bubble"><img src="${res.dataUrl}" style="max-width:100%;border-radius:8px;max-height:180px" /><br><span style="font-size:12px;color:var(--text-muted)">Screenshot</span></div>`;
      welcomeEl.style.display='none'; messagesEl.style.display='flex'; messagesEl.appendChild(g); scrollBot();
      send('What do you see in this screenshot? Describe and analyze it.');
    }
  });
}

// ─── UI helpers ───
function showPanel(p) {
  $('sessions-panel').classList.remove('visible');
  $('settings-panel').classList.remove('visible');
  $('global-search').classList.remove('visible');
  $('chat-panel').style.display='none';
  $('btn-sessions-toggle').classList.remove('active');
  $('btn-settings-toggle').classList.remove('active');
  $('btn-search-global').classList.remove('active');
  if(p==='chat'){$('chat-panel').style.display='flex';}
  else if(p==='sessions'){$('sessions-panel').classList.add('visible');$('btn-sessions-toggle').classList.add('active');}
  else if(p==='settings'){$('settings-panel').classList.add('visible');$('btn-settings-toggle').classList.add('active');}
  else if(p==='search-global'){$('global-search').classList.add('visible');$('btn-search-global').classList.add('active');}
}
let userScrolled=false;
messagesEl.addEventListener('scroll',()=>{
  const atBottom=messagesEl.scrollHeight-messagesEl.scrollTop-messagesEl.clientHeight<60;
  userScrolled=!atBottom;
  $('btn-scroll-bot').style.display=atBottom?'none':'flex';
});
$('btn-scroll-bot').addEventListener('click',()=>{userScrolled=false;scrollBot(true);});
function scrollBot(force=false){
  if(force||!userScrolled) setTimeout(()=>{messagesEl.scrollTop=messagesEl.scrollHeight; userScrolled=false;},10);
}
function toast(msg,dur=2500){const t=$('toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),dur);}
async function checkPending(){
  const d=await chrome.storage.local.get(['pendingPrompt','focusInput','pendingScreenshot','showSessions','showSettings']);
  if(d.pendingPrompt){chrome.storage.local.remove('pendingPrompt');showPanel('chat');send(d.pendingPrompt);}
  if(d.focusInput){chrome.storage.local.remove('focusInput');chatInput.focus();}
  if(d.pendingScreenshot){chrome.storage.local.remove('pendingScreenshot');showPanel('chat');doScreenshot();}
  if(d.showSessions){chrome.storage.local.remove('showSessions');showPanel('sessions');loadSessions();}
  if(d.showSettings){chrome.storage.local.remove('showSettings');showPanel('settings');}
}

// ─── Events ───
// btn-auth device-flow handler is defined in the init section above

$('btn-new').addEventListener('click',newChat);
$('btn-sessions-toggle').addEventListener('click',()=>{const open=$('sessions-panel').classList.contains('visible');showPanel(open?'chat':'sessions');if(!open)loadSessions();});
$('btn-settings-toggle').addEventListener('click',()=>{const open=$('settings-panel').classList.contains('visible');showPanel(open?'chat':'settings');if(!open&&token)$('s-token').value=token;});

btnSend.addEventListener('click',()=>{const t=chatInput.value.trim();if(t||attachedImages.length){send(t||'');chatInput.value='';resize();}});
btnStop.addEventListener('click',()=>{if(ws?.readyState===1&&sessionId)ws.send(JSON.stringify({type:'stop',sessionId}));finishAi();});
chatInput.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();btnSend.click();}});
chatInput.addEventListener('input',resize);
function resize(){
  chatInput.style.height='auto';
  chatInput.style.height=Math.min(chatInput.scrollHeight,140)+'px';
  // character counter
  const len=chatInput.value.length;
  let counter=$('char-counter');
  if(!counter){
    counter=document.createElement('span');
    counter.id='char-counter';
    counter.style.cssText='font-size:10px;color:var(--text-muted);margin-right:4px;';
    $('btn-stop').parentElement.insertBefore(counter,$('btn-stop'));
  }
  counter.textContent=len>100?`${len}`:'' ;
  counter.style.color=len>3000?'var(--yellow)':len>7000?'var(--red)':'var(--text-muted)';
  // send btn dim when empty
  const hasContent=len>0||attachedImages.length>0;
  btnSend.style.opacity=hasContent?'1':'0.35';
}

document.querySelectorAll('.sug').forEach(b=>b.addEventListener('click',async()=>{
  const p=b.dataset.prompt; if(!p)return;
  if(p.includes('page')||p.includes('Page')){
    showPanel('chat');
    await capturePage().catch(()=>{ send(p); });
  } else if(p.includes('selected')||p.includes('selection')||p.includes('Selected')){
    showPanel('chat');
    await sendSel().catch(()=>{ send(p); });
  } else {
    showPanel('chat'); send(p);
  }
}));

['chip-page','ia-page'].forEach(id=>$(id)?.addEventListener('click',capturePage));
['chip-sel','ia-sel'].forEach(id=>$(id)?.addEventListener('click',sendSel));
['chip-shot','ia-shot'].forEach(id=>$(id)?.addEventListener('click',doScreenshot));

// ── Image attach ──
$('ia-img').addEventListener('click',()=>$('file-input').click());
$('file-input').addEventListener('change',e=>{ Array.from(e.target.files).forEach(f=>attachFile(f)); e.target.value=''; });
$('img-remove').addEventListener('click',clearAttach);

// Paste image
document.addEventListener('paste',e=>{
  const items=Array.from(e.clipboardData?.items||[]).filter(i=>i.type.startsWith('image/'));
  if(items.length){ e.preventDefault(); items.forEach(i=>attachFile(i.getAsFile())); }
});

// Drag & drop image onto input box
const dropZone=$('input-box');
dropZone.addEventListener('dragover',e=>{e.preventDefault();dropZone.classList.add('drag-over');});
dropZone.addEventListener('dragleave',()=>dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop',e=>{
  e.preventDefault(); dropZone.classList.remove('drag-over');
  Array.from(e.dataTransfer.files).filter(f=>f.type.startsWith('image/')).forEach(f=>attachFile(f));
});

function attachFile(file) {
  const reader=new FileReader();
  reader.onload=ev=>{
    attachedImages.push({dataUrl:ev.target.result,name:file.name||'image.png',mimeType:file.type||'image/png'});
    renderAttachStrip();
    toast('🖼️ Image attached');
  };
  reader.readAsDataURL(file);
}
function renderAttachStrip() {
  const strip=$('img-preview');
  if(!attachedImages.length){ strip.style.display='none'; return; }
  const container=strip.querySelector('#img-thumbs');
  container.innerHTML='';
  attachedImages.forEach((img,i)=>{
    const wrap=document.createElement('div'); wrap.style.cssText='position:relative;display:inline-block;';
    const thumb=document.createElement('img'); thumb.src=img.dataUrl;
    thumb.style.cssText='height:48px;border-radius:6px;border:1px solid var(--border);';
    const rm=document.createElement('button'); rm.textContent='✕';
    rm.style.cssText='position:absolute;top:-5px;right:-5px;background:var(--bg-secondary);border:1px solid var(--border);color:var(--red);border-radius:50%;width:16px;height:16px;font-size:10px;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;line-height:1;';
    rm.onclick=()=>{ attachedImages.splice(i,1); renderAttachStrip(); };
    wrap.appendChild(thumb); wrap.appendChild(rm); container.appendChild(wrap);
  });
  strip.style.display='block';
}
function clearAttach(){
  attachedImages=[];
  renderAttachStrip();
}

// ── Export conversation ──
$('chip-export').addEventListener('click',exportChat);
function exportChat(){
  const msgs=messagesEl.querySelectorAll('.msg-group');
  if(!msgs.length){toast('⚠️ No messages to export');return;}
  let md=`# Priv8Agent Chat — ${new Date().toLocaleDateString()}\n\n`;
  msgs.forEach(g=>{
    const role=g.classList.contains('user')?'**You**':'**Priv8Agent**';
    const content=g.querySelector('.bubble')?.innerText?.trim()||'';
    if(content) md+=`${role}:\n${content}\n\n---\n\n`;
  });
  const blob=new Blob([md],{type:'text/markdown'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url; a.download=`priv8agent-chat-${Date.now()}.md`;
  a.click(); URL.revokeObjectURL(url);
  toast('✅ Exported as Markdown');
}

// ── Search in messages ──
$('chip-search').addEventListener('click',toggleSearch);
$('search-close').addEventListener('click',closeSearch);
$('search-input').addEventListener('input',runSearch);
$('search-next').addEventListener('click',()=>moveSearch(1));
$('search-prev').addEventListener('click',()=>moveSearch(-1));
$('search-input').addEventListener('keydown',e=>{
  if(e.key==='Enter'){e.shiftKey?moveSearch(-1):moveSearch(1);}
  if(e.key==='Escape') closeSearch();
});

function toggleSearch(){
  const bar=$('search-bar');
  if(bar.style.display==='none'){bar.style.display='block';$('search-input').focus();}
  else closeSearch();
}
function closeSearch(){
  $('search-bar').style.display='none';
  $('search-input').value='';
  clearHighlights(); searchMatches=[]; searchIdx=-1; $('search-count').textContent='';
}
function clearHighlights(){
  messagesEl.querySelectorAll('.search-hit').forEach(el=>{
    el.replaceWith(document.createTextNode(el.textContent));
  });
  // normalize text nodes
  messagesEl.querySelectorAll('.bubble').forEach(b=>b.normalize());
}
function runSearch(){
  clearHighlights(); searchMatches=[]; searchIdx=-1;
  const q=$('search-input').value.trim();
  if(q.length<2){$('search-count').textContent='';return;}
  const re=new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'gi');
  messagesEl.querySelectorAll('.bubble').forEach(bubble=>{
    const walker=document.createTreeWalker(bubble,NodeFilter.SHOW_TEXT);
    const nodes=[];
    while(walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(node=>{
      const txt=node.textContent;
      if(!re.test(txt)) return;
      re.lastIndex=0;
      const frag=document.createDocumentFragment();
      let last=0, m;
      while((m=re.exec(txt))!==null){
        if(m.index>last) frag.appendChild(document.createTextNode(txt.slice(last,m.index)));
        const span=document.createElement('mark');
        span.className='search-hit'; span.textContent=m[0];
        frag.appendChild(span); searchMatches.push(span); last=re.lastIndex;
      }
      if(last<txt.length) frag.appendChild(document.createTextNode(txt.slice(last)));
      node.replaceWith(frag);
    });
  });
  $('search-count').textContent=searchMatches.length?`1/${searchMatches.length}`:'0 results';
  if(searchMatches.length){searchIdx=0;highlightCurrent();}
}
function moveSearch(dir){
  if(!searchMatches.length) return;
  searchMatches[searchIdx]?.classList.remove('current');
  searchIdx=(searchIdx+dir+searchMatches.length)%searchMatches.length;
  highlightCurrent();
}
function highlightCurrent(){
  const el=searchMatches[searchIdx]; if(!el) return;
  el.classList.add('current');
  el.scrollIntoView({block:'center',behavior:'smooth'});
  $('search-count').textContent=`${searchIdx+1}/${searchMatches.length}`;
}

$('model-select').addEventListener('change',e=>{
  model=e.target.value;
  chrome.storage.local.set({defaultModel:model});
  $('s-model').value=model;
});

$('btn-save').addEventListener('click',async()=>{
  const t=$('s-token').value.trim(),srv=$('s-server').value.trim(),m=$('s-model').value;
  const sp=$('s-system').value.trim(), lang=$('s-lang').value;
  const q=$('quality-select').value;
  if(t)token=t; if(m)model=m; systemPrompt=sp; forceLang=lang; quality=q;
  await chrome.storage.local.set({authToken:t||token,serverUrl:srv||API,defaultModel:m,systemPrompt:sp,forceLang:lang,quality:q});
  toast('✅ Settings saved'); showPanel('chat');
  if(t&&!ws)boot();
});
$('btn-logout').addEventListener('click',async()=>{
  token=''; await chrome.storage.local.remove(['authToken','lastSession']);
  if(ws)ws.close(); ws=null;
  showPanel('chat'); authScreen.classList.add('visible');
  statusPill.className=''; statusText.textContent='Offline';
});

chrome.runtime.onMessage.addListener(msg=>{
  if(msg.type==='PENDING_PROMPT'&&msg.text){showPanel('chat');send(msg.text);}
});

setInterval(()=>{if(ws?.readyState===1)ws.send(JSON.stringify({type:'ping'}));},25000);

// ─── Mode Tabs ───
document.querySelectorAll('.mode-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    currentMode = btn.dataset.mode;
    document.querySelectorAll('.mode-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    if(currentMode === 'artifacts') {
      $('input-box').classList.remove('code-mode');
      showPanel('chat');
      $('artifacts-panel').style.display = 'flex';
      $('chat-panel').style.display = 'none';
      loadArtifacts();
    } else {
      $('artifacts-panel').style.display = 'none';
      showPanel('chat');
      if(currentMode === 'code') {
        chatInput.placeholder = 'Write code with Priv8Agent… (describe what to build)';
        $('input-box').classList.add('code-mode');
      } else {
        chatInput.placeholder = 'Message Priv8Agent… (paste image or drop file)';
        $('input-box').classList.remove('code-mode');
      }
    }
  });
});

// ─── Quality selector ───
$('quality-select').addEventListener('change', e => {
  quality = e.target.value;
  chrome.storage.local.set({ quality });
});

// ─── Incognito mode ───
// ─── Computer Use toggle ───
let computerUseActive = false;
const btnCU = $('btn-computer-use');
if (btnCU) {
  // Check saved state
  chrome.storage.local.get(['computerUseActive'], (r) => {
    computerUseActive = !!r.computerUseActive;
    btnCU.classList.toggle('active', computerUseActive);
    btnCU.title = computerUseActive ? '🖥️ Computer Use ON — agent controls this tab (click to stop)' : '🖥️ Computer Use — let agent control this browser tab';
  });
  btnCU.addEventListener('click', () => {
    computerUseActive = !computerUseActive;
    btnCU.classList.toggle('active', computerUseActive);
    chrome.runtime.sendMessage({ type: computerUseActive ? 'COMPUTER_USE_START' : 'COMPUTER_USE_STOP' });
    if (computerUseActive) {
      toast('🖥️ Computer Use ON — agent can now see and control this tab');
      btnCU.title = '🖥️ Computer Use ON — click to stop';
    } else {
      toast('🖥️ Computer Use OFF');
      btnCU.title = '🖥️ Computer Use — let agent control this browser tab';
    }
  });
}

$('btn-incognito').addEventListener('click', () => {
  incognito = !incognito;
  $('btn-incognito').classList.toggle('active', incognito);
  $('incognito-badge').classList.toggle('on', incognito);
  if(incognito) {
    toast('🕶 Incognito ON — chat won\'t be saved');
    newChat();
  } else {
    toast('Incognito OFF');
  }
});

// ─── Global search ───
$('btn-search-global').addEventListener('click', () => {
  const open = $('global-search').classList.contains('visible');
  if(open) { $('global-search').classList.remove('visible'); showPanel('chat'); }
  else { showPanel('search-global'); $('gs-input').focus(); }
});
$('gs-input').addEventListener('input', debounce(runGlobalSearch, 300));
$('gs-input').addEventListener('keydown', e => { if(e.key==='Escape'){ $('global-search').classList.remove('visible'); showPanel('chat'); }});

function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

async function runGlobalSearch() {
  const q = $('gs-input').value.trim();
  const el = $('gs-results'); el.innerHTML = '';
  if(q.length < 2) return;
  try {
    const r = await fetch(`${API}/api/agent/sessions?search=${encodeURIComponent(q)}`, { headers: { Authorization: `Bearer ${token}` } });
    if(!r.ok) return;
    const list = await r.json();
    if(!list.length) { el.innerHTML = '<div style="padding:16px;text-align:center;color:var(--text-muted);font-size:12px;">No results</div>'; return; }
    list.slice(0, 30).forEach(s => {
      const d = document.createElement('div'); d.className = 'gs-item';
      const snippet = (s.lastMessage || s.title || '').slice(0, 80);
      const hi = (t) => t.replace(new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'), 'gi'), m => `<span class="gs-hit">${esc(m)}</span>`);
      d.innerHTML = `<div class="gs-title">${hi(esc(s.title||'Conversation'))}</div><div class="gs-snippet">${hi(esc(snippet))}</div>`;
      d.onclick = () => { switchSession(s.id); $('global-search').classList.remove('visible'); showPanel('chat'); };
      el.appendChild(d);
    });
  } catch { el.innerHTML = '<div style="padding:16px;text-align:center;color:var(--text-muted);font-size:12px;">Search unavailable</div>'; }
}

// ─── Artifacts gallery — split pane ───
let _artifactsList = [];
async function loadArtifacts() {
  const el = $('artifacts-list');
  el.innerHTML = '<div style="color:var(--text-muted);font-size:11px;padding:8px;">Loading…</div>';
  $('artifact-preview-toolbar').style.display = 'none';
  $('artifact-preview-body').innerHTML = '<div style="color:var(--text-muted);font-size:12px;padding:16px;text-align:center;">Select an artifact</div>';
  try {
    const r = await fetch(`${API}/api/agent/artifacts`, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) { el.innerHTML = '<div style="color:var(--text-muted);font-size:11px;padding:8px;">No artifacts yet</div>'; return; }
    _artifactsList = await r.json();
    renderArtifactList();
    if (_artifactsList.length) showArtifactPreview(_artifactsList[0]);
  } catch { el.innerHTML = '<div style="color:var(--text-muted);font-size:11px;padding:8px;">Could not load</div>'; }
}
function renderArtifactList() {
  const el = $('artifacts-list'); el.innerHTML = '';
  if (!_artifactsList.length) {
    el.innerHTML = '<div style="color:var(--text-muted);font-size:11px;padding:8px;line-height:1.5;">No artifacts yet.<br>AI-generated code/HTML will appear here.</div>';
    return;
  }
  _artifactsList.forEach((a, i) => {
    const d = document.createElement('div');
    d.dataset.idx = i;
    d.style.cssText = 'padding:6px 8px;border-radius:4px;cursor:pointer;font-size:11px;border:1px solid transparent;transition:all .12s;';
    const icon = a.type === 'html' ? '🌐' : a.type === 'js' ? '📜' : '📄';
    d.innerHTML = `<div style="font-weight:600;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${icon} ${esc(a.title||'Artifact')}</div><div style="color:var(--text-muted);font-size:10px;margin-top:1px;">${esc(a.type||'code')}</div>`;
    d.onclick = () => { el.querySelectorAll('[data-idx]').forEach(x=>x.style.background=''); d.style.background='var(--accent-dim)'; d.style.borderColor='rgba(0,255,65,.2)'; showArtifactPreview(a); };
    d.onmouseenter = () => { if(d.style.background!=='var(--accent-dim)') d.style.background='var(--bg-secondary)'; };
    d.onmouseleave = () => { if(d.style.background!=='var(--accent-dim)') d.style.background=''; };
    el.appendChild(d);
  });
}
async function showArtifactPreview(a) {
  const toolbar = $('artifact-preview-toolbar'), body = $('artifact-preview-body'), title = $('artifact-preview-title');
  title.textContent = a.title || 'Artifact';
  toolbar.style.display = 'flex';
  body.innerHTML = '<div style="color:var(--text-muted);font-size:12px;padding:16px;text-align:center;">Loading…</div>';
  let content = a.content || '';
  if (!content && a.id) {
    try {
      const r = await fetch(`${API}/api/agent/artifacts/${a.id}/content`, { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) content = (await r.json()).content || '';
    } catch {}
  }
  if (!content) { body.innerHTML = '<div style="color:var(--text-muted);font-size:12px;padding:16px;text-align:center;">No content</div>'; return; }
  if (a.type === 'html') {
    const fr = document.createElement('iframe');
    fr.style.cssText = 'width:100%;height:100%;border:none;background:#fff;';
    fr.sandbox = 'allow-scripts allow-same-origin';
    body.innerHTML = '';
    body.style.padding = '0';
    body.appendChild(fr);
    fr.srcdoc = content;
  } else {
    body.style.padding = '12px';
    body.innerHTML = `<pre style="font-size:11px;line-height:1.5;color:var(--text-primary);white-space:pre-wrap;word-break:break-all;margin:0;font-family:monospace;">${esc(content)}</pre>`;
  }
  $('btn-artifact-copy').onclick = () => { navigator.clipboard.writeText(content).then(() => showToast('Copied!')); };
  $('btn-artifact-tab').onclick = () => {
    const blob = new Blob([content], { type: a.type === 'html' ? 'text/html' : 'text/plain' });
    const url = URL.createObjectURL(blob);
    chrome.tabs.create({ url });
  };
}

// ─── Projects ───
const PROJECT_COLORS = ['#00FF41','#60a5fa','#f472b6','#fb923c','#a78bfa'];
function renderProjectsBar() {
  const bar = $('projects-bar'); if (!bar) return;
  bar.innerHTML = '';
  const allBtn = document.createElement('button');
  allBtn.textContent = 'All';
  allBtn.style.cssText = `font-size:10px;padding:2px 8px;border-radius:10px;cursor:pointer;border:1px solid var(--border);background:${activeProjectFilter===null?'var(--accent-dim)':'transparent'};color:${activeProjectFilter===null?'var(--accent)':'var(--text-muted)'};font-family:inherit;`;
  allBtn.onclick = () => { activeProjectFilter = null; renderProjectsBar(); loadSessions(); };
  bar.appendChild(allBtn);
  projects.forEach(p => {
    const btn = document.createElement('button');
    btn.textContent = p.name;
    const active = activeProjectFilter === p.id;
    btn.style.cssText = `font-size:10px;padding:2px 8px;border-radius:10px;cursor:pointer;border:1px solid ${p.color};background:${active?p.color+'22':'transparent'};color:${active?p.color:'var(--text-muted)'};font-family:inherit;`;
    btn.onclick = () => { activeProjectFilter = p.id; renderProjectsBar(); loadSessions(); };
    btn.oncontextmenu = e => { e.preventDefault(); if(confirm(`Delete project "${p.name}"?`)) { projects = projects.filter(x=>x.id!==p.id); saveProjects(); if(activeProjectFilter===p.id) activeProjectFilter=null; renderProjectsBar(); loadSessions(); } };
    bar.appendChild(btn);
  });
  const addBtn = document.createElement('button');
  addBtn.textContent = '+';
  addBtn.title = 'New project';
  addBtn.style.cssText = 'font-size:10px;padding:2px 7px;border-radius:10px;cursor:pointer;border:1px solid var(--border);background:transparent;color:var(--text-muted);font-family:inherit;';
  addBtn.onclick = () => {
    const name = prompt('Project name:');
    if (!name || !name.trim()) return;
    const id = 'p8proj_' + Date.now();
    const color = PROJECT_COLORS[projects.length % PROJECT_COLORS.length];
    projects.push({ id, name: name.trim(), color, sessionIds: [] });
    saveProjects();
    renderProjectsBar();
  };
  bar.appendChild(addBtn);
}
function saveProjects() { chrome.storage.local.set({ p8Projects: projects }); }
function filterSessionsByProject(sessions) {
  if (!activeProjectFilter) return sessions;
  const p = projects.find(x => x.id === activeProjectFilter);
  if (!p) return sessions;
  return sessions.filter(s => p.sessionIds.includes(s.id));
}

// ─── Plus menu ───
const plusMenu = $('plus-menu');
$('ia-plus').addEventListener('click', (e) => { e.stopPropagation(); plusMenu.classList.toggle('open'); });
document.addEventListener('click', () => plusMenu.classList.remove('open'));
plusMenu.addEventListener('click', e => e.stopPropagation());
$('pm-file').addEventListener('click', () => { $('file-input').click(); plusMenu.classList.remove('open'); });
$('pm-shot').addEventListener('click', () => { doScreenshot(); plusMenu.classList.remove('open'); });
$('pm-page').addEventListener('click', () => { capturePage(); plusMenu.classList.remove('open'); });
$('pm-sel').addEventListener('click', () => { sendSel(); plusMenu.classList.remove('open'); });
$('pm-export').addEventListener('click', () => { exportChat(); plusMenu.classList.remove('open'); });

// ─── Template chips ───
const tplPrompts = {
  write: 'Help me write: ',
  code: 'Write code that ',
  learn: 'Explain to me: ',
  analyze: 'Analyze this: ',
  translate: 'Translate this to English: ',
  summarize: 'Summarize this page for me',
};
document.querySelectorAll('.t-chip').forEach(btn => {
  btn.addEventListener('click', async () => {
    const tpl = tplPrompts[btn.dataset.tpl] || '';
    if(btn.dataset.tpl === 'summarize') { await capturePage().catch(() => send(tpl)); return; }
    chatInput.value = tpl;
    chatInput.focus();
    chatInput.setSelectionRange(tpl.length, tpl.length);
    resize();
  });
});

// ─── Voice Input ───
let mediaRecorder = null, audioChunks = [], recognition = null;
const voiceBtn = $('ia-voice');

function startVoice() {
  // Prefer Web Speech API (no server needed)
  if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = ''; // use browser/OS default language
    let final = '';
    recognition.onstart = () => { voiceBtn.classList.add('recording'); voiceBtn.title='🔴 Recording…'; };
    recognition.onresult = e => {
      let interim = '';
      for(let i=e.resultIndex;i<e.results.length;i++){
        if(e.results[i].isFinal) final+=e.results[i][0].transcript;
        else interim=e.results[i][0].transcript;
      }
      chatInput.value = final + interim;
      resize();
    };
    recognition.onend = () => {
      voiceBtn.classList.remove('recording'); voiceBtn.title='Voice input';
      chatInput.focus();
    };
    recognition.onerror = e => {
      voiceBtn.classList.remove('recording');
      toast('⚠️ Voice error: '+e.error);
    };
    recognition.start();
  } else {
    toast('⚠️ Voice not supported in this browser');
  }
}
function stopVoice() {
  if(recognition){ recognition.stop(); recognition=null; }
}

voiceBtn.addEventListener('mousedown', e => { e.preventDefault(); startVoice(); });
voiceBtn.addEventListener('mouseup', stopVoice);
voiceBtn.addEventListener('mouseleave', stopVoice);
voiceBtn.addEventListener('touchstart', e => { e.preventDefault(); startVoice(); });
voiceBtn.addEventListener('touchend', stopVoice);
// Also support click-to-toggle
voiceBtn.addEventListener('click', () => {
  if(voiceBtn.classList.contains('recording')){ stopVoice(); }
  else { startVoice(); }
});

// ─── Insert AI response into active page input ───
// Add "Insert" button to each AI message on long-press / right-click
function addInsertBtn(bubble) {
  const btn = document.createElement('button');
  btn.textContent = '⌨️ Insert';
  btn.style.cssText = 'display:inline-block;margin-top:6px;background:none;border:1px solid var(--border);color:var(--text-muted);padding:2px 8px;border-radius:5px;font-size:10px;cursor:pointer;font-family:inherit;transition:all .15s;';
  btn.title = 'Insert this text into the active input on the page';
  btn.onmouseenter = () => { btn.style.borderColor='var(--accent)'; btn.style.color='var(--accent)'; };
  btn.onmouseleave = () => { btn.style.borderColor='var(--border)'; btn.style.color='var(--text-muted)'; };
  btn.onclick = async () => {
    const text = bubble.innerText.replace(/^Copy\n/,'').replace(/\n?Copy$/,'').trim();
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if(!tab?.id){ toast('⚠️ No active tab'); return; }
    const r = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (t) => {
        const el = document.activeElement;
        if(el && (el.tagName==='INPUT'||el.tagName==='TEXTAREA'||el.isContentEditable)){
          if(el.isContentEditable){ el.innerText += t; }
          else { const s=el.selectionStart||0; el.value=el.value.slice(0,s)+t+el.value.slice(el.selectionEnd||s); el.selectionStart=el.selectionEnd=s+t.length; el.dispatchEvent(new Event('input',{bubbles:true})); }
          return true;
        }
        return false;
      },
      args: [text]
    });
    toast(r?.[0]?.result ? '✅ Inserted into page' : '⚠️ Click on an input field first');
  };
  bubble.appendChild(btn);
}


// Insert btn on history AI messages (loaded from API)
function patchAiBubbles() {
  messagesEl.querySelectorAll('.msg-group.ai .bubble').forEach(b => {
    if(!b.querySelector('button[title*="Insert"]')) addInsertBtn(b);
  });
}

// ─── Keyboard shortcuts ───
document.addEventListener('keydown', e => {
  if((e.ctrlKey||e.metaKey) && e.shiftKey && e.key.toLowerCase()==='f'){ e.preventDefault(); toggleSearch(); }
  if((e.ctrlKey||e.metaKey) && e.shiftKey && e.key.toLowerCase()==='e'){ e.preventDefault(); exportChat(); }
  // Ctrl+K = global search
  if((e.ctrlKey||e.metaKey) && !e.shiftKey && e.key.toLowerCase()==='k'){
    e.preventDefault();
    const open=$('global-search').classList.contains('visible');
    if(open){$('global-search').classList.remove('visible');showPanel('chat');}
    else{showPanel('search-global');$('gs-input').focus();}
  }
  // Escape = close any overlay
  if(e.key==='Escape'){
    if($('global-search').classList.contains('visible')){$('global-search').classList.remove('visible');showPanel('chat');}
    else if($('search-bar').style.display!=='none') closeSearch();
    else if($('plus-menu').classList.contains('open')) $('plus-menu').classList.remove('open');
  }
});

// Expose internals for CDP/debug access
window.__p8 = { get token(){return token;}, set token(v){token=v;}, connectWs, boot, send, newChat, showPanel, init };

// ── Claude Code Bridge (WebSocket on localhost:9334) ────────────────────────
(function startClaudeBridge() {
  let _bws = null;
  function connectBridge() {
    try {
      _bws = new WebSocket('ws://localhost:9334');
      _bws.onopen = () => _bws.send(JSON.stringify({type:'ready'}));
      _bws.onmessage = async (e) => {
        let cmd;
        try { cmd = JSON.parse(e.data); } catch { return; }
        let result = 'ok';
        try {
          if (cmd.type === 'set_token') {
            await chrome.storage.local.set({authToken: cmd.token, computerUseActive: true});
            token = cmd.token;
            if (!authScreen.classList.contains('visible') || true) { authScreen.classList.remove('visible'); }
            boot();
            result = 'token_set';
          } else if (cmd.type === 'get_token') {
            result = token || '';
          } else if (cmd.type === 'ping') {
            result = 'pong';
          } else if (cmd.type === 'reload') {
            chrome.runtime.reload();
            result = 'reloading';
          } else if (cmd.type === 'set_storage') {
            await chrome.storage.local.set(cmd.data || {});
          } else if (cmd.type === 'get_storage') {
            result = await chrome.storage.local.get(cmd.keys || null);
          } else if (cmd.type === 'send_msg') {
            chatInput.value = cmd.text || '';
            send();
          } else if (cmd.type === 'computer_tick') {
            // Take screenshot from sidepanel context (captures the main tab, not chrome:// pages)
            // then poll and execute commands
            try {
              const activeTabs = await new Promise(r => chrome.tabs.query({active:true, currentWindow:true}, r));
              const aTab = activeTabs?.[0];
              if (aTab && !aTab.url?.startsWith('chrome://') && !aTab.url?.startsWith('chrome-extension://')) {
                let dataUrl = null;
                try {
                  dataUrl = await new Promise((res, rej) => {
                    chrome.tabs.captureVisibleTab(null, {format:'jpeg', quality:60}, d => {
                      chrome.runtime.lastError ? rej(chrome.runtime.lastError) : res(d);
                    });
                  });
                } catch(_captureErr) { /* screenshot failed, proceed without it */ }
                if (token) {
                  if (dataUrl) {
                    await fetch(API + '/api/agent/computer/screenshot', {
                      method:'POST',
                      headers:{'Content-Type':'application/json', Authorization:'Bearer '+token},
                      body: JSON.stringify({dataUrl, width:aTab.width||1280, height:aTab.height||720, url:aTab.url}),
                    }).catch(()=>{});
                  }
                  // Poll + execute
                  const pr = await fetch(API + '/api/agent/computer/poll?token='+encodeURIComponent(token)).catch(()=>null);
                  if (pr?.ok) {
                    const pd = await pr.json().catch(()=>({commands:[]}));
                    for (const c of (pd.commands||[])) {
                      try {
                        const res2 = await new Promise(r => chrome.tabs.sendMessage(aTab.id, {type:'COMPUTER_COMMAND', commandId:c.id, action:c.action, params:c.params}, r));
                        await fetch(API+'/api/agent/computer/result',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({commandId:c.id,result:res2?.result||'ok'})}).catch(()=>{});
                      } catch(e2) {
                        await fetch(API+'/api/agent/computer/result',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({commandId:c.id,result:'error:'+e2.message})}).catch(()=>{});
                      }
                    }
                    result = 'tick_done:'+aTab.url;
                  }
                }
              } else {
                result = 'skip:tab='+aTab?.url?.slice(0,30);
              }
            } catch(tickErr) { result = 'tick_error:'+tickErr.message; }
            if (result === 'ok') result = 'tick_no_action';
          } else if (cmd.type === 'get_tabs') {
            result = await new Promise(resolve => chrome.tabs.query({currentWindow:true}, ts => resolve(ts.map(t => ({id:t.id, url:t.url, active:t.active, title:t.title})))));
          } else if (cmd.type === 'activate_tab' && cmd.tabId) {
            await new Promise(r => chrome.tabs.update(cmd.tabId, {active:true}, r));
            result = 'activated:' + cmd.tabId;
          }
        } catch(err) { result = 'error: ' + err.message; }
        _bws.send(JSON.stringify({type:'result', id:cmd.id, result}));
      };
      _bws.onclose = () => { _bws = null; setTimeout(connectBridge, 5000); };
      _bws.onerror = () => { _bws = null; };
    } catch(e) { setTimeout(connectBridge, 5000); }
  }
  connectBridge();
})();

// ── Computer Use Direct Loop (sidepanel-driven) ────────────────────────────
// Every 1.5s, sidepanel takes screenshot directly and sends to backend.
// This bypasses background.js service worker sleep issues.
(function startComputerUseDirect() {
  let _running = false;
  setInterval(async () => {
    if (!token || _running) return;
    _running = true;
    try {
      const activeTabs = await new Promise(r => chrome.tabs.query({active:true, currentWindow:true}, r));
      const aTab = activeTabs?.[0];
      if (!aTab || aTab.url?.startsWith('chrome://') || aTab.url?.startsWith('chrome-extension://')) {
        _running = false; return;
      }
      // Try screenshot — if it fails (e.g. image readback failed), continue anyway to still execute commands
      let dataUrl = null;
      try {
        dataUrl = await new Promise((res, rej) => {
          chrome.tabs.captureVisibleTab(null, {format:'jpeg', quality:55}, d => {
            chrome.runtime.lastError ? rej(chrome.runtime.lastError) : res(d);
          });
        });
      } catch(_captureErr) { /* screenshot failed, proceed without it */ }
      if (dataUrl) {
        await fetch(API + '/api/agent/computer/screenshot', {
          method:'POST',
          headers:{'Content-Type':'application/json', Authorization:'Bearer '+token},
          body: JSON.stringify({dataUrl, width:aTab.width||1280, height:aTab.height||720, url:aTab.url}),
        }).catch(()=>{});
      }
      // Auto-inject content script if not loaded (happens after extension reload)
      let _contentScriptReady = false;
      try {
        const pingRes = await new Promise((res, rej) => chrome.tabs.sendMessage(aTab.id, {type:'PING'}, r => {
          chrome.runtime.lastError ? rej(chrome.runtime.lastError) : res(r);
        }));
        _contentScriptReady = pingRes?.ok === true;
      } catch(_) {
        // Content script not responding — inject it
        try {
          await chrome.scripting.executeScript({ target: { tabId: aTab.id }, files: ['content.js'] });
          await new Promise(r => setTimeout(r, 400));
          _contentScriptReady = true;
        } catch(injectErr) {
          // inject failed — log to backend for debugging
          if (token) {
            fetch(API+'/api/agent/computer/result', {method:'POST', headers:{'Content-Type':'application/json', Authorization:'Bearer '+token}, body: JSON.stringify({commandId:'__inject_err', result:'inject_failed:'+injectErr.message+' tab:'+aTab.url.slice(0,60)})}).catch(()=>{});
          }
        }
      }

      const pr = await fetch(API+'/api/agent/computer/poll?token='+encodeURIComponent(token)).catch(()=>null);
      if (pr?.ok) {
        const pd = await pr.json().catch(()=>({commands:[]}));
        for (const c of (pd.commands||[])) {
          let cmdResult = null;
          try {
            // navigate can use chrome.tabs.update directly — no content script needed
            if (c.action === 'navigate' && c.params?.url) {
              await new Promise(r => chrome.tabs.update(aTab.id, {url: c.params.url}, r));
              cmdResult = 'navigating to ' + c.params.url;
            } else {
              const r2 = await new Promise(r => chrome.tabs.sendMessage(aTab.id, {type:'COMPUTER_COMMAND',commandId:c.id,action:c.action,params:c.params}, r));
              cmdResult = r2?.result || 'ok';
            }
          } catch(e) {
            cmdResult = 'error:' + e.message;
          }
          await fetch(API+'/api/agent/computer/result',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({commandId:c.id,result:cmdResult})}).catch(()=>{});
        }
      }
    } catch(e) {}
    _running = false;
  }, 1500);
})();

init(); showPanel('chat');

