import { SHELF, OFFICIAL } from './seed.js';
import { allTips, refreshPool } from './pool.js';
import { myTips, deleteTip } from './firebase.js';

const $ = (s) => document.querySelector(s);
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const WHEN = { recent: 'This year', last_year: 'Last year', older: 'Earlier' };
const KIND = { process: 'How it works', pattern: 'How it usually goes', warning: 'Watch out', opinion: 'One view' };
const KEY = 'wik_saved';
const saved = () => { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } };
const setSaved = (a) => { try { localStorage.setItem(KEY, JSON.stringify(a)); } catch { /* storage blocked: saving just won't persist */ } };
let shelf = 'all';

function card(t) {
  const c = el('article', 'tipcard' + (t.title ? ' off' : ''));
  if (t.topic) c.dataset.topic = t.topic;
  const meta = el('p', 'tmeta');
  meta.append(el('span', 'badge ' + (t.title ? 'b-off' : t.origin === 'community' ? 'b-com' : 'b-sam'), t.title ? 'Handbook (sample)' : t.origin === 'community' ? 'Community tip, unreviewed' : 'Sample tip'));
  if (!t.title) meta.append(el('span', null, KIND[t.kind]), el('span', null, WHEN[t.when]));
  c.append(meta);
  if (t.title) c.append(el('b', 'ttl', t.title));
  c.append(el('p', 'txt', t.text));
  if (t.when === 'older') c.append(el('p', 'stale', 'This may have changed. It’s from a couple of years back.'));
  if (!t.title) {
    const on = saved().includes(t.id);
    const b = el('button', 'quiet sm', on ? 'Saved ✓' : 'Save');
    b.onclick = () => { const s = saved(); setSaved(on ? s.filter((x) => x !== t.id) : [...s, t.id]); route(); };
    c.append(b);
  }
  return c;
}
const fill = (box, list, empty) => { box.replaceChildren(...(list.length ? list.map(card) : [el('p', 'sheet small', empty)])); };

const UNANS = ['How do I change from hosteller to day scholar?', 'How does hostel leave approval work?', 'What are the steps to rejoin after a semester break?', 'Which office handles a name correction on my ID card?'];

function home() {
  const all = allTips(), com = all.filter((t) => t.origin === 'community').length;
  $('#stats').textContent = `${OFFICIAL.length} handbook entries · ${all.length - com} sample tips · ${com} community tip${com === 1 ? '' : 's'} so far`;
  const pool = allTips().filter((t) => t.kind !== 'opinion');
  const pick = [...pool].sort(() => Math.random() - 0.5).slice(0, 3);
  fill($('#worth'), pick, 'No tips yet.');
  const u = $('#unans'); u.replaceChildren();
  UNANS.forEach((q) => {
    const row = el('div', 'urow'); row.append(el('span', null, q));
    const a = el('button', 'quiet sm', 'Ask'); a.onclick = () => go(q);
    const k = el('button', 'quiet sm', 'I know this'); k.onclick = () => { location.hash = '#add'; };
    row.append(a, k); u.append(row);
  });
}
function go(q) { $('#q').value = q; location.hash = '#ask'; setTimeout(() => $('#askBtn').click(), 50); }

function browse() {
  const tabs = $('#tabs'); tabs.replaceChildren();
  [['all', 'Everything'], ...Object.entries(SHELF)].forEach(([k, label]) => {
    const b = el('button', 'tab' + (k === shelf ? ' on' : ''), label);
    if (k !== 'all') b.dataset.topic = k;
    b.onclick = () => { shelf = k; browse(); };
    tabs.append(b);
  });
  const w = $('#fWhenF').value;
  const off = shelf === 'all' ? OFFICIAL : OFFICIAL.filter((o) => o.topic === shelf);
  const tips = allTips().filter((t) => (shelf === 'all' || t.topic === shelf) && (w === 'all' || t.when === w));
  fill($('#blist'), [...off, ...tips], 'Nothing here yet. Be the first to add a tip.');
}
async function mine() {
  const box = $('#mine'); box.replaceChildren(el('p', 'small', 'Loading…'));
  try {
    const list = await myTips(); box.replaceChildren();
    if (!list.length) return box.append(el('p', 'small', 'Nothing yet. Tips you add from this browser show up here.'));
    list.forEach((d) => {
      const c = card({ id: 'C' + d.id, topic: d.topic, shelf: SHELF[d.topic], kind: d.kind, when: d.when, text: `${d.claim} ${d.detail}`.trim(), origin: 'community' });
      const b = el('button', 'quiet sm', 'Delete this tip');
      b.onclick = async () => {
        if (!confirm('Delete this tip for everyone?')) return;
        b.disabled = true;
        try { await deleteTip(d.id); await refreshPool(); mine(); } catch (e) { console.error(e); b.disabled = false; b.textContent = 'Couldn’t delete (see console)'; }
      };
      c.append(b); box.append(c);
    });
  } catch (e) { console.warn(e); box.replaceChildren(el('p', 'small', 'Couldn’t load your tips right now.')); }
}
function savedView() {
  mine();
  const s = saved();
  fill($('#slist'), allTips().filter((t) => s.includes(t.id)), 'Nothing saved yet. Use Save on any tip in Browse.');
}

const VIEWS = { home, browse, saved: savedView, ask() {}, add() {}, how() {} };
export function route() {
  const name = VIEWS[location.hash.slice(1)] ? location.hash.slice(1) : 'home';
  document.querySelectorAll('[data-view]').forEach((v) => { v.hidden = v.dataset.view !== name; });
  document.querySelectorAll('[data-nav]').forEach((a) => a.classList.toggle('on', a.dataset.nav === name));
  VIEWS[name]();
}
window.addEventListener('hashchange', () => { route(); window.scrollTo(0, 0); });
$('#fWhenF').addEventListener('change', browse);
document.querySelectorAll('.slip').forEach((b) => b.addEventListener('click', () => { shelf = b.dataset.shelf; location.hash = '#browse'; }));
$('#hform').addEventListener('submit', (e) => { e.preventDefault(); const q = $('#hq').value.trim(); if (q.length >= 8) go(q); else $('#hq').focus(); });
route();
refreshPool().then(route);
