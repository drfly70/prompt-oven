// Prompt Oven — engine.
//
// Applies a BakePlan to a source ask. Consumes the plan shape mixer.js emits and
// never calls mix(). Wraps and injects; never replaces, rewrites, or paraphrases
// the source. No randomness lives here — the same plan always yields the same text.
//
// @typedef {Object} BakeResult
// @property {string}      output   the engineered prompt; contains source verbatim
// @property {string[]}    applied  ids committed, in the order applied
// @property {string[]}    dropped  ids skipped, budget or failure
// @property {string|null} reason   null on success, else a reason code
// @property {number}      ratio    (outTokens - srcTokens) / max(srcTokens, 1)

export const REASONS = {
  EMPTY_SOURCE: 'EMPTY_SOURCE',
  EMPTY_PLAN: 'EMPTY_PLAN',
  UNKNOWN_TWEAK: 'UNKNOWN_TWEAK',
  OVER_BUDGET: 'OVER_BUDGET',
};

export const DEFAULT_MAX_TOKEN_CHANGE_RATIO = 0.4;
export const DEFAULT_MAX_TOKEN_CHANGE_ABS = 60;

const TWEAKS = ['prepend', 'append', 'wrap', 'inject'];

/** Whitespace-split token count — the same counter the budget is defined in. */
export function countTokens(text) {
  const trimmed = String(text).trim();
  return trimmed === '' ? 0 : trimmed.split(/\s+/).length;
}

/** Allowed added tokens: max(src * ratio, absFloor). Short asks use the floor. */
export function allowedAddedTokens(srcTokens, policy = {}) {
  const ratio = Number.isFinite(policy.maxTokenChangeRatio)
    ? policy.maxTokenChangeRatio
    : DEFAULT_MAX_TOKEN_CHANGE_RATIO;
  const abs = Number.isFinite(policy.maxTokenChangeAbs)
    ? policy.maxTokenChangeAbs
    : DEFAULT_MAX_TOKEN_CHANGE_ABS;
  return Math.max(srcTokens * ratio, abs);
}

const result = (output, applied, dropped, reason, ratio) => ({
  output,
  applied,
  dropped,
  reason,
  ratio,
});

/** End index of the first sentence in text, or -1 when there is no boundary. */
function firstSentenceEnd(text) {
  const m = /[.!?](?=\s|$)/.exec(text);
  return m ? m.index + 1 : -1;
}

function tweakOnce(current, item, source) {
  const text = item.text;
  switch (item.tweak) {
    case 'prepend':
      return text + '\n\n' + current;
    case 'append':
      return current + '\n\n' + text;
    case 'wrap':
      return text + '\n\n—\n' + current + '\n—';
    case 'inject': {
      const cut = firstSentenceEnd(current);
      const srcStart = current.indexOf(source);
      const splitsSource = cut > srcStart && cut < srcStart + source.length;
      if (cut === -1 || splitsSource) return current + '\n\n' + text;
      return current.slice(0, cut) + '\n\n' + text + '\n\n' + current.slice(cut).trimStart();
    }
    default:
      return null;
  }
}

export function apply(source, plan, policy = {}) {
  if (typeof source !== 'string' || source.trim() === '') {
    return result(typeof source === 'string' ? source : '', [], [], REASONS.EMPTY_SOURCE, 0);
  }

  const items = plan && Array.isArray(plan.items) ? plan.items : [];
  const planReason = plan && typeof plan.reason === 'string' ? plan.reason : null;

  if (items.length === 0) {
    return result(source, [], [], planReason || REASONS.EMPTY_PLAN, 0);
  }

  const allIds = items.map((i) => (i && typeof i.id === 'string' ? i.id : ''));

  for (const item of items) {
    if (!item || !TWEAKS.includes(item.tweak) || typeof item.text !== 'string') {
      return result(source, [], allIds, REASONS.UNKNOWN_TWEAK, 0);
    }
  }

  const srcTokens = countTokens(source);
  const allowance = allowedAddedTokens(srcTokens, policy);
  const addedOf = (text) => countTokens(text) - srcTokens;
  const ratioOf = (text) => addedOf(text) / Math.max(srcTokens, 1);

  let current = source;
  const applied = [];
  const dropped = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const candidate = tweakOnce(current, item, source);

    if (!candidate.includes(source) || addedOf(candidate) > allowance) {
      if (applied.length === 0 && i === 0 && addedOf(candidate) > allowance) {
        return result(source, [], allIds, REASONS.OVER_BUDGET, 0);
      }
      dropped.push(item.id);
      continue;
    }

    current = candidate;
    applied.push(item.id);
  }

  if (applied.length === 0) return result(source, [], allIds, REASONS.OVER_BUDGET, 0);

  return result(current, applied, dropped, null, ratioOf(current));
}

export function serializeBakeResult(bakeResult) {
  return JSON.stringify({
    output: bakeResult.output,
    applied: bakeResult.applied,
    dropped: bakeResult.dropped,
    reason: bakeResult.reason,
    ratio: bakeResult.ratio,
  });
}

export const OvenEngine = { apply, countTokens, serializeBakeResult, allowedAddedTokens, REASONS };
