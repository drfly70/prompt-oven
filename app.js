import { mix, seedFromTimestamp, serializeBakePlan } from './mixer.js';
import { apply, countTokens, serializeBakeResult } from './engine.js';
const HIST_KEY = 'prompt-oven.history.v1';
const $ = (id) => document.getElementById(id);
const src = $('src');
const seedEl = $('seed');
const out = $('out');
const techEl = $('tech');
const tagsEl = $('tags');
const shortEl = $('short');
const errEl = $('err');
const histEl = $('hist');
const srcMeta = $('srcMeta');
const outMeta = $('outMeta');
const verEl = $('ver');
let catalog = null;
const pin = new Set();
const exclude = new Set();
function setSeed(n) { seedEl.value = String(n >>> 0); }
function loadHist() { try { return JSON.parse(localStorage.getItem(HIST_KEY) || '[]'); } catch { return []; } }
function saveHist(rows) { try { localStorage.setItem(HIST_KEY, JSON.stringify(rows.slice(0, 10))); } catch {} }
function renderHist() {
  const rows = loadHist();
  histEl.innerHTML = '';
  rows.forEach((row) => {
    const li = document.createElement('li');
    const applied = (row.result && row.result.applied) ? row.result.applied.join(',') : 'none';
    li.textContent = `#${row.plan.seed} · applied ${applied || 'none'} · ${countTokens(row.source)} tok`;
    li.addEventListener('click', () => {
      src.value = row.source;
      setSeed(row.plan.seed);
      pin.clear(); exclude.clear();
      (row.pinIds || []).forEach((id) => pin.add(id));
      (row.excludeIds || []).forEach((id) => exclude.add(id));
      renderTech();
      out.value = row.result.output;
      paintResult(row.plan, row.result);
    });
    histEl.appendChild(li);
  });
}
function renderTech() {
  if (!catalog) return;
  techEl.innerHTML = '';
  catalog.techniques.forEach((t) => {
    const box = document.createElement('div');
    box.className = 'tech';
    box.innerHTML = `<header><span>${t.name}</span><span class="id">${t.id} · ${t.tweak}</span></header><div class="ops"><label><input type="checkbox" data-act="pin" data-id="${t.id}" ${pin.has(t.id) ? 'checked' : ''}/> pin</label><label><input type="checkbox" data-act="ex" data-id="${t.id}" ${exclude.has(t.id) ? 'checked' : ''}/> exclude</label></div>`;
    box.querySelectorAll('input').forEach((inp) => {
      inp.addEventListener('change', () => {
        const id = inp.getAttribute('data-id');
        const act = inp.getAttribute('data-act');
        if (act === 'pin') {
          if (inp.checked) {
            if (pin.size >= 3) { inp.checked = false; errEl.textContent = 'TOO_MANY_PINS — max 3'; return; }
            exclude.delete(id); pin.add(id);
          } else pin.delete(id);
        } else {
          if (inp.checked) { pin.delete(id); exclude.add(id); } else exclude.delete(id);
        }
        errEl.textContent = '';
        renderTech();
      });
    });
    techEl.appendChild(box);
  });
}
function paintResult(plan, result) {
  tagsEl.innerHTML = '';
  const applied = new Set(result.applied || []);
  const dropped = new Set(result.dropped || []);
  (plan.items || []).forEach((item) => {
    const s = document.createElement('span');
    s.className = 'tag' + (applied.has(item.id) ? ' on' : dropped.has(item.id) ? ' drop' : '');
    s.textContent = `${item.id}@${item.intensity} ${item.tweak}` + (dropped.has(item.id) ? ' dropped' : '');
    tagsEl.appendChild(s);
  });
  const srcTok = countTokens(src.value);
  srcMeta.textContent = srcTok + ' source tokens';
  const reason = result.reason || plan.reason;
  outMeta.textContent = (result.applied || []).length + ' applied · ' + (result.dropped || []).length + ' dropped · ratio ' + Number(result.ratio || 0).toFixed(3) + (reason ? ' · ' + reason : '');
  shortEl.hidden = !(reason === 'OVER_BUDGET' || ((result.applied || []).length === 0 && srcTok > 0 && srcTok < 40 && !plan.reason));
  if (plan.reason) errEl.textContent = plan.reason;
}
function bake() {
  errEl.textContent = '';
  if (!catalog) { errEl.textContent = 'INVALID_CATALOG'; return; }
  const sourcePrompt = src.value;
  let seed = Number(seedEl.value);
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) { seed = seedFromTimestamp(); setSeed(seed); }
  const pinIds = catalog.techniques.map((t) => t.id).filter((id) => pin.has(id));
  const excludeIds = catalog.techniques.map((t) => t.id).filter((id) => exclude.has(id));
  const plan = mix({ sourcePrompt, catalog, seed, excludeIds, pinIds });
  const result = apply(sourcePrompt, plan, catalog.tweakPolicy);
  out.value = result.output;
  paintResult(plan, result);
  if (!plan.reason && sourcePrompt.trim()) {
    const rows = loadHist();
    rows.unshift({ source: sourcePrompt, plan, result, seed, catalogVersion: catalog.version, pinIds, excludeIds, planBytes: serializeBakePlan(plan), resultBytes: serializeBakeResult(result) });
    saveHist(rows);
    renderHist();
  }
}
$('bake').addEventListener('click', bake);
$('reseed').addEventListener('click', () => setSeed(seedFromTimestamp()));
$('copy').addEventListener('click', () => {
  const text = out.value || '';
  const ok = () => { $('copy').textContent = 'Copied'; setTimeout(() => { $('copy').textContent = 'Copy output'; }, 1500); };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(ok).catch(() => { out.select(); document.execCommand('copy'); ok(); });
  else { out.select(); document.execCommand('copy'); ok(); }
});
src.addEventListener('input', () => { srcMeta.textContent = countTokens(src.value) + ' source tokens'; });
fetch(new URL('./catalog.json', import.meta.url))
  .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
  .then((c) => { catalog = c; verEl.textContent = c.version; renderTech(); setSeed(seedFromTimestamp()); srcMeta.textContent = countTokens(src.value) + ' source tokens'; renderHist(); })
  .catch((e) => { errEl.textContent = 'catalog.json failed to load — serve this folder over HTTP. ' + e; });
