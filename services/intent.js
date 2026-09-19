// ============================================================
// intent.js - Minimal intent detection (help / status / reset)
// ============================================================

const INTENTS = {
  help: {
    weight: 2,
    kw: {
      en: ['help', 'what can you do', 'how do i', 'how to', 'guide', 'instructions', 'support'],
      am: ['እገዛ', 'እርዳታ', 'እንዴት', 'መመሪያ', 'እርዳኝ']
    }
  },
  status: {
    weight: 2,
    kw: {
      en: ['status', 'progress', 'where am i', 'what have i done', 'current step', 'summary so far'],
      am: ['ሁኔታ', 'ደረጃ', 'የት ደረስኩ', 'ምን ሰራሁ', 'ማጠቃለያ']
    }
  },
  reset: {
    weight: 2,
    kw: {
      en: ['reset', 'start over', 'restart', 'clear', 'begin again', 'new session'],
      am: ['እንደገና', 'ጀምር', 'አጽዳ', 'ከመጀመሪያ', 'አዲስ ጅምር']
    }
  }
};

/**
 * detectIntent(text)
 * Returns { intent, score } or null.
 * Only matches the 3 intents above. Language-agnostic keyword scan
 * (both EN and AM keyword lists are always checked).
 */
export function detectIntent(text) {
  if (!text || typeof text !== 'string') return null;
  const t = text.toLowerCase();

  let best = null;
  let bestScore = 0;

  for (const [intent, def] of Object.entries(INTENTS)) {
    let score = 0;
    const allKw = [...def.kw.en, ...def.kw.am];
    for (const k of allKw) {
      if (t.includes(k.toLowerCase())) score += def.weight;
    }
    if (score > bestScore) {
      best = intent;
      bestScore = score;
    }
  }

  // Threshold: must hit at least one keyword (weight 2)
  return bestScore >= 2 ? { intent: best, score: bestScore } : null;
}

export const INTENT_NAMES = Object.keys(INTENTS);