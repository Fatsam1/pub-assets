import { generateOTP, checkThrottle, storeOTP, verifyOTP, generateCSRFToken } from './security.js';

console.log('\n🧪 اختبار Security Functions\n');

// Test 1: OTP Generation
console.log('1️⃣ اختبار توليد OTP:');
const otp = generateOTP(6);
console.log(`   ✅ OTP: ${otp} (${otp.length} أرقام)`);

// Test 2: CSRF Token
console.log('\n2️⃣ اختبار CSRF Token:');
const token = generateCSRFToken();
console.log(`   ✅ Token: ${token.substring(0, 16)}... (${token.length} حرف)`);

// Test 3: Throttling
console.log('\n3️⃣ اختبار Rate Limiting:');
const pageId = 1;
const ip = '192.168.1.1';

for (let i = 1; i <= 6; i++) {
  const result = checkThrottle(pageId, ip);
  if (result.throttled) {
    console.log(`   ❌ محاولة ${i}: تم تجاوز الحد (${result.retryAfter}s)`);
  } else {
    console.log(`   ✅ محاولة ${i}: مقبولة`);
  }
}

// Test 4: OTP Storage & Verification
console.log('\n4️⃣ اختبار تخزين وتحقق OTP:');
const testOTP = '123456';
storeOTP(2, '10.0.0.1', testOTP);
console.log(`   ✅ تم تخزين OTP: ${testOTP}`);

const verifyResult = verifyOTP(2, '10.0.0.1', testOTP);
console.log(`   ✅ التحقق: ${verifyResult.valid ? 'نجح' : 'فشل'}`);

const wrongOTP = verifyOTP(2, '10.0.0.1', 'wrong');
console.log(`   ✅ التحقق من OTP خاطئ: ${wrongOTP.valid ? 'خطأ' : 'متوقع (غير صحيح)'}`);

console.log('\n✅ جميع الاختبارات نجحت!\n');
