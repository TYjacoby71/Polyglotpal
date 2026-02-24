import { query, queryOne } from '../db/client.js';

/**
 * Retrieve or bootstrap a learner's skill model for a given language.
 */
export async function getOrCreateSkillModel(userId, language) {
  let skill = await queryOne(
    'SELECT * FROM skill_model WHERE user_id = $1 AND language = $2',
    [userId, language]
  );

  if (!skill) {
    skill = await queryOne(
      `INSERT INTO skill_model (user_id, language)
       VALUES ($1, $2)
       ON CONFLICT (user_id, language) DO UPDATE SET updated_at = now()
       RETURNING *`,
      [userId, language]
    );
  }

  return skill;
}

/**
 * Update skill model signals after a turn.
 * Uses rolling averages — doesn't overwrite, nudges scores.
 */
export async function updateSkillModelFromTurn({ userId, language, userText, errors, skill }) {
  const alpha = 0.1; // EMA smoothing factor

  // ── Comprehension signal ─────────────────────────────────────────
  // Did user give a substantive reply? (not just "yes/no/huh?")
  const seemsComprehending = userText.length > 20 && !isConfused(userText);
  const comprSignal = seemsComprehending ? 1.0 : 0.0;
  const newComprehension = ema(skill.comprehension_score, comprSignal, alpha);

  // ── Production signal ─────────────────────────────────────────────
  // Fewer errors = higher production score
  const errorRate = errors.length === 0 ? 1.0 : Math.max(0, 1 - errors.length * 0.2);
  const newProduction = ema(skill.production_score, errorRate, alpha);

  // ── Confidence signal ─────────────────────────────────────────────
  const isShuttingDown = userText.length < 10 || isConfused(userText);
  const confSignal = isShuttingDown ? 0.0 : 1.0;
  const newConfidence = ema(skill.confidence_score, confSignal, alpha * 0.5); // confidence moves slower

  // ── Adjust TL ratio ───────────────────────────────────────────────
  // Nudge ratio up if doing well, down if struggling
  const doingWell = newComprehension > 0.7 && newProduction > 0.6;
  const struggling = newComprehension < 0.4 || newConfidence < 0.3;
  let newTlRatio = skill.tl_ratio;
  if (doingWell) newTlRatio = Math.min(0.95, skill.tl_ratio + 0.02);
  if (struggling) newTlRatio = Math.max(0.10, skill.tl_ratio - 0.05);

  // ── Update grammar mastery per error type ─────────────────────────
  const grammarMastery = { ...skill.grammar_mastery };
  for (const err of errors) {
    grammarMastery[err.error_type] = Math.max(
      0,
      (grammarMastery[err.error_type] ?? 0.5) - 0.05
    );
  }

  // ── Recalculate CEFR estimate ─────────────────────────────────────
  const cefr = estimateCefr(newComprehension, newProduction, skill.tl_ratio);

  await query(
    `UPDATE skill_model
     SET comprehension_score = $3,
         production_score = $4,
         confidence_score = $5,
         tl_ratio = $6,
         grammar_mastery = $7,
         cefr_estimate = $8,
         updated_at = now()
     WHERE user_id = $1 AND language = $2`,
    [userId, language, newComprehension, newProduction, newConfidence, newTlRatio, grammarMastery, cefr]
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────

function ema(current, signal, alpha) {
  return Math.min(1, Math.max(0, current * (1 - alpha) + signal * alpha));
}

function isConfused(text) {
  const t = text.toLowerCase();
  return ['huh', 'what?', 'i don\'t understand', 'no entiendo', '???'].some(m => t.includes(m));
}

function estimateCefr(comprehension, production, tlRatio) {
  const score = (comprehension + production + tlRatio) / 3;
  if (score < 0.25) return 'A1';
  if (score < 0.40) return 'A2';
  if (score < 0.55) return 'B1';
  if (score < 0.70) return 'B2';
  if (score < 0.85) return 'C1';
  return 'C2';
}
