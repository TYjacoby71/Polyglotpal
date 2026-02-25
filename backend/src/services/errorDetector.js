import { query, queryOne } from '../db/client.js';

const ERROR_TAG_RE = /\[(RECAST|PROMPT|EXPLICIT):\s*([^|\]]+)\|([^|\]]+)(?:\|([^\]]+))?\]/gi;
const TAG_MODE = { RECAST: 'recast', PROMPT: 'prompt', EXPLICIT: 'explicit' };

export async function detectErrors({ userText, botReply, skill, correctionBudgetRemaining, sessionId, userId }) {
  const tagged = parseTagsFromReply(botReply);
  return tagged;
}

function parseTagsFromReply(botReply) {
  const errors = [];
  let match;
  ERROR_TAG_RE.lastIndex = 0;
  while ((match = ERROR_TAG_RE.exec(botReply)) !== null) {
    const [, tag, field1, field2, field3] = match;
    const mode = TAG_MODE[tag.toUpperCase()] ?? 'recast';
    errors.push({
      error_type: normalizeErrorType((field3 ?? field2).trim()),
      wrong_span: field1.trim(),
      corrected_span: field2.trim(),
      correction_mode: mode,
      meaning_broken: mode === 'explicit',
    });
  }
  return errors;
}

export async function recordError({ error_type, wrong_span, corrected_span, correction_mode, meaning_broken, session_id, user_id }) {
  if (!wrong_span) return;
  const existing = await queryOne(
    `SELECT id FROM error_events WHERE session_id = $1 AND wrong_span ILIKE $2`,
    [session_id, wrong_span]
  );
  if (existing) {
    await query('UPDATE error_events SET count_this_session = count_this_session + 1 WHERE id = $1', [existing.id]);
  } else {
    await query(
      `INSERT INTO error_events (user_id, session_id, error_type, wrong_span, corrected_span, correction_mode, meaning_broken)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [user_id, session_id, error_type, wrong_span ?? '', corrected_span ?? '', correction_mode, meaning_broken ?? false]
    );
  }
}

function normalizeErrorType(raw) {
  const VALID = ['tense', 'gender', 'preposition', 'word_choice', 'pronunciation', 'other'];
  const normalized = (raw ?? '').toLowerCase().replace(/[^a-z_]/g, '');
  return VALID.includes(normalized) ? normalized : 'other';
}