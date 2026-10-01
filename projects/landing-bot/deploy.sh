#!/bin/bash
# Deploy landing-bot to VPS
# Usage: bash deploy.sh

VPS="root@37.60.232.250"
VPS_PORT="2222"
VPS_DIR="/root/landing-bot"

echo "=== Deploying landing-bot to VPS ==="

# Upload latest code (excluding node_modules and data)
git archive --format=tar HEAD | ssh -p $VPS_PORT $VPS "
  cd $VPS_DIR
  # Backup DB and .env
  cp data.sqlite data.sqlite.bak 2>/dev/null || true
  cp .env .env.bak 2>/dev/null || true
  # Extract new code
  tar xf -
  # Restore .env (never overwrite production config)
  cp .env.bak .env 2>/dev/null || true
  # Install/update deps
  npm install --omit=dev --silent
  # Restart
  pm2 restart landing-bot --update-env
  echo 'Deploy complete'
"

echo "=== Done ==="
echo "Admin: http://37.60.232.250/admin"
echo "DNS: Add 'lbot' A record → 37.60.232.250 to get https://lbot.privatehash.online"
