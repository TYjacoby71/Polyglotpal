#!/usr/bin/env bash
# PolyglotPal — local dev startup
# Usage: ./start.sh

set -e

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo ""
echo -e "${CYAN}  PolyglotPal — starting local dev environment${NC}"
echo ""

# ── Check for .env ────────────────────────────────────────────────────
if [ ! -f backend/.env ]; then
  echo -e "${YELLOW}  ⚠  backend/.env not found — copying from .env.example${NC}"
  cp backend/.env.example backend/.env
  echo ""
  echo -e "${RED}  ✗  ACTION REQUIRED: Open backend/.env and add your API keys:${NC}"
  echo "       ANTHROPIC_API_KEY=sk-ant-..."
  echo "       OPENAI_API_KEY=sk-..."
  echo "       JWT_SECRET=some-random-string"
  echo ""
  echo "  Then re-run: ./start.sh"
  echo ""
  exit 1
fi

# Check for required keys
source backend/.env
if [ -z "$ANTHROPIC_API_KEY" ] || [ "$ANTHROPIC_API_KEY" = "sk-ant-..." ]; then
  echo -e "${RED}  ✗  ANTHROPIC_API_KEY is missing in backend/.env${NC}"
  exit 1
fi

echo -e "${GREEN}  ✓  API keys found${NC}"

# ── Check for node ────────────────────────────────────────────────────
if ! command -v node &> /dev/null; then
  echo -e "${RED}  ✗  Node.js not found. Install from https://nodejs.org${NC}"
  exit 1
fi
echo -e "${GREEN}  ✓  Node $(node -v)${NC}"

# ── Check for docker ─────────────────────────────────────────────────
if ! command -v docker &> /dev/null; then
  echo -e "${RED}  ✗  Docker not found. Install from https://docker.com${NC}"
  exit 1
fi
echo -e "${GREEN}  ✓  Docker found${NC}"
echo ""

# ── Start Postgres + Redis ────────────────────────────────────────────
echo -e "${CYAN}  Starting Postgres + Redis...${NC}"
docker compose up -d postgres redis
echo ""

# Wait for postgres
echo -e "${CYAN}  Waiting for Postgres to be ready...${NC}"
for i in {1..15}; do
  if docker exec polyglotpal_pg pg_isready -U postgres &>/dev/null; then
    echo -e "${GREEN}  ✓  Postgres ready${NC}"
    break
  fi
  sleep 1
done

# ── Install backend deps ──────────────────────────────────────────────
echo ""
echo -e "${CYAN}  Installing backend dependencies...${NC}"
cd backend && npm install --silent && cd ..
echo -e "${GREEN}  ✓  Backend deps installed${NC}"

# ── Run migrations ────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}  Running database migrations...${NC}"
cd backend && node src/db/migrate.js && cd ..
echo -e "${GREEN}  ✓  Database ready${NC}"

# ── Install web deps ──────────────────────────────────────────────────
echo ""
echo -e "${CYAN}  Installing web app dependencies...${NC}"
cd web && npm install --silent && cd ..
echo -e "${GREEN}  ✓  Web deps installed${NC}"

# ── Start backend ─────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}  Starting backend API on http://localhost:3000 ...${NC}"
cd backend && npm run dev &
BACKEND_PID=$!
cd ..

sleep 2

# ── Start web ─────────────────────────────────────────────────────────
echo -e "${CYAN}  Starting web app on http://localhost:5173 ...${NC}"
cd web && npm run dev &
WEB_PID=$!
cd ..

sleep 1

echo ""
echo -e "${GREEN}  ════════════════════════════════════════════${NC}"
echo -e "${GREEN}  ✓  PolyglotPal is running!${NC}"
echo ""
echo -e "     🌐  Web app:  ${CYAN}http://localhost:5173${NC}"
echo -e "     🔌  API:      ${CYAN}http://localhost:3000${NC}"
echo -e "     💚  Health:   ${CYAN}http://localhost:3000/health${NC}"
echo ""
echo -e "     Press Ctrl+C to stop everything"
echo -e "${GREEN}  ════════════════════════════════════════════${NC}"
echo ""

# ── Cleanup on exit ───────────────────────────────────────────────────
trap "echo ''; echo 'Stopping...'; kill $BACKEND_PID $WEB_PID 2>/dev/null; docker compose stop postgres redis; echo 'Done.'" EXIT

wait
