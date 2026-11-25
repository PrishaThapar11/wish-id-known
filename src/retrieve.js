import { TIPS, OFFICIAL } from './seed.js';
import { mask } from './shield.js';

export let REPEAT_MIN = 3; // a claim needs this many independent tips to count as "heard repeatedly"
export const setRepeatMin = (n) => { REPEAT_MIN = n; };

const STOP = new Set(('the and for are was were does did can what how about from with this that have has there which who when you your any should would could also than then them they but not get got into out our too its it a an i my me to of in on at be is do or if so as by rule rules policy allowed university halden campus happen happens work works need needs know thing things way take make much many long time don doesn didn tell told').split(' '));
// Words that mean the same thing to a student collapse into one concept, so "curfew" finds "gate closes".
const GROUPS = {
  curfew: 'curfew gate entry entries late close closes',
  attend: 'attendance attend shortage condonation',
  wear: 'wear wearing dress clothes clothing cloth attire outfit shorts jeans',
  exam: 'exam exams test tests cat papers paper',
  food: 'mess food meal meals breakfast lunch dinner canteen menu',
  leave: 'leave outpass',
  place: 'placement placements offer offers job company recruit drive drives',
  fee: 'fee fees payment receipt receipts refund accounts',
  wifi: 'wifi internet network',
  course: 'course courses ffcs slot slots faculty subject',
  card: 'card id',
};
const CANON = {};
for (const [g, ws] of Object.entries(GROUPS)) ws.split(' ').forEach((w) => { CANON[w] = '#' + g; });
const stem = (w) => { for (let i = 0; i < 2; i++) w = w.replace(/(ing|ed|ly|es|s)$/, ''); return w.slice(0, 6); };
const tok = (s) => (String(s).toLowerCase().match(/[a-z]+/g) || []).filter((w) => w.length > 2 && !STOP.has(w)).map((w) => CANON[w] || stem(w));

// How much real content is left once placeholders like [ROOM] are ignored.
export const substance = (text) => new Set(tok(String(text).replace(/\[[A-Z]+\]/g, ' '))).size;
// Share of the output's content words that also appear in the source. Low means the model made things up.
export const overlap = (output, source) => { const have = new Set(tok(source)); const w = [...new Set(tok(output))]; return w.length ? w.filter((x) => have.has(x)).length / w.length : 0; };

// Offline path only (small on-device context): best matches by IDF-weighted overlap.
export function rank(question, pool = TIPS, n = 8) {
  const q = [...new Set(tok(mask(question).text))];
  if (!q.length) return { tips: [], official: [] };
  const docs = [...OFFICIAL, ...pool];
  const bags = docs.map((d) => new Set(tok(`${d.title || ''} ${d.text}`)));
  const idf = (w) => Math.log((docs.length + 1) / (bags.filter((b) => b.has(w)).length + 0.5));
  const scored = docs.map((d, i) => ({ d, s: q.reduce((a, w) => a + (bags[i].has(w) ? idf(w) : 0), 0) }))
    .filter((x) => x.s >= 1.5).sort((a, b) => b.s - a.s);
  return { tips: scored.filter((x) => !x.d.title).slice(0, n).map((x) => x.d), official: scored.filter((x) => x.d.title).slice(0, 4).map((x) => x.d) };
}

// The model proposes; this decides. Claims without valid evidence ids are dropped, and thresholds are enforced here.
export function ground(raw, tips, official) {
  const none = { verdict: 'unknown', summary: '', official: [], repeated: [], single: [], conflicts: [], gaps: [] };
  if (raw.verdict === 'unknown') return none;
  const T = new Set(tips.map((x) => x.id)), O = new Set(official.map((x) => x.id));
  const byId = Object.fromEntries([...tips, ...official].map((x) => [x.id, x]));
  // A valid id is not enough: most of the claim's content words must appear in the sources it cites.
  const ratio = (words, have) => { const w = [...new Set(words)]; return w.length ? w.filter((x) => have.has(x)).length / w.length : 0; };
  const supported = (text, idList) => ratio(tok(text), new Set(idList.flatMap((i) => tok(`${byId[i].title || ''} ${byId[i].text}`)))) >= 0.45;
  const ids = (a, S) => [...new Set((a || []).filter((i) => S.has(i)))];
  const fix = (arr, S) => (arr || []).map((c) => ({ text: String(c.text || '').trim(), ids: ids(c.ids, S) })).filter((c) => c.text && c.ids.length && supported(c.text, c.ids));
  const off = fix(raw.official, O);
  let repeated = fix(raw.repeated, T), single = fix(raw.single, T);
  single = single.concat(repeated.filter((c) => c.ids.length < REPEAT_MIN));
  repeated = repeated.filter((c) => c.ids.length >= REPEAT_MIN);
  const conflicts = (raw.conflicts || []).map((c) => ({
    handbook: String(c.official_says || '').trim(), students: String(c.students_say || '').trim(),
    oids: ids(c.official_ids, O), sids: ids(c.student_ids, T),
  })).filter((c) => c.handbook && c.students && c.oids.length && c.sids.length >= REPEAT_MIN && supported(c.handbook, c.oids) && supported(c.students, c.sids));
  const gaps = (raw.gaps || []).map((g) => String(g).trim()).filter((g) => g.includes(' ') && g.length > 15).slice(0, 4);
  const any = off.length || repeated.length || single.length || conflicts.length;
  if (!any) return none;
  const claimWords = new Set([...off, ...repeated, ...single].flatMap((c) => tok(c.text)).concat(conflicts.flatMap((c) => tok(`${c.handbook} ${c.students}`))));
  const summary = ratio(tok(raw.summary || ''), claimWords) >= 0.6 ? String(raw.summary).trim() : ''; // a summary that says more than the claims is dropped
  return { verdict: raw.verdict === 'answered' && (off.length || repeated.length) ? 'answered' : 'partial', summary, official: off, repeated, single, conflicts, gaps };
}
