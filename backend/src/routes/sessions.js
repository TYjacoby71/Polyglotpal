import { query, queryOne } from '../db/client.js';
import { getOrCreateSkillModel } from '../services/skillModel.js';

export async function sessionRoutes(app) {
  const auth = { onRequest: [app.authenticate] };

  // POST /sessions — start a new session
  app.post('/', auth, async (req, reply) => {
    const userId = req.user.sub;
    const { trigger_type = 'conversation', target_language = 'es' } = req.body ?? {};

    const session = await queryOne(
      `INSERT INTO sessions (user_id, trigger_type, target_language)
       VALUES ($1, $2, $3)
       RETURNING id, started_at, trigger_type, target_language`,
      [userId, trigger_type, target_language]
    );

    const skill = await getOrCreateSkillModel(userId, target_language);
    return reply.code(201).send({ session, skill });
  });

  // PATCH /sessions/:id — end a session
  app.patch('/:id/end', auth, async (req, reply) => {
    const userId = req.user.sub;
    const { id } = req.params;
    const { wins = [], summary_text, target_language_ratio_avg } = req.body ?? {};

    const session = await queryOne(
      `UPDATE sessions
       SET ended_at = now(),
           wins = $3,
           summary_text = $4,
           target_language_ratio_avg = $5
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [id, userId, wins, summary_text, target_language_ratio_avg]
    );

    if (!session) return reply.code(404).send({ error: 'Session not found' });
    return session;
  });

  // GET /sessions — list user's sessions
  app.get('/', auth, async (req) => {
    const userId = req.user.sub;
    const limit = Math.min(Number(req.query.limit ?? 20), 100);
    return query(
      `SELECT id, started_at, ended_at, trigger_type, target_language,
              target_language_ratio_avg, wins, duration_seconds, turn_count
       FROM sessions WHERE user_id = $1
       ORDER BY started_at DESC LIMIT $2`,
      [userId, limit]
    );
  });

  // GET /sessions/:id — single session with error events + lexeme items
  app.get('/:id', auth, async (req, reply) => {
    const userId = req.user.sub;
    const { id } = req.params;

    const session = await queryOne(
      'SELECT * FROM sessions WHERE id = $1 AND user_id = $2',
      [id, userId]
    );
    if (!session) return reply.code(404).send({ error: 'Session not found' });

    const errors = await query(
      'SELECT * FROM error_events WHERE session_id = $1 ORDER BY created_at',
      [id]
    );

    const vocab = await query(
      `SELECT * FROM lexeme_items WHERE user_id = $1
       AND created_at >= $2 ORDER BY created_at`,
      [userId, session.started_at]
    );

    return { session, errors, vocab };
  });
}
