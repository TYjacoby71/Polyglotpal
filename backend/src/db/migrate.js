/**
 * polyglotpal/backend/src/db/migrate.js
 *
 * Run: node src/db/migrate.js
 * Creates all tables defined in PRD §7, in dependency order.
 */
import 'dotenv/config';
import { db } from './client.js';

const migrations = [
  // ── users ─────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS users (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email               TEXT UNIQUE NOT NULL,
    password_hash       TEXT NOT NULL,
    base_language       TEXT NOT NULL DEFAULT 'en',
    target_languages    TEXT[] NOT NULL DEFAULT ARRAY['es'],
    correction_intensity TEXT NOT NULL DEFAULT 'medium'
      CHECK (correction_intensity IN ('low','medium','high')),
    store_transcripts   BOOLEAN NOT NULL DEFAULT false,
    notif_preferences   JSONB NOT NULL DEFAULT '{
      "frequency": "daily",
      "quiet_hours_start": "22:00",
      "quiet_hours_end": "08:00",
      "days": ["mon","tue","wed","thu","fri"],
      "timeslot_scores": {}
    }',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,

  // ── sessions ──────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS sessions (
    id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    started_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
    ended_at                  TIMESTAMPTZ,
    trigger_type              TEXT NOT NULL DEFAULT 'conversation'
      CHECK (trigger_type IN ('conversation','mixed','micro_quiz')),
    target_language           TEXT NOT NULL DEFAULT 'es',
    target_language_ratio_avg FLOAT,
    summary_text              TEXT,
    wins                      TEXT[] DEFAULT ARRAY[]::TEXT[],
    turn_count                INT NOT NULL DEFAULT 0,
    duration_seconds          INT GENERATED ALWAYS AS (
      EXTRACT(EPOCH FROM (ended_at - started_at))::INT
    ) STORED
  )`,

  // ── turns (optional full transcript, gated by store_transcripts) ──
  `CREATE TABLE IF NOT EXISTS turns (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id      UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    turn_number     INT NOT NULL,
    role            TEXT NOT NULL CHECK (role IN ('user','assistant')),
    content         TEXT,          -- NULL if store_transcripts=false
    language_tags   JSONB,         -- [{span, language}]
    tl_ratio        FLOAT,         -- target language % for this turn
    asr_confidence  FLOAT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,

  // ── error_events ──────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS error_events (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id         UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    error_type         TEXT NOT NULL
      CHECK (error_type IN ('tense','gender','preposition','word_choice','pronunciation','other')),
    wrong_span         TEXT NOT NULL,
    corrected_span     TEXT NOT NULL,
    correction_mode    TEXT NOT NULL
      CHECK (correction_mode IN ('recast','prompt','explicit')),
    meaning_broken     BOOLEAN NOT NULL DEFAULT false,
    count_this_session INT NOT NULL DEFAULT 1,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,

  // ── lexeme_items (SRS deck) ────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS lexeme_items (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    item             TEXT NOT NULL,
    language         TEXT NOT NULL,
    gloss            TEXT,
    example_sentence TEXT,
    ease_factor      FLOAT NOT NULL DEFAULT 2.5,
    interval_days    INT NOT NULL DEFAULT 1,
    due_date         DATE NOT NULL DEFAULT CURRENT_DATE,
    streak           INT NOT NULL DEFAULT 0,
    last_reviewed_at TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, item, language)
  )`,

  // ── skill_model ───────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS skill_model (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id              UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    language             TEXT NOT NULL,
    cefr_estimate        TEXT NOT NULL DEFAULT 'A1'
      CHECK (cefr_estimate IN ('A1','A2','B1','B2','C1','C2')),
    comprehension_score  FLOAT NOT NULL DEFAULT 0.5 CHECK (comprehension_score BETWEEN 0 AND 1),
    production_score     FLOAT NOT NULL DEFAULT 0.5 CHECK (production_score BETWEEN 0 AND 1),
    confidence_score     FLOAT NOT NULL DEFAULT 0.7 CHECK (confidence_score BETWEEN 0 AND 1),
    grammar_mastery      JSONB NOT NULL DEFAULT '{}',
    topic_comfort        JSONB NOT NULL DEFAULT '{}',
    tl_ratio             FLOAT NOT NULL DEFAULT 0.3,
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, language)
  )`,

  // ── notification_events ───────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS notification_events (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sent_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    notif_type     TEXT NOT NULL CHECK (notif_type IN ('conversation','mixed','micro_quiz')),
    content        TEXT NOT NULL,
    user_action    TEXT CHECK (user_action IN ('opened','snoozed','ignored','disabled')),
    action_at      TIMESTAMPTZ,
    latency_ms     INT GENERATED ALWAYS AS (
      EXTRACT(MILLISECOND FROM (action_at - sent_at))::INT
    ) STORED
  )`,

  // ── indexes ───────────────────────────────────────────────────────
  `CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_error_events_user_session ON error_events(user_id, session_id)`,
  `CREATE INDEX IF NOT EXISTS idx_lexeme_items_due ON lexeme_items(user_id, due_date)`,
  `CREATE INDEX IF NOT EXISTS idx_notif_user_sent ON notification_events(user_id, sent_at)`,
  `CREATE INDEX IF NOT EXISTS idx_skill_model_user ON skill_model(user_id)`,
];

async function migrate() {
  console.log('Running migrations…');
  for (const sql of migrations) {
    await db.query(sql);
    const name = sql.match(/TABLE IF NOT EXISTS (\w+)/)?.[1]
      ?? sql.match(/INDEX IF NOT EXISTS (\w+)/)?.[1]
      ?? 'statement';
    console.log(`  ✓ ${name}`);
  }
  console.log('Migrations complete.');
  await db.end();
}

migrate().catch(err => { console.error(err); process.exit(1); });
