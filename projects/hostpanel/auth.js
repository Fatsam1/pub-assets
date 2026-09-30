import crypto from "node:crypto";
import { config } from "./config.js";

// --- Telegram Login verification (same model as the Priv8Hash login) ---
//
// The Telegram Login Widget returns a signed payload. We verify the signature
// with the bot token, then check the user's id against an allow-list so ONLY
// you can log in — a random person who finds the URL cannot.

const sessions = new Map(); // token -> { chatId, name, exp }
const SESSION_TTL = 1000 * 60 * 60 * 12; // 12h

function allowedIds() {
  return String(config.telegram.allowedChatId || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

// Verify the hash Telegram sends (docs: Checking authorization).
export function verifyTelegramAuth(data) {
  const { hash, ...fields } = data;
  if (!hash) return { ok: false, error: "missing hash" };
  if (!config.telegram.botToken) return { ok: false, error: "bot token not configured" };

  const checkString = Object.keys(fields)
    .sort()
    .map((k) => `${k}=${fields[k]}`)
    .join("\n");

  const secret = crypto.createHash("sha256").update(config.telegram.botToken).digest();
  const hmac = crypto.createHmac("sha256", secret).update(checkString).digest("hex");

  if (hmac !== hash) return { ok: false, error: "signature mismatch" };

  // freshness: reject payloads older than 1 day
  if (fields.auth_date && Date.now() / 1000 - Number(fields.auth_date) > 86400) {
    return { ok: false, error: "auth expired" };
  }

  const allow = allowedIds();
  if (allow.length && !allow.includes(String(fields.id))) {
    return { ok: false, error: "this Telegram account is not authorized" };
  }

  return {
    ok: true,
    chatId: String(fields.id),
    name: [fields.first_name, fields.last_name].filter(Boolean).join(" ") || fields.username || "admin",
  };
}

export function createSession(chatId, name) {
  const token = crypto.randomBytes(32).toString("hex");
  sessions.set(token, { chatId, name, exp: Date.now() + SESSION_TTL });
  return token;
}

export function getSession(token) {
  const s = sessions.get(token);
  if (!s) return null;
  if (Date.now() > s.exp) {
    sessions.delete(token);
    return null;
  }
  return s;
}

export function destroySession(token) {
  sessions.delete(token);
}

// Express middleware: require a valid session cookie/header.
export function requireAuth(req, res, next) {
  // If no bot token configured at all, run in open localhost-only mode so the
  // tool still works on your machine before you wire Telegram.
  if (!config.telegram.botToken) return next();

  // Loopback requests (from the server itself or local scripts) skip auth.
  const ip = req.ip || req.connection?.remoteAddress || "";
  if (ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1") return next();

  const token =
    (req.headers.authorization || "").replace(/^Bearer\s+/i, "") ||
    (req.headers.cookie || "").match(/hp_session=([a-f0-9]+)/)?.[1];

  const s = token && getSession(token);
  if (!s) return res.status(401).json({ ok: false, error: "not authenticated" });
  req.admin = s;
  next();
}
