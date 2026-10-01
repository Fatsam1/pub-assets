import crypto from 'node:crypto';

const OTP_ATTEMPTS = new Map();
const OTP_STORE = new Map();

// DEV ONLY — read OTP for testing (remove in production)
export function getOTPForDev(pageId, ip) {
  const key = `${pageId}:${ip}`;
  return OTP_STORE.get(key)?.code || null;
}

const THROTTLE_CONFIG = {
  maxAttempts: 5,
  windowMs: 15 * 60 * 1000, // 15 دقايق
  otpExpireMs: 5 * 60 * 1000  // 5 دقايق
};

export function generateOTP(length = 6) {
  return crypto.randomInt(10 ** (length - 1), 10 ** length).toString().padStart(length, '0');
}

export function generateCSRFToken() {
  return crypto.randomBytes(32).toString('hex');
}

export function verifyCSRFToken(token, sessionToken) {
  return token === sessionToken;
}

export function storeOTP(pageId, ip, code) {
  const key = `${pageId}:${ip}`;
  OTP_STORE.set(key, {
    code,
    expires: Date.now() + THROTTLE_CONFIG.otpExpireMs,
    attempts: 0
  });
  setTimeout(() => OTP_STORE.delete(key), THROTTLE_CONFIG.otpExpireMs);
}

export function verifyOTP(pageId, ip, code) {
  const key = `${pageId}:${ip}`;
  const stored = OTP_STORE.get(key);

  if (!stored) return { valid: false, reason: 'expired' };
  if (Date.now() > stored.expires) {
    OTP_STORE.delete(key);
    return { valid: false, reason: 'expired' };
  }

  stored.attempts++;
  if (stored.attempts > 5) {
    OTP_STORE.delete(key);
    return { valid: false, reason: 'too_many_attempts' };
  }

  if (stored.code !== code) {
    return { valid: false, reason: 'invalid' };
  }

  OTP_STORE.delete(key);
  return { valid: true };
}

export function checkThrottle(pageId, ip) {
  const key = `${pageId}:${ip}`;
  const now = Date.now();
  const attempts = OTP_ATTEMPTS.get(key) || [];

  const recent = attempts.filter(t => now - t < THROTTLE_CONFIG.windowMs);

  if (recent.length >= THROTTLE_CONFIG.maxAttempts) {
    return {
      throttled: true,
      retryAfter: Math.ceil((recent[0] + THROTTLE_CONFIG.windowMs - now) / 1000)
    };
  }

  recent.push(now);
  OTP_ATTEMPTS.set(key, recent);

  return { throttled: false };
}

export function clearThrottle(pageId, ip) {
  const key = `${pageId}:${ip}`;
  OTP_ATTEMPTS.delete(key);
}

// تنضيف الذاكرة كل ساعة
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of OTP_ATTEMPTS.entries()) {
    const recent = data.filter(t => now - t < THROTTLE_CONFIG.windowMs);
    if (recent.length === 0) OTP_ATTEMPTS.delete(key);
    else OTP_ATTEMPTS.set(key, recent);
  }
}, 60 * 60 * 1000);
