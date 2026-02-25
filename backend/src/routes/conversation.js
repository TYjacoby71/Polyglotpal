/**
 * Conversation Engine
 * ─────────────────────────────────────────────────────────────────────────
 * POST /conversation/turn  — send a user turn, get bot reply + correction
 * POST /conversation/asr   — transcribe audio (Whisper)
 * POST /conversation/receipt — generate end-of-session summary
 */
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { query, queryOne } from '../db/client.js';
import { getOrCreateSkillModel, updateSkillModelFromTurn } from '../services/skillModel.js';
import { buildSystemPrompt } from '../services/promptBuilder.js';
import { routeToModel } from '../services/modelRouter.js';
import { detectErrors, recordError } from '../services/errorDetector.js';
import { addLexemeItem } from '../services/srs.js';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function conversationRoutes(app) {
  const auth = { onRequest: [app.authenticate] };

  /**
   * POST /conversation/turn
   * Body: { session_id, user_text, turn_history: [{role, content}] }
   * Returns: { reply, correction, new_vocab, tl_ratio, model_used }
   */
  app.post('/turn', auth, async (req, reply) => {
    const userId = req.user.sub;
    const { session_id, user_text, turn_history = [] } = req.body;

    // ── Load context ─────────────────────────────────────────────────
    const session = await queryOne(
      'SELECT * FROM sessions WHERE id = $1 AND user_id = $2',
      [session_id, userId]
    );
    if (!session) return reply.code(404).send({ error: 'Session not found' });

    const skill = await getOrCreateSkillModel(userId, session.target_language);
    const user = await queryOne(
      'SELECT correction_intensity, base_language FROM users WHERE id = $1',
      [userId]
    );

    // ── Get correction budget for this session ────────────────────────
    const { count: explicitCount } = await queryOne(
      `SELECT COUNT(*)::int as count FROM error_events
       WHERE session_id = $1 AND correction_mode = 'explicit'`,
      [session_id]
    );
    const correctionBudgetRemaining = 3 - explicitCount;

    // ── Route to cheap vs expensive model ────────────────────────────
    const modelChoice = routeToModel({
      turnHistory: turn_history,
      skill,
      correctionBudgetRemaining,
      userText: user_text,
    });

    // ── Build system prompt ───────────────────────────────────────────
    const systemPrompt = buildSystemPrompt({
      skill,
      user,
      session,
      correctionBudgetRemaining,
      modelChoice,
    });

    // ── Call LLM ─────────────────────────────────────────────────────
    const messages = [
      ...turn_history.map(t => ({ role: t.role, content: t.content })),
      { role: 'user', content: user_text },
    ];

    let llmResponse;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        llmResponse = await Promise.race([
          anthropic.messages.create({
            model: modelChoice.model,
            max_tokens: 400,
            system: systemPrompt,
            messages,
          }),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('LLM timeout')), 15000)
          ),
        ]);
        break;
      } catch (err) {
        if (attempt === 3) throw err;
        await new Promise(r => setTimeout(r, 1000 * attempt));
      }
    }

    const botReply = llmResponse.content[0].text;
    console.log('DEBUG: got bot reply, length', botReply.length);

    // ── Detect errors in user_text ────────────────────────────────────
    const errors = await detectErrors({
      userText: user_text,
      botReply,
      skill,
      correctionBudgetRemaining,
      sessionId: session_id,
      userId,
    });

    // ── Persist errors ────────────────────────────────────────────────
    for (const err of errors) {
      await recordError({ ...err, session_id, user_id: userId });
    }

    console.log('DEBUG: errors detected', errors.length);
    // ── Extract new vocab from bot reply ──────────────────────────────
    const newVocab = await extractAndSaveVocab({
      botReply,
      userId,
      language: session.target_language,
      sessionId: session_id,
    });

    console.log('DEBUG: vocab extracted', newVocab.length);
    // ── Update skill model ────────────────────────────────────────────
    await updateSkillModelFromTurn({
      userId,
      language: session.target_language,
      userText: user_text,
      errors,
      skill,
    });

    console.log('DEBUG: skill model updated');
    // ── Increment turn count ──────────────────────────────────────────
    await query(
      'UPDATE sessions SET turn_count = turn_count + 1 WHERE id = $1',
      [session_id]
    );

    return {
      reply: botReply,
      correction: errors[0] ?? null,
      new_vocab: newVocab,
      tl_ratio: skill.tl_ratio,
      model_used: modelChoice.model,
      correction_budget_remaining: correctionBudgetRemaining - errors.filter(e => e.correction_mode === 'explicit').length,
    };
  });

  /**
   * POST /conversation/asr
   * Body: multipart form — audio file (webm/m4a/wav)
   * Returns: { transcript, confidence }
   */
  app.post('/asr', { ...auth, config: { rawBody: true } }, async (req, reply) => {
    const data = await req.file();
    if (!data) return reply.code(400).send({ error: 'No audio file provided' });

    const buffer = await data.toBuffer();
    const file = new File([buffer], data.filename ?? 'audio.webm', { type: data.mimetype });

    const transcription = await openai.audio.transcriptions.create({
      file,
      model: 'whisper-1',
      language: 'es', // TODO: pull from session context
    });

    return { transcript: transcription.text, confidence: 1.0 };
  });

  /**
   * POST /conversation/receipt
   * Body: { session_id }
   * Generates end-of-session receipt using the larger model
   */
  app.post('/receipt', auth, async (req, reply) => {
    const userId = req.user.sub;
    const { session_id } = req.body;

    const session = await queryOne(
      'SELECT * FROM sessions WHERE id = $1 AND user_id = $2',
      [session_id, userId]
    );
    if (!session) return reply.code(404).send({ error: 'Session not found' });

    const errors = await query(
      `SELECT error_type, wrong_span, corrected_span, correction_mode, count_this_session
       FROM error_events WHERE session_id = $1 ORDER BY count_this_session DESC LIMIT 5`,
      [session_id]
    );

    const vocab = await query(
      `SELECT item, gloss, example_sentence FROM lexeme_items
       WHERE user_id = $1 AND created_at >= $2 LIMIT 5`,
      [userId, session.started_at]
    );

    const skill = await getOrCreateSkillModel(userId, session.target_language);

    const receiptPrompt = `You are summarizing a language learning session for a student.

Session duration: ${session.duration_seconds ?? '?'} seconds
Target language: ${session.target_language}
Current level: ${skill.cefr_estimate}
Comprehension score: ${(skill.comprehension_score * 100).toFixed(0)}%
Production score: ${(skill.production_score * 100).toFixed(0)}%

Errors made this session:
${JSON.stringify(errors, null, 2)}

New vocab encountered:
${JSON.stringify(vocab, null, 2)}

Generate a session receipt in JSON format with exactly these fields:
{
  "wins": ["string", "string", "string"],      // 3 specific positive observations
  "top_corrections": ["string", "string"],      // 2 most important corrections as friendly tips
  "summary": "string"                           // 1-sentence motivational summary
}

Be warm, specific, and encouraging. Mention actual words/structures they used well.`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 400,
      messages: [{ role: 'user', content: receiptPrompt }],
    });

    let receipt;
    try {
      const raw = response.content[0].text.replace(/```json|```/g, '').trim();
      receipt = JSON.parse(raw);
    } catch {
      receipt = {
        wins: ['Great effort today!', 'You kept the conversation going', 'You\'re building real fluency'],
        top_corrections: errors.slice(0, 2).map(e => `${e.wrong_span} → ${e.corrected_span}`),
        summary: 'Another session in the books — consistency is everything.',
      };
    }

    // Persist wins + summary on session
    await query(
      'UPDATE sessions SET wins = $2, summary_text = $3 WHERE id = $1',
      [session_id, receipt.wins, receipt.summary]
    );

    return { receipt, vocab: vocab.slice(0, 5), errors: errors.slice(0, 2) };
  });
}

// ── Helpers ──────────────────────────────────────────────────────────────

async function extractAndSaveVocab({ botReply, userId, language, sessionId }) {
  // Lightweight extraction: find bracketed vocab hints the system prompt asks the bot to emit
  // Format: [VOCAB: word | gloss | example]
  const matches = [...botReply.matchAll(/\[VOCAB:\s*([^|]+)\|([^|]+)\|([^\]]+)\]/g)];
  const saved = [];
  for (const m of matches) {
    const item = m[1].trim();
    const gloss = m[2].trim();
    const example_sentence = m[3].trim();
    await addLexemeItem({ userId, item, language, gloss, example_sentence });
    saved.push({ item, gloss });
  }
  return saved;
}