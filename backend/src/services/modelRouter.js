/**
 * modelRouter.js
 *
 * Routes each conversation turn to the appropriate model tier:
 *   - CHEAP (claude-haiku-4-5-20251001): ~80% of turns — banter, simple recasts
 *   - EXPENSIVE (claude-sonnet-4-6): ~20% — complex corrections, confused learners
 *
 * Also decides which correction mode to use for the turn.
 */

const CHEAP_MODEL = 'claude-haiku-4-5-20251001';
const EXPENSIVE_MODEL = 'claude-sonnet-4-6';

/**
 * @param {object} params
 * @param {Array}  params.turnHistory       - last N turns
 * @param {object} params.skill             - learner's skill model
 * @param {number} params.correctionBudgetRemaining
 * @param {string} params.userText
 * @returns {{ model: string, correctionMode: string, reason: string }}
 */
export function routeToModel({ turnHistory, skill, correctionBudgetRemaining, userText }) {
  const reasons = [];
  let useExpensive = false;
  let correctionMode = 'recast'; // default

  // ── Signals that force expensive model ───────────────────────────
  if (skill.comprehension_score < 0.4) {
    useExpensive = true;
    reasons.push('low comprehension — needs nuanced scaffolding');
  }

  if (isConfused(userText)) {
    useExpensive = true;
    reasons.push('user appears confused');
  }

  if (correctionBudgetRemaining > 0 && needsExplicitCorrection(turnHistory, userText)) {
    useExpensive = true;
    correctionMode = 'explicit';
    reasons.push('repeated error pattern detected');
  }

  // ── Decide correction mode (independent of model cost) ───────────
  if (correctionMode !== 'explicit') {
    if (correctionBudgetRemaining > 0 && hasRepeatedError(turnHistory, userText)) {
      correctionMode = 'prompt';
      reasons.push('same error seen twice — using minimal prompt');
    } else {
      correctionMode = 'recast';
    }
  }

  // ── Use expensive model for low-confidence learners sometimes ─────
  if (skill.confidence_score < 0.3 && Math.random() < 0.3) {
    useExpensive = true;
    reasons.push('low confidence — using warmer model');
  }

  return {
    model: useExpensive ? EXPENSIVE_MODEL : CHEAP_MODEL,
    correctionMode,
    reason: reasons.join('; ') || 'standard turn',
  };
}

// ── Heuristics ────────────────────────────────────────────────────────

function isConfused(text) {
  const t = text.toLowerCase();
  const confusionMarkers = ['huh', 'what?', 'i don\'t understand', 'no entiendo', 'que?', '???', 'sorry?', 'what does'];
  return confusionMarkers.some(m => t.includes(m));
}

function needsExplicitCorrection(turnHistory, userText) {
  // Simplified: look for same short span repeated in recent turns
  // Real implementation would use error_events table
  if (turnHistory.length < 4) return false;

  const recentUserTurns = turnHistory
    .filter(t => t.role === 'user')
    .slice(-4)
    .map(t => t.content?.toLowerCase() ?? '');

  // Count how many recent turns contain similar patterns (stub — real impl uses error_events)
  const similar = recentUserTurns.filter(t =>
    longestCommonSubstring(t, userText.toLowerCase()) > 8
  );
  return similar.length >= 2;
}

function hasRepeatedError(turnHistory, userText) {
  // Lighter check: same error appearing second time
  return needsExplicitCorrection(turnHistory.slice(-6), userText);
}

function longestCommonSubstring(a, b) {
  let max = 0;
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < b.length; j++) {
      let len = 0;
      while (i + len < a.length && j + len < b.length && a[i + len] === b[j + len]) len++;
      if (len > max) max = len;
    }
  }
  return max;
}
