// Prompt Oven — seeded mixer.
export const REASONS = {
  INVALID_SEED: 'INVALID_SEED',
  INVALID_CATALOG: 'INVALID_CATALOG',
  EMPTY_SOURCE: 'EMPTY_SOURCE',
  UNKNOWN_PIN: 'UNKNOWN_PIN',
  PIN_EXCLUDED: 'PIN_EXCLUDED',
  TOO_MANY_PINS: 'TOO_MANY_PINS',
  NO_CANDIDATES: 'NO_CANDIDATES',
};
const TWEAKS = ['prepend', 'append', 'wrap', 'inject'];
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const plan = (seed, catalogVersion, items, reason) => ({ seed, catalogVersion, items, reason });
const fail = (seed, catalogVersion, reason) => plan(Number.isFinite(seed) ? seed : 0, catalogVersion, [], reason);
function catalogIsValid(catalog) {
  if (!catalog || typeof catalog !== 'object') return false;
  if (typeof catalog.version !== 'string' || catalog.version === '') return false;
  if (!Array.isArray(catalog.techniques) || catalog.techniques.length === 0) return false;
  return catalog.techniques.every((t) => t && typeof t.id === 'string' && t.id !== '' && typeof t.family === 'string' && TWEAKS.includes(t.tweak) && Array.isArray(t.intensity) && t.intensity.length === 2 && t.intensity.every((s) => typeof s === 'string' && s !== ''));
}
export function mix({ sourcePrompt, catalog, seed, excludeIds = [], pinIds = [] } = {}) {
  const version = catalog && typeof catalog.version === 'string' ? catalog.version : '';
  if (!catalogIsValid(catalog)) return fail(seed, version, REASONS.INVALID_CATALOG);
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) return fail(seed, version, REASONS.INVALID_SEED);
  if (typeof sourcePrompt !== 'string' || sourcePrompt.trim() === '') return fail(seed, version, REASONS.EMPTY_SOURCE);
  const policy = catalog.tweakPolicy || {};
  const maxItems = Number.isInteger(policy.maxTechniquesPerBake) ? policy.maxTechniquesPerBake : 3;
  const minItems = Number.isInteger(policy.minTechniquesPerBake) ? policy.minTechniquesPerBake : 1;
  const byId = new Map(catalog.techniques.map((t) => [t.id, t]));
  const excluded = new Set(excludeIds);
  const pins = [];
  for (const id of pinIds) {
    if (!byId.has(id)) return fail(seed, version, REASONS.UNKNOWN_PIN);
    if (excluded.has(id)) return fail(seed, version, REASONS.PIN_EXCLUDED);
    if (!pins.includes(id)) pins.push(id);
  }
  if (pins.length > maxItems) return fail(seed, version, REASONS.TOO_MANY_PINS);
  const pool = catalog.techniques.map((t) => t.id).filter((id) => !excluded.has(id) && !pins.includes(id));
  if (pins.length === 0 && pool.length === 0) return fail(seed, version, REASONS.NO_CANDIDATES);
  const rand = mulberry32(seed);
  const span = maxItems - minItems + 1;
  let k = minItems + Math.floor(rand() * span);
  k = Math.max(k, pins.length);
  k = Math.min(k, maxItems, pins.length + pool.length);
  const chosen = pins.slice(0, k);
  const remaining = pool.slice();
  while (chosen.length < k && remaining.length > 0) {
    const i = Math.floor(rand() * remaining.length);
    chosen.push(remaining.splice(i, 1)[0]);
  }
  const items = chosen.map((id) => {
    const t = byId.get(id);
    const intensity = 1 + Math.floor(rand() * 2);
    return { id: t.id, intensity, tweak: t.tweak, text: t.intensity[intensity - 1] };
  });
  return plan(seed, version, items, null);
}
export function serializeBakePlan(bakePlan) {
  return JSON.stringify({
    seed: bakePlan.seed,
    catalogVersion: bakePlan.catalogVersion,
    items: bakePlan.items.map((i) => ({ id: i.id, intensity: i.intensity, tweak: i.tweak, text: i.text })),
    reason: bakePlan.reason,
  });
}
export function seedFromTimestamp(ms = Date.now()) {
  return (ms >>> 0) ^ ((ms / 4294967296) >>> 0);
}
