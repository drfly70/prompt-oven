export const REASONS = {
  EMPTY_SOURCE: 'EMPTY_SOURCE',
  EMPTY_PLAN: 'EMPTY_PLAN',
  UNKNOWN_TWEAK: 'UNKNOWN_TWEAK',
  OVER_BUDGET: 'OVER_BUDGET',
};
export const DEFAULT_MAX_TOKEN_CHANGE_RATIO = 0.4;
const TWEAKS = ['prepend', 'append', 'wrap', 'inject'];
export function countTokens(text) {
  const trimmed = String(text).trim();
  return trimmed === '' ? 0 : trimmed.split(/\s+/).length;
}
const result = (output, applied, dropped, reason, ratio) => ({ output, applied, dropped, reason, ratio });
function firstSentenceEnd(text) {
  const m = /[.!?](?=\s|$)/.exec(text);
  return m ? m.index + 1 : -1;
}
function tweakOnce(current, item, source) {
  const text = item.text;
  switch (item.tweak) {
    case 'prepend': return text + '\n\n' + current;
    case 'append': return current + '\n\n' + text;
    case 'wrap': return text + '\n\n—\n' + current + '\n—';
    case 'inject': {
      const cut = firstSentenceEnd(current);
      const srcStart = current.indexOf(source);
      const splitsSource = cut > srcStart && cut < srcStart + source.length;
      if (cut === -1 || splitsSource) return current + '\n\n' + text;
      return current.slice(0, cut) + '\n\n' + text + '\n\n' + current.slice(cut).trimStart();
    }
    default: return null;
  }
}
export function apply(source, plan, policy = {}) {
  if (typeof source !== 'string' || source.trim() === '') {
    return result(typeof source === 'string' ? source : '', [], [], REASONS.EMPTY_SOURCE, 0);
  }
  const items = plan && Array.isArray(plan.items) ? plan.items : [];
  const planReason = plan && typeof plan.reason === 'string' ? plan.reason : null;
  if (items.length === 0) return result(source, [], [], planReason || REASONS.EMPTY_PLAN, 0);
  const allIds = items.map((i) => (i && typeof i.id === 'string' ? i.id : ''));
  for (const item of items) {
    if (!item || !TWEAKS.includes(item.tweak) || typeof item.text !== 'string') {
      return result(source, [], allIds, REASONS.UNKNOWN_TWEAK, 0);
    }
  }
  const cap = Number.isFinite(policy.maxTokenChangeRatio) ? policy.maxTokenChangeRatio : DEFAULT_MAX_TOKEN_CHANGE_RATIO;
  const srcTokens = countTokens(source);
  const ratioOf = (text) => (countTokens(text) - srcTokens) / Math.max(srcTokens, 1);
  let current = source;
  const applied = [];
  const dropped = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const candidate = tweakOnce(current, item, source);
    if (!candidate.includes(source) || ratioOf(candidate) > cap) {
      if (applied.length === 0 && i === 0 && ratioOf(candidate) > cap) {
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
export const OvenEngine = { apply, countTokens, serializeBakeResult, REASONS };
