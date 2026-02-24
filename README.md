# PolyglotPal

Voice-first AI language learning. A bilingual friend, not a grammar teacher.

---

## Run it in 3 steps

### Prerequisites
- [Node.js 20+](https://nodejs.org)
- [Docker Desktop](https://docker.com) (for Postgres + Redis)
- An Anthropic API key → [console.anthropic.com](https://console.anthropic.com)
- An OpenAI API key → [platform.openai.com](https://platform.openai.com) (for Whisper ASR)

### Step 1 — Get the code

```bash
git clone https://github.com/YOUR_USERNAME/polyglotpal.git
cd polyglotpal
```

### Step 2 — Add your API keys

```bash
cp backend/.env.example backend/.env
# Then open backend/.env and fill in:
#   ANTHROPIC_API_KEY=sk-ant-...
#   OPENAI_API_KEY=sk-...
#   JWT_SECRET=any-long-random-string
```

### Step 3 — Start everything

```bash
./start.sh
```

That's it. Open **http://localhost:5173** in your browser.

---

## What you can do in the browser

| Screen | What it does |
|--------|-------------|
| **Login / Register** | Create an account, tokens stored in localStorage |
| **Practice (Dashboard)** | Pick a focus topic, see your stats, hit Talk Now |
| **Conversation** | Type OR click 🎙️ to speak (Chrome only for voice), bot replies in Spanish with gentle corrections, 🔊 replays last message |
| **Receipt** | End-of-session wins, corrections, vocab added |
| **Flashcards** | SM-2 spaced repetition — rate each word ❌ / 😬 / ✅ |
| **Profile** | Correction intensity, notification prefs, skill progress bars |

> **Voice input** uses the browser's Web Speech API — works best in Chrome.
> **Text-to-speech** uses the browser's built-in voices — tries to find a Spanish voice automatically.

---

## Project structure

```
polyglotpal/
├── start.sh                  ← ONE COMMAND to run everything
├── docker-compose.yml        ← Postgres + Redis + optional backend
├── .gitignore
│
├── backend/                  Node + Fastify API
│   ├── Dockerfile
│   ├── .env.example
│   └── src/
│       ├── index.js          Server entry
│       ├── db/
│       │   ├── client.js     Postgres pool
│       │   ├── migrate.js    All 7 tables
│       │   └── redis.js      Cache helpers
│       ├── routes/
│       │   ├── auth.js       POST /auth/register|login
│       │   ├── users.js      Profile, stats, SRS
│       │   ├── sessions.js   Session CRUD
│       │   ├── conversation.js  LLM turn, ASR, receipt
│       │   └── notifications.js Adaptive timing model
│       └── services/
│           ├── promptBuilder.js  Structured tag injection
│           ├── modelRouter.js    Haiku vs Sonnet routing
│           ├── skillModel.js     Rolling EMA learner model
│           ├── errorDetector.js  Parses [RECAST:] tags
│           └── srs.js            SM-2 algorithm
│
├── web/                      React web app (runs in browser)
│   ├── index.html
│   ├── vite.config.js
│   └── src/
│       ├── App.jsx           Router + auth guard
│       ├── index.css         Design tokens + base styles
│       ├── store/
│       │   └── AuthContext.jsx
│       ├── services/
│       │   └── api.js
│       ├── components/
│       │   └── Layout.jsx    Sidebar nav
│       └── pages/
│           ├── LoginPage.jsx
│           ├── DashboardPage.jsx
│           ├── ConversationPage.jsx
│           ├── ReceiptPage.jsx
│           ├── SRSPage.jsx
│           └── ProfilePage.jsx
│
└── mobile/                   React Native (Android + iOS)
    ├── App.js
    ├── android/              Android config + manifest
    ├── ios/                  iOS Podfile + Info.plist
    └── src/
        ├── navigation/
        ├── store/
        ├── services/
        └── screens/          LoginScreen, HomeScreen, ConversationScreen,
                              ReceiptScreen, SRSReviewScreen, ProfileScreen
```

---

## Push to GitHub

```bash
cd polyglotpal
git init
git add .
git commit -m "feat: initial full scaffold"

# Create new repo on github.com, then:
git remote add origin https://github.com/YOUR_USERNAME/polyglotpal.git
git push -u origin main
```

---

## Deploy the backend (when ready)

The backend has a `Dockerfile`. Deploy to any host that runs Docker:

**Railway (easiest):**
```bash
# Install Railway CLI, then:
railway login
railway init
railway up
railway variables set ANTHROPIC_API_KEY=... OPENAI_API_KEY=... JWT_SECRET=...
```

**DigitalOcean / any VPS:**
```bash
docker compose up -d   # runs backend + postgres + redis together
```

---

## Run on Android (no store needed)

1. Install [Android Studio](https://developer.android.com/studio)
2. Enable USB debugging on your Android phone
3. Connect phone via USB
```bash
cd mobile
npm install
npx react-native run-android
```

The app installs directly on your phone.

To build a shareable APK:
```bash
cd mobile/android
./gradlew assembleRelease
# → mobile/android/app/build/outputs/apk/release/app-release.apk
```
Send that file to anyone — they enable "Install unknown apps" and install it.

---

## Cost controls

| Lever | Detail |
|-------|--------|
| Push-to-talk | No open mic — only real speech hits ASR |
| On-device TTS | Browser / iOS / Android native — free |
| Haiku routing | ~80% of turns at ~$0.001/turn |
| Correction budget | Max 3 Sonnet calls per session |
| Rolling memory | Last 10 turns + summary only |

**Target:** < $3 / active user / month at 10–15 min/day

---

*PolyglotPal v0.1 — Confidential*
