/**
 * srs.js — SM-2 Spaced Repetition System
 *
 * Based on the SM-2 algorithm: https://www.supermemo.com/en/blog/application-of-a-computer-to-improve-the-results-obtained-in-working-with-the-supermemo-method
 */
import { query, queryOne } from '../db/client.js';

/**
 * Add or update a lexeme item in the user's SRS deck.
 */
export async function addLexemeItem({ userId, item, language, gloss, example_sentence }) {
  await query(
    `INSERT INTO lexeme_items (user_id, item, language, gloss, example_sentence)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (user_id, item, language)
     DO UPDATE SET
       gloss = EXCLUDED.gloss,
       example_sentence = EXCLUDED.example_sentence`,
    [userId, item, language, gloss, example_sentence]
  );
}

/**
 * Get items due for review today.
 */
export async function getDueItems(userId, language = null, limit = 5) {
  const langClause = language ? 'AND language = $3' : '';
  const params = language ? [userId, new Date(), language] : [userId, new Date()];
  return query(
    `SELECT * FROM lexeme_items
     WHERE user_id = $1 AND due_date <= $2 ${langClause}
     ORDER BY due_date ASC LIMIT ${limit}`,
    params
  );
}

/**
 * Record a review result and apply SM-2 to schedule next review.
 *
 * @param {string} itemId - lexeme_items.id
 * @param {number} quality - 0–5 (0=complete blackout, 5=perfect)
 */
export async function recordReview(itemId, quality) {
  const item = await queryOne('SELECT * FROM lexeme_items WHERE id = $1', [itemId]);
  if (!item) throw new Error('Item not found');

  const { ease_factor: ef, interval_days: n, streak } = item;
  const result = sm2(ef, n, streak, quality);

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + result.interval_days);

  await query(
    `UPDATE lexeme_items
     SET ease_factor = $2,
         interval_days = $3,
         streak = $4,
         due_date = $5,
         last_reviewed_at = now()
     WHERE id = $1`,
    [itemId, result.ease_factor, result.interval_days, result.streak, dueDate]
  );

  return result;
}

// ── SM-2 implementation ──────────────────────────────────────────────────

function sm2(ef, n, streak, quality) {
  // quality: 0-5
  // ef: ease factor (starts at 2.5)
  // n: current interval in days

  let newEf = ef + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  newEf = Math.max(1.3, newEf);

  let newN;
  let newStreak;

  if (quality < 3) {
    // Failed — reset interval
    newN = 1;
    newStreak = 0;
  } else {
    newStreak = streak + 1;
    if (n <= 1) {
      newN = 1;
    } else if (n === 1) {
      newN = 6;
    } else {
      newN = Math.round(n * newEf);
    }
  }

  return { ease_factor: newEf, interval_days: newN, streak: newStreak };
}
