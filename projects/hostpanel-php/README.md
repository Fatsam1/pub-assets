# HostPanel

Self-hosted admin dashboard to sell/manage cPanel hosting for marketing clients.
Creates cPanel accounts (WHM), links domains through Cloudflare, and applies
bot/WAF/SSL protection + clean-reputation records (SPF/DKIM/DMARC) — all from one panel.

## What it does
- **Telegram-code login** — a user enters their chat ID, the bot sends a 6-digit code.
  Only chat IDs an admin added can log in (brute-force guarded, session-regenerating).
- **Roles** — superadmin (you) > admin (can create cPanels) > user (owns their sites only).
- **My sites** — each user sees only the cPanels they own (per-user isolation).
- **Create cPanel** — quick subdomain, or a full domain that auto-links to Cloudflare + protection.
- **Per-cPanel** tabs: Open (one-click cPanel auto-login), Domains (link a domain, shows its
  exact Cloudflare nameservers + live/pending status), Protection (toggle each layer),
  Captcha (Cloudflare challenge on/off), Manage (reset password / suspend / transfer / delete).

## Files
- `index.php` — the whole frontend (single page).
- `api.php` — API router (`api.php?action=...`).
- `lib.php` — WHM + Cloudflare API clients, users/ownership stores, protection helpers.
- `config.php` — loads secrets from `.env`.
- `.env.example` — copy to `.env` and fill in (keep the real `.env` OUTSIDE public_html).
- `upload.py` — deploy helper: pushes the PHP files into the target cPanel via WHM's API.

## Deploy
1. Create the panel's cPanel account (e.g. `panel.yourdomain.com`).
2. Put `index.php`, `api.php`, `lib.php`, `config.php` in its `public_html/`.
3. Put a filled-in `.env` one directory ABOVE `public_html` (e.g. `/home/<user>/.env`).
4. Point the panel domain through Cloudflare (proxied).

## Security notes
- Secrets live only in `.env`, never in the web root.
- The Cloudflare Global API Key has full account access — rotate it if it's ever exposed.
- Do NOT enable "under_attack"/captcha on domains you send marketing campaigns to — it
  challenges every visitor. Keep security level at "medium" for campaign domains.
- Never use cloaking / hide pages from scanners — it gets domains and the whole IP banned.
