
const API = 'https://app.privatehash.online';
const WS_PATH = '/agent/ws'; // Nginx proxies /agent/ws → backend /ws (bypasses Cloudflare WS block)
let token = '', ws = null, sessionId = null, streaming = false, buf = '', pendingMsg = null, model = '', reconnects = 0, reconnTimer = null;
let systemPrompt = '', forceLang = '';
let attachedImage = null; // { dataUrl, name, mimeType }
let searchMatches = [], searchIdx = -1;

const $= id => document.getElementById(id);
const authScreen=$('auth-screen'), statusPill=$('status-pill'), statusText=$('status-text');
const messagesEl=$('messages'), welcomeEl=$('welcome'), chatInput=$('chat-input');
const btnSend=$('btn-send'), btnStop=$('btn-stop');

// ─── Init ───
async function init() {
  const s = await chrome.storage.local.get(['authToken','serverUrl','defaultModel','systemPrompt','forceLang']);
  token = s.authToken || '';
  model = s.defaultModel || '';
  systemPrompt = s.systemPrompt || '';
  forceLang = s.forceLang || '';
  if (s.defaultModel) { $('model-select').value = s.defaultModel; $('s-model').value = s.defaultModel; }
  if (s.serverUrl) $('s-server').value = s.serverUrl;
  if (s.systemPrompt) $('s-system').value = s.systemPrompt;
  if (s.forceLang) $('s-lang').value = s.forceLang;
  if (!token) { authScreen.classList.add('visible'); return; }
  boot();
}

// ─── Boot ───
async function boot() {
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
  ws.onclose = () => { statusPill.className=''; statusText.textContent='Offline'; scheduleRecon(); };
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
    const r = await fetch(`${API}/api/agent/sessions`,{headers:{Authorization:`Bearer ${token}`}});
    if(!r.ok) return;
    const list = await r.json();
    const el = $('sessions-list'); el.innerHTML='';
    list.slice(0,40).forEach(s => {
      const d=document.createElement('div'); d.className='session-item'+(s.id===sessionId?' current':'');
      d.innerHTML=`<div class="si-title">${esc(s.title||'Conversation')}</div><div class="si-meta">${s.messageCount||0} messages</div>`;
      d.onclick=()=>switchSession(s.id);
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
      msgs.forEach(m=>{ if(m.role==='user') addMsg('user',m.content||'',false); else if(m.role==='assistant') addMsg('ai',m.content||'',false); });
      scrollBot(); patchAiBubbles();
    }
  } catch {}
}
function newChat() {
  sessionId=null; chrome.storage.local.remove('lastSession');
  messagesEl.innerHTML=''; messagesEl.style.display='none'; welcomeEl.style.display='flex';
  if(ws?.readyState===1) ws.send(JSON.stringify({type:'hello'}));
  showPanel('chat');
}

// ─── Messaging ───
function send(content) {
  if((!content.trim()&&!attachedImage)||streaming) return;
  if(!token){authScreen.classList.add('visible');return;}
  if(!ws||ws.readyState!==1){connectWs();setTimeout(()=>send(content),600);return;}

  // Build message payload
  // Build effective content — prepend lang instruction if set
  let effectiveContent = content.trim();
  if(forceLang && !sessionId) {
    const langNames = {ar:'Arabic',en:'English',fr:'French',de:'German',es:'Spanish'};
    effectiveContent = (effectiveContent ? effectiveContent + '\n\n' : '') + `[Please reply in ${langNames[forceLang]||forceLang}]`;
  }
  const payload = {
    type:'user_message',
    content: effectiveContent || content.trim(),
    ...(sessionId?{sessionId}:{}),
    ...(model?{model}:{}),
    ...(systemPrompt&&!sessionId?{systemPrompt}:{})
  };

  // Attach image if present
  if(attachedImage) {
    payload.image = attachedImage.dataUrl;
    payload.imageName = attachedImage.name;
    // Show image preview in user bubble
    const g=document.createElement('div'); g.className='msg-group user';
    g.innerHTML=`<div class="msg-sender">You<div class="sender-avatar">👤</div></div><div class="bubble"><img src="${esc(attachedImage.dataUrl)}" style="max-width:100%;border-radius:8px;max-height:160px;display:block;margin-bottom:4px"/>${content.trim()?`<span>${esc(content.trim())}</span>`:''}</div>`;
    welcomeEl.style.display='none'; messagesEl.style.display='flex';
    messagesEl.appendChild(g); scrollBot();
    clearAttach();
  } else {
    addMsg('user',content);
    welcomeEl.style.display='none'; messagesEl.style.display='flex';
  }

  ws.send(JSON.stringify(payload));
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
function showThink(t) {
  if(!pendingMsg) startAi();
  pendingMsg.querySelector('.bubble').innerHTML=`<span style="color:var(--text-muted);font-size:12px;font-style:italic">💭 ${esc(t.substring(0,120))}…</span>`;
}
function finishAi() {
  if(pendingMsg){
    const b=pendingMsg.querySelector('.bubble');
    if(buf){b.innerHTML=renderMd(buf);addCopyBtns(b);addInsertBtn(b);}
    else pendingMsg.remove();
    pendingMsg=null; buf='';
  }
  streaming=false; btnSend.disabled=false; btnStop.classList.remove('show'); scrollBot(); loadSessions();
}
function addMsg(role,content,scroll=true) {
  const g=document.createElement('div'); g.className=`msg-group ${role}`;
  const sender=role==='user'?'You':'Priv8Agent';
  const avatar=role==='user'?'👤':'<svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M5 0.5L9 2.75V7.25L5 9.5L1 7.25V2.75L5 0.5Z" stroke="#00FF41" stroke-width="0.8"/></svg>';
  const b=document.createElement('div'); b.className='bubble';
  if(role==='ai'){b.innerHTML=renderMd(content);addCopyBtns(b);addInsertBtn(b);}
  else b.textContent=content;
  g.innerHTML=`<div class="msg-sender">${role==='user'?`${sender}<div class="sender-avatar">${avatar}</div>`:`<div class="sender-avatar">${avatar}</div>${sender}`}</div>`;
  g.appendChild(b); messagesEl.appendChild(g);
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
  $('chat-panel').style.display='none';
  $('btn-sessions-toggle').classList.remove('active');
  $('btn-settings-toggle').classList.remove('active');
  if(p==='chat'){$('chat-panel').style.display='flex';}
  else if(p==='sessions'){$('sessions-panel').classList.add('visible');$('btn-sessions-toggle').classList.add('active');}
  else if(p==='settings'){$('settings-panel').classList.add('visible');$('btn-settings-toggle').classList.add('active');}
}
function scrollBot(){setTimeout(()=>messagesEl.scrollTop=messagesEl.scrollHeight,10);}
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
$('btn-auth').addEventListener('click',async()=>{
  const t=$('token-input').value.trim(); if(!t)return;
  $('btn-auth').textContent='Verifying…'; $('btn-auth').disabled=true;
  try{const r=await fetch(`${API}/api/auth/me`,{headers:{Authorization:`Bearer ${t}`}});
    if(r.ok){token=t;await chrome.storage.local.set({authToken:t});authScreen.classList.remove('visible');boot();}
    else{$('auth-error').style.display='block';}
  }catch{$('auth-error').style.display='block';}
  $('btn-auth').textContent='Connect →'; $('btn-auth').disabled=false;
});

$('btn-new').addEventListener('click',newChat);
$('btn-sessions-toggle').addEventListener('click',()=>{const open=$('sessions-panel').classList.contains('visible');showPanel(open?'chat':'sessions');if(!open)loadSessions();});
$('btn-settings-toggle').addEventListener('click',()=>{const open=$('settings-panel').classList.contains('visible');showPanel(open?'chat':'settings');if(!open&&token)$('s-token').value=token;});

btnSend.addEventListener('click',()=>{const t=chatInput.value.trim();if(t||attachedImage){send(t||'');chatInput.value='';resize();}});
btnStop.addEventListener('click',()=>{if(ws?.readyState===1&&sessionId)ws.send(JSON.stringify({type:'stop',sessionId}));finishAi();});
chatInput.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();btnSend.click();}});
chatInput.addEventListener('input',resize);
function resize(){chatInput.style.height='auto';chatInput.style.height=Math.min(chatInput.scrollHeight,140)+'px';}

document.querySelectorAll('.sug').forEach(b=>b.addEventListener('click',async()=>{
  const p=b.dataset.prompt; if(!p)return;
  if(p.includes('page')||p.includes('Page')){await capturePage();}
  else{showPanel('chat');send(p);}
}));

['chip-page','ia-page'].forEach(id=>$(id)?.addEventListener('click',capturePage));
['chip-sel','ia-sel'].forEach(id=>$(id)?.addEventListener('click',sendSel));
['chip-shot','ia-shot'].forEach(id=>$(id)?.addEventListener('click',doScreenshot));

// ── Image attach ──
$('ia-img').addEventListener('click',()=>$('file-input').click());
$('file-input').addEventListener('change',e=>{ const f=e.target.files[0]; if(f) attachFile(f); e.target.value=''; });
$('img-remove').addEventListener('click',clearAttach);

// Paste image
document.addEventListener('paste',e=>{
  const item=Array.from(e.clipboardData?.items||[]).find(i=>i.type.startsWith('image/'));
  if(item){ e.preventDefault(); attachFile(item.getAsFile()); }
});

// Drag & drop image onto input box
const dropZone=$('input-box');
dropZone.addEventListener('dragover',e=>{e.preventDefault();dropZone.classList.add('drag-over');});
dropZone.addEventListener('dragleave',()=>dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop',e=>{
  e.preventDefault(); dropZone.classList.remove('drag-over');
  const f=e.dataTransfer.files[0];
  if(f&&f.type.startsWith('image/')) attachFile(f);
});

function attachFile(file) {
  const reader=new FileReader();
  reader.onload=ev=>{
    attachedImage={dataUrl:ev.target.result,name:file.name||'image.png',mimeType:file.type||'image/png'};
    $('img-thumb').src=ev.target.result;
    $('img-name').textContent=file.name||'image.png';
    $('img-preview').style.display='block';
    toast('🖼️ Image attached');
  };
  reader.readAsDataURL(file);
}
function clearAttach(){
  attachedImage=null;
  $('img-preview').style.display='none';
  $('img-thumb').src='';
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

$('model-select').addEventListener('change',e=>{model=e.target.value;chrome.storage.local.set({defaultModel:model});});

$('btn-save').addEventListener('click',async()=>{
  const t=$('s-token').value.trim(),srv=$('s-server').value.trim(),m=$('s-model').value;
  const sp=$('s-system').value.trim(), lang=$('s-lang').value;
  if(t)token=t; if(m)model=m; systemPrompt=sp; forceLang=lang;
  await chrome.storage.local.set({authToken:t||token,serverUrl:srv||API,defaultModel:m,systemPrompt:sp,forceLang:lang});
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
    recognition.lang = 'auto'; // picks up any language
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

// Patch addCopyBtns to also add insert button
const _origAddCopyBtns = addCopyBtns;
window.addCopyBtnsWithInsert = (el) => {
  _origAddCopyBtns(el);
};

// Insert btn on history AI messages (loaded from API)
function patchAiBubbles() {
  messagesEl.querySelectorAll('.msg-group.ai .bubble').forEach(b => {
    if(!b.querySelector('button[title*="Insert"]')) addInsertBtn(b);
  });
}

// ─── Keyboard: Ctrl+Shift+F = search ───
document.addEventListener('keydown', e => {
  if((e.ctrlKey||e.metaKey) && e.shiftKey && e.key==='f'){ e.preventDefault(); toggleSearch(); }
  if((e.ctrlKey||e.metaKey) && e.shiftKey && e.key==='e'){ e.preventDefault(); exportChat(); }
});

// Expose internals for CDP/debug access
window.__p8 = { get token(){return token;}, set token(v){token=v;}, connectWs, boot, send, newChat, showPanel, init };

init(); showPanel('chat');

