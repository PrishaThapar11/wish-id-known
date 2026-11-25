const WHEN = { recent: 'this year', last_year: 'last year', older: 'earlier' };
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

function sources(ids, map) {
  const d = el('details', 'ev');
  d.open = ids.length === 1; // one source: show the supporting sentence right away
  d.append(el('summary', null, ids.length === 1 ? 'See the source' : `See the ${ids.length} sources`));
  ids.forEach((id) => {
    const it = map[id], p = el('p', 'evi');
    p.append(el('b', null, it.title ? `Handbook (sample): ${it.title}. ` : `${it.origin === 'community' ? 'Community tip (unreviewed)' : 'Sample tip'}, ${it.shelf.toLowerCase()}, ${WHEN[it.when]}. `), document.createTextNode(it.text));
    d.append(p);
  });
  return d;
}
function block(parent, tag, cls) { const b = el('section', 'blk ' + cls); b.append(el('span', 'tag', tag)); parent.append(b); return b; }
function items(b, list, map, cls, note) {
  list.forEach((c) => {
    const w = el('div', 'it');
    w.append(el('p', cls || 'txt', c.text));
    if (note) w.append(el('p', 'note', note(c)));
    w.append(sources(c.ids, map));
    b.append(w);
  });
}

export function renderAnswer(root, { r, map, sent, source, prompt }, onAdd) {
  root.replaceChildren(); root.hidden = false;
  if (r.summary && r.verdict !== 'unknown') root.append(el('p', 'sum', r.summary));
  if (r.verdict === 'unknown') {
    const b = block(root, 'Still unclear', 'unk');
    b.append(el('p', 'sum', 'Nobody has written this down yet.'));
    b.append(el('p', 'txt', 'There’s no handbook entry and not enough student tips to answer this reliably, so it’s marked unanswered instead of guessed.'));
    const btn = el('button', 'primary', 'I know this, add it'); btn.onclick = onAdd; b.append(btn);
  }
  r.conflicts.forEach((c) => {
    const b = block(root, 'Handbook vs. what students report', 'conf');
    const g = el('div', 'two');
    const l = el('div'); l.append(el('b', null, 'Handbook says'), el('p', 'txt', c.handbook), sources(c.oids, map));
    const s = el('div'); s.append(el('b', null, `Students report (${c.sids.length} sample tips)`), el('p', 'txt', c.students), sources(c.sids, map));
    g.append(l, s); b.append(g);
  });
  if (r.official.length) items(block(root, 'From the handbook', 'off'), r.official, map);
  if (r.repeated.length) items(block(root, 'Heard from several students', 'rep'), r.repeated, map, null, (c) => `Repeated in ${c.ids.length} sample tips`);
  if (r.single.length) items(block(root, 'One person’s experience', 'one'), r.single, map, 'anec', () => 'Unverified. Treat as a story, not a rule.');
  if (r.gaps.length && r.verdict !== 'unknown') {
    const b = block(root, 'Still unclear', 'unk'); const ul = el('ul'); r.gaps.forEach((g) => ul.append(el('li', null, g))); b.append(ul);
    const btn = el('button', 'quiet', 'Add what you know'); btn.onclick = onAdd; b.append(btn);
  }
  const m = el('div', 'meta');
  m.append(el('p', null, !sent ? 'Nothing matched, so nothing was sent anywhere.'
    : source === 'device' ? 'Answered on this device by Gemini Nano, using the tips already loaded in this browser. Nothing left your browser.'
    : `Answered by Gemini in the cloud, which read ${sent.official} handbook entries and ${sent.tips} tips. Your question was cleaned first. No original stories were sent.`));
  if (prompt) {
    const d = el('details', 'ev');
    d.append(el('summary', null, source === 'device' ? 'What the on-device model was given' : 'Exactly what was sent'), el('pre', null, prompt));
    m.append(d);
  }
  root.append(m);
}
