import bcrypt from 'bcrypt';
import { query, queryOne } from '../db/client.js';

export async function authRoutes(app) {
  // POST /auth/register
  app.post('/register', {
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 8 },
          base_language: { type: 'string', default: 'en' },
          target_languages: { type: 'array', items: { type: 'string' }, default: ['es'] },
        }
      }
    }
  }, async (req, reply) => {
    const { email, password, base_language = 'en', target_languages = ['es'] } = req.body;

    const existing = await queryOne('SELECT id FROM users WHERE email = $1', [email]);
    if (existing) return reply.code(409).send({ error: 'Email already registered' });

    const password_hash = await bcrypt.hash(password, 12);

    const user = await queryOne(
      `INSERT INTO users (email, password_hash, base_language, target_languages)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, base_language, target_languages, correction_intensity`,
      [email, password_hash, base_language, target_languages]
    );

    // Bootstrap skill model for each target language
    for (const lang of target_languages) {
      await query(
        `INSERT INTO skill_model (user_id, language) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [user.id, lang]
      );
    }

    const token = app.jwt.sign({ sub: user.id, email: user.email });
    return reply.code(201).send({ token, user });
  });

  // POST /auth/login
  app.post('/login', {
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string' },
          password: { type: 'string' },
        }
      }
    }
  }, async (req, reply) => {
    const { email, password } = req.body;

    const user = await queryOne(
      'SELECT id, email, password_hash, base_language, target_languages, correction_intensity FROM users WHERE email = $1',
      [email]
    );
    if (!user) return reply.code(401).send({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return reply.code(401).send({ error: 'Invalid credentials' });

    const token = app.jwt.sign({ sub: user.id, email: user.email });
    const { password_hash: _, ...safeUser } = user;
    return { token, user: safeUser };
  });
}
