#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

PORT=3000

echo "==> Installing backend dependencies..."
cd backend && bun install --frozen-lockfile 2>/dev/null || bun install

echo ""
echo "==> Installing frontend dependencies..."
cd ../frontend && bun install --frozen-lockfile 2>/dev/null || bun install

echo ""
echo "==> Building frontend..."
bun run build

echo ""
echo "==> Freeing port ${PORT}..."
sudo sh -c "lsof -t -iTCP:${PORT} -sTCP:LISTEN 2>/dev/null | xargs -r kill" 2>/dev/null || true
sleep 0.5

echo ""
echo "==> Starting production server on port ${PORT}..."
cd ../backend
nohup bun run src/index.ts > /tmp/paperproof-server.log 2>&1 &

sleep 1

# Verify it's running
if curl -s -o /dev/null -w "%{http_code}" http://localhost:${PORT}/api/health | grep -q "200"; then
  echo ""
  echo "✅ PaperProof is live on http://localhost:${PORT}"
else
  echo ""
  echo "⚠️  Server may not have started correctly. Check /tmp/paperproof-server.log"
fi
