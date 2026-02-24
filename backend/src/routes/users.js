import { query, queryOne } from '../db/client.js';
import { getDueItems, recordReview } from '../services/srs.js';
import { getOrCreateSkillModel } from '../services/skillModel.js';

export async function userRoutes(app) {
  const auth = { onRequest: [app.authenticate] };

  // GET /users/me — profile + skill models
  app.get('/me', auth, async (req) => {
    const userId = req.user.sub;
    const user = await queryOne(
      `SELECT id, email, base_language, target_languages,
              correction_intensity, store_transcripts, notif_preferences, created_at
       FROM users WHERE id = $1`,
      [userId]
    );
    const skills = await query(
      'SELECT * FROM skill_model WHERE user_id = $1',
      [userId]
    );
    return { ...user, skills };
  });

  // PATCH /users/me — update preferences
  app.patch('/me', auth, async (req) => {
    const userId = req.user.sub;
    const { correction_intensity, store_transcripts, notif_preferences } = req.body ?? {};

    const updates = [];
    const params = [userId];
    let idx = 2;

    if (correction_intensity !== undefined) {
      updates.push(`correction_intensity = $${idx++}`);
      params.push(correction_intensity);
    }
    if (store_transcripts !== undefined) {
      updates.push(`store_transcripts = $${idx++}`);
      params.push(store_transcripts);
    }
    if (notif_preferences !== undefined) {
      updates.push(`notif_preferences = $${idx++}`);
      params.push(notif_preferences);
    }

    if (updates.length === 0) return { ok: true };

    updates.push(`updated_at = now()`);
    const user = await queryOne(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $1 RETURNING *`,
      params
    );
    return user;
  });

  // GET /users/me/srs — items due for review
  app.get('/me/srs', auth, async (req) => {
    const userId = req.user.sub;
    const { language, limit = 5 } = req.query;
    const items = await getDueItems(userId, language, Number(limit));
    return { items, count: items.length };
  });

  // POST /users/me/srs/:id/review — submit a review result
  app.post('/me/srs/:id/review', auth, async (req, reply) => {
    const { id } = req.params;
    const { quality } = req.body; // 0-5

    if (typeof quality !== 'number' || quality < 0 || quality > 5) {
      return reply.code(400).send({ error: 'quality must be 0-5' });
    }

    const result = await recordReview(id, quality);
    return result;
  });

  // GET /users/me/stats — dashboard stats
  app.get('/me/stats', auth, async (req) => {
    const userId = req.user.sub;

    const [streak, weeklyMinutes, totalSessions, skills] = await Promise.all([
      getStreakDays(userId),
      getWeeklyMinutes(userId),
      queryOne('SELECT COUNT(*)::int as count FROM sessions WHERE user_id = $1', [userId]),
      query('SELECT language, cefr_estimate, comprehension_score, production_score FROM skill_model WHERE user_id = $1', [userId]),
    ]);

    return {
      streak_days: streak,
      weekly_minutes: weeklyMinutes,
      total_sessions: totalSessions.count,
      skills,
    };
  });
}

// ── Helpers ──────────────────────────────────────────────────────────────

async function getStreakDays(userId) {
  const rows = await query(
    `SELECT DATE(started_at) as day
     FROM sessions
     WHERE user_id = $1 AND ended_at IS NOT NULL
     GROUP BY day ORDER BY day DESC`,
    [userId]
  );

  if (rows.length === 0) return 0;

  let streak = 0;
  let expected = new Date();
  expected.setHours(0, 0, 0, 0);

  for (const row of rows) {
    const day = new Date(row.day);
    day.setHours(0, 0, 0, 0);
    const diff = (expected - day) / (1000 * 60 * 60 * 24);
    if (diff > 1) break;
    streak++;
    expected = day;
  }

  return streak;
}

async function getWeeklyMinutes(userId) {
  const result = await queryOne(
    `SELECT COALESCE(SUM(duration_seconds) / 60, 0)::int as minutes
     FROM sessions
     WHERE user_id = $1
       AND started_at >= now() - interval '7 days'
       AND ended_at IS NOT NULL`,
    [userId]
  );
  return result.minutes;
}
