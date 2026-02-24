/**
 * errorDetector.js — v2
 *
 * Two-layer approach:
 *  1. Parse structured tags the bot is prompted to emit ([RECAST:...] etc.)
 *  2. If no tags found, run a cheap LLM grammar check as fallback
 *
 * Bot is instructed to emit one of:
 *   [RECAST: wrong_span | corrected_span | error_type]
 *   [PROMPT: wrong_span | error_type]
 *   [EXPLICIT: wrong_span | corrected_span | error_type]
 */
import Anthropic from '@anthropic-ai/sdk';
import { query, queryOne } from '../db/client.js';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const ERROR_TAG_RE = /\[(RECAST|PROMPT|EXPLICIT):\s*([^|\]]+)\|([^|\]]+)(?:\|([^\]]+))?\]/gi;

// Map tag name → correction_mode
const TAG_MODE = { RECAST: 'recast', PROMPT: 'prompt', EXPLICIT: 'explicit' };

/**
 * detectErrors
 *
 * @param {object} params
 * @returns {Array<{error_type, wrong_span, corrected_span, correction_mode, meaning_broken}>}
 */
export async function detectErrors({
  userText,
  botReply,
  skill,
  correctionBudgetRemaining,
  sessionId,
  userId,
}) {
  // ── Layer 1: parse structured tags from bot reply ─────────────────
  const tagged = parseTagsFromReply(botReply);
  if (tagged.length > 0) return tagged;

  // ── Layer 2: fallback LLM grammar check ──────────────────────────
  // Only run if there's budget and the user wrote enough to check
  if (correctionBudgetRemaining <= 0 || userText.trim().length < 8) return [];

  return await llmGrammarCheck({ userText, skill });
}

// ── Layer 1: tag parser ───────────────────────────────────────────────────

function parseTagsFromReply(botReply) {
  const errors = [];
  let match;
  // Reset lastIndex before using sticky regex
  ERROR_TAG_RE.lastIndex = 0;

  while ((match = ERROR_TAG_RE.exec(botReply)) !== null) {
    const [, tag, field1, field2, field3] = match;
    const mode = TAG_MODE[tag.toUpperCase()] ?? 'recast';

    if (mode === 'prompt') {
      // PROMPT only has wrong_span + error_type
      errors.push({
        error_type: normalizeErrorType(field2.trim()),
        wrong_span: field1.trim(),
        corrected_span: '',
        correction_mode: 'prompt',
        meaning_broken: false,
      });
    } else {
      // RECAST and EXPLICIT have wrong_span | corrected_span | error_type
      errors.push({
        error_type: normalizeErrorType((field3 ?? field2).trim()),
        wrong_span: field1.trim(),
        corrected_span: field2.trim(),
        correction_mode: mode,
        meaning_broken: mode === 'explicit',
      });
    }
  }

  return errors;
}

// ── Layer 2: LLM fallback grammar check ─────────────────────────────────

async function llmGrammarCheck({ userText, skill }) {
  const prompt = `You are a Spanish language error detector. Analyze this learner's message and identify ONE grammar error if present.

Learner level: ${skill.cefr_estimate}
Learner said: "${userText}"

If there is a clear grammar error, respond with ONLY this JSON (no other text):
{"has_error": true, "wrong_span": "exact words from learner", "corrected_span": "correct form", "error_type": "tense|gender|preposition|word_choice|pronunciation|other", "meaning_broken": false}

If the message is correct or the error is minor/acceptable at this level, respond with ONLY:
{"has_error": false}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 120,
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = response.content[0].text.trim();
    const parsed = JSON.parse(raw);

    if (!parsed.has_error) return [];

    return [{
      error_type: normalizeErrorType(parsed.error_type),
      wrong_span: parsed.wrong_span ?? '',
      corrected_span: parsed.corrected_span ?? '',
      correction_mode: 'recast', // fallback always uses softest mode
      meaning_broken: parsed.meaning_broken ?? false,
    }];
  } catch {
    return []; // non-fatal — just skip error detection this turn
  }
}

// ── recordError ───────────────────────────────────────────────────────────

/**
 * Persist error to DB, incrementing count if same span already exists this session.
 */
export async function recordError({
  error_type, wrong_span, corrected_span, correction_mode, meaning_broken,
  session_id, user_id,
}) {
  if (!wrong_span) return; // nothing to record

  const existing = await queryOne(
    `SELECT id FROM error_events
     WHERE session_id = $1 AND wrong_span ILIKE $2`,
    [session_id, wrong_span]
  );

  if (existing) {
    await query(
      'UPDATE error_events SET count_this_session = count_this_session + 1 WHERE id = $1',
      [existing.id]
    );
  } else {
    await query(
      `INSERT INTO error_events
       (user_id, session_id, error_type, wrong_span, corrected_span, correction_mode, meaning_broken)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [user_id, session_id, error_type, wrong_span ?? '', corrected_span ?? '', correction_mode, meaning_broken ?? false]
    );
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────

function normalizeErrorType(raw) {
  const VALID = ['tense', 'gender', 'preposition', 'word_choice', 'pronunciation', 'other'];
  const normalized = (raw ?? '').toLowerCase().replace(/[^a-z_]/g, '');
  return VALID.includes(normalized) ? normalized : 'other';
}
