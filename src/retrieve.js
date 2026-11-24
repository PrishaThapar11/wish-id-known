import { TIPS, OFFICIAL } from './seed.js';
import { mask } from './shield.js';

export let REPEAT_MIN = 3;
export const setRepeatMin = (n) => { REPEAT_MIN = n; }; // a claim needs this many independent tips to count as "heard repeatedly"
const STOP = new Set('the and for are was were does did can what how about from with this that have has there which who when you your any should would could also than then them they but not get got into out our too its it a an i my me to of in on at be is do or if so as by'.split(' '));
const stem = (w) => (/ss$/.test(w) || w.length < 5 ? w : w.replace(/(ing|ed|es|s|e)$/, ''));
const tok = (s) => (String(s).toLowerCase().replace(/hosteller/g, 'hostel').match(/[a-z]+/g) || []).filter((w) => w.length > 2 && !STOP.has(w)).map(stem);

export function rank(question, pool = TIPS, n = 12) {
  const q = new Set(tok(mask(question).text));
  if (q.has('university')) { q.add('hostel'); q.add('rul'); } // a question about the university also covers hostel rules
  const pick = (arr, k) => arr
    .map((it) => { const t = new Set(tok(it.shelf + ' ' + it.text)); let s = 0; q.forEach((w) => t.has(w) && s++); return { it, s }; })
    .filter((x) => x.s >= 2).sort((a, b) => b.s - a.s).slice(0, k).map((x) => x.it);
  return { tips: pick(pool, n), official: pick(OFFICIAL, 4) };
}

// The model proposes; this decides. Claims without valid evidence ids are dropped, and thresholds are enforced here.
export function ground(raw, tips, official) {
  const T = new Set(tips.map((x) => x.id)), O = new Set(official.map((x) => x.id));
  const ids = (a, S) => [...new Set((a || []).filter((i) => S.has(i)))];
  const fix = (arr, S) => (arr || []).map((c) => ({ text: String(c.text || '').trim(), ids: ids(c.ids, S) })).filter((c) => c.text && c.ids.length);
  const off = fix(raw.official, O);
  let repeated = fix(raw.repeated, T), single = fix(raw.single, T);
  single = single.concat(repeated.filter((c) => c.ids.length < REPEAT_MIN));
  repeated = repeated.filter((c) => c.ids.length >= REPEAT_MIN);
  const conflicts = (raw.conflicts || []).map((c) => ({
    handbook: String(c.official_says || '').trim(), students: String(c.students_say || '').trim(),
    oids: ids(c.official_ids, O), sids: ids(c.student_ids, T),
  })).filter((c) => c.handbook && c.students && c.oids.length && c.sids.length >= REPEAT_MIN);
    const gaps = (raw.gaps || []).map(String).map((g) => g.trim()).filter((g) => g.includes(' ') && g.length > 15).slice(0, 4);
  const any = off.length || repeated.length || single.length || conflicts.length;
  const verdict = !any ? 'unknown' : raw.verdict === 'answered' && (off.length || repeated.length) ? 'answered' : 'partial';
  return { verdict, summary: String(raw.summary || '').trim(), official: off, repeated, single, conflicts, gaps };
}
