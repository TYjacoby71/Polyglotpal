import { query, queryOne } from '../db/client.js';
import { getOrCreateSkillModel } from '../services/skillModel.js';
import { getDueItems } from '../services/srs.js';

export async function notificationRoutes(app) {
  const auth = { onRequest: [app.authenticate] };

  /**
   * POST /notifications/event — record a notification interaction
   * Called by mobile when user opens/snoozes/ignores a notification
   */
  app.post('/event', auth, async (req, reply) => {
    const userId = req.user.sub;
    const { notif_id, user_action } = req.body;

    const notif = await queryOne(
      `UPDATE notification_events
       SET user_action = $2, action_at = now()
       WHERE id = $1 AND user_id = $3
       RETURNING *`,
      [notif_id, user_action, userId]
    );

    if (!notif) return reply.code(404).send({ error: 'Notification not found' });

    // ── Update timeslot score ────────────────────────────────────────
    const hour = new Date(notif.sent_at).getHours();
    const timeslotKey = `h${hour}`;

    const scoreDeltas = { opened: 2, snoozed: -1, ignored: -2, disabled: -5 };
    const delta = scoreDeltas[user_action] ?? 0;

    const user = await queryOne('SELECT notif_preferences FROM users WHERE id = $1', [userId]);
    const prefs = user.notif_preferences;
    const scores = prefs.timeslot_scores ?? {};
    scores[timeslotKey] = (scores[timeslotKey] ?? 0) + delta;

    await query(
      `UPDATE users
       SET notif_preferences = notif_preferences || jsonb_build_object('timeslot_scores', $2::jsonb)
       WHERE id = $1`,
      [userId, JSON.stringify(scores)]
    );

    return { ok: true };
  });

  /**
   * GET /notifications/next — predict the best next notification
   * Called by mobile to schedule the next push
   */
  app.get('/next', auth, async (req) => {
    const userId = req.user.sub;

    const user = await queryOne(
      'SELECT notif_preferences, target_languages FROM users WHERE id = $1',
      [userId]
    );

    const skill = await getOrCreateSkillModel(userId, user.target_languages[0]);
    const dueItems = await getDueItems(userId, user.target_languages[0], 3);

    // ── Pick notification type based on learner model ─────────────────
    const type = pickNotifType(skill, dueItems);
    const content = buildNotifContent(type, skill, dueItems);

    // ── Find best timeslot ────────────────────────────────────────────
    const scores = user.notif_preferences.timeslot_scores ?? {};
    const bestHour = findBestHour(scores, user.notif_preferences);

    const nextTime = new Date();
    nextTime.setHours(bestHour, 0, 0, 0);
    if (nextTime <= new Date()) nextTime.setDate(nextTime.getDate() + 1);

    // ── Persist the scheduled notification ───────────────────────────
    const notif = await queryOne(
      `INSERT INTO notification_events (user_id, notif_type, content, sent_at)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [userId, type, content, nextTime]
    );

    return {
      notif_id: notif.id,
      type,
      content,
      scheduled_at: nextTime.toISOString(),
      best_hour: bestHour,
    };
  });

  /**
   * GET /notifications/history — recent notification events
   */
  app.get('/history', auth, async (req) => {
    const userId = req.user.sub;
    return query(
      `SELECT id, notif_type, content, sent_at, user_action, latency_ms
       FROM notification_events WHERE user_id = $1
       ORDER BY sent_at DESC LIMIT 30`,
      [userId]
    );
  });
}

// ── Helpers ──────────────────────────────────────────────────────────────

function pickNotifType(skill, dueItems) {
  const { comprehension_score, production_score, confidence_score } = skill;

  if (confidence_score < 0.4 || (dueItems.length > 0 && Math.random() < 0.4)) {
    return 'micro_quiz';
  }
  if (comprehension_score > 0.65 && production_score > 0.55) {
    return 'conversation';
  }
  return 'mixed';
}

const NOTIF_TEMPLATES = {
  conversation: [
    '¿Qué tal? 3 minutes?',
    'Oye, ¿qué hiciste hoy?',
    'Chat in Spanish? Quick one 💬',
    '¿Tienes 5 minutos para practicar?',
  ],
  mixed: [
    'Quick one: ¿Cómo estuvo tu día? (answer in Spanish)',
    'Intenta esto: tell me about your morning in Spanish',
    'Mini challenge: describe what you\'re doing right now',
  ],
  micro_quiz: (dueItems) => {
    if (dueItems.length > 0) {
      return `What does "${dueItems[0].item}" mean?`;
    }
    return 'Quick vocab check — tap to answer 🎯';
  },
};

function buildNotifContent(type, skill, dueItems) {
  if (type === 'micro_quiz') {
    return typeof NOTIF_TEMPLATES.micro_quiz === 'function'
      ? NOTIF_TEMPLATES.micro_quiz(dueItems)
      : NOTIF_TEMPLATES.micro_quiz[0];
  }
  const templates = NOTIF_TEMPLATES[type];
  return templates[Math.floor(Math.random() * templates.length)];
}

function findBestHour(scores, prefs) {
  const quietStart = parseInt((prefs.quiet_hours_start ?? '22:00').split(':')[0]);
  const quietEnd = parseInt((prefs.quiet_hours_end ?? '08:00').split(':')[0]);

  let best = 8; // default: 8am
  let bestScore = -Infinity;

  for (let h = 0; h < 24; h++) {
    const inQuiet = quietStart > quietEnd
      ? (h >= quietStart || h < quietEnd)
      : (h >= quietStart && h < quietEnd);
    if (inQuiet) continue;

    const score = scores[`h${h}`] ?? 0;
    if (score > bestScore) {
      bestScore = score;
      best = h;
    }
  }
  return best;
}
