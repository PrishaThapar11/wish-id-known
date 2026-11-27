import { getGenerativeModel, InferenceMode, Schema } from 'firebase/ai';
import { ai, loadConfig } from './firebase.js';
import { rank, ground, setRepeatMin } from './retrieve.js';
import { allTips, refreshPool } from './pool.js';
import { nanoStatus } from './nano.js';
import { OFFICIAL } from './seed.js';
import { mask } from './shield.js';

const S = Schema;
const claim = () => S.object({ properties: { text: S.string(), ids: S.array({ items: S.string() }) } });
const SCHEMA = S.object({
  properties: {
    verdict: S.enumString({ enum: ['answered', 'partial', 'unknown'] }),
    summary: S.string(),
    official: S.array({ items: claim() }),
    repeated: S.array({ items: claim() }),
    single: S.array({ items: claim() }),
    conflicts: S.array({ items: S.object({ properties: { official_says: S.string(), students_say: S.string(), official_ids: S.array({ items: S.string() }), student_ids: S.array({ items: S.string() }) } }) }),
    gaps: S.array({ items: S.string() }),
  },
});
// Same shape as plain JSON schema, for the on-device model (hybrid mode takes config per backend).
const cl = { type: 'object', properties: { text: { type: 'string' }, ids: { type: 'array', items: { type: 'string' } } }, required: ['text', 'ids'] };
const arr = (items) => ({ type: 'array', items });
const strs = arr({ type: 'string' });
const JSON_SCHEMA = {
  type: 'object',
  properties: {
    verdict: { type: 'string', enum: ['answered', 'partial', 'unknown'] }, summary: { type: 'string' },
    official: arr(cl), repeated: arr(cl), single: arr(cl),
    conflicts: arr({ type: 'object', properties: { official_says: { type: 'string' }, students_say: { type: 'string' }, official_ids: strs, student_ids: strs }, required: ['official_says', 'students_say', 'official_ids', 'student_ids'] }),
    gaps: strs,
  },
  required: ['verdict', 'summary', 'official', 'repeated', 'single', 'conflicts', 'gaps'],
};
const LANG = [{ type: 'text', languages: ['en'] }];

const RULES = `You answer a new student's question about Halden University using ONLY the numbered sources below. Official sources have ids like O1 (handbook). Student tips have ids like T1 or C1 (sample or community submissions).
Rules:
- Every claim must list the ids that support it. Never state anything the sources do not say.
- Do not add consequences, advice or steps that no source states. If the sources do not say what happens, leave it out and put it in gaps.
- Use only sources that directly answer the question and ignore the rest. If none do, return verdict unknown with every list empty.
- official: what the handbook says. repeated: what several different tips agree on. Combine tips that say the same kind of thing into ONE claim and list every supporting tip id. Example: three tips that each describe a student being turned back or warned about clothes become ONE repeated claim listing all three ids, not three separate single claims. single: something only one or two tips say.
- conflicts: when the handbook is general, silent or says something different, and several tips describe stricter or different practice. Give official_says, students_say and both id lists (at least three tip ids).
- Describe what a tip says happened (turned back, warned, asked to change) in the tip's own terms. Never turn one event into a rule such as "X is not allowed".
- Never present a tip as a university rule. Never name any person.
- gaps: what a student would still want to know that the sources do not cover.
- verdict: answered (handbook or repeated tips cover it), partial (only some of it), unknown (sources do not really answer it).
- summary: one short plain sentence that only restates the claims above. No new facts.
Return JSON.`;

const line = (x) => (x.title ? `[${x.id}] HANDBOOK (${x.title}): ${x.text}` : `[${x.id}] TIP (${x.origin === 'community' ? 'community, unreviewed' : 'sample'}, ${x.shelf}, ${x.kind}, ${x.when}): ${x.text}`);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Online: retry when the cloud model is overloaded (500/503) or rate-limited (429).
// Offline: one patient attempt, because the on-device model can take a while to start.
async function generate(model, prompt, offline) {
  let last;
  for (const wait of offline ? [0] : [0, 3000, 8000]) {
    if (wait) await sleep(wait);
    try {
      return await Promise.race([
        model.generateContent(prompt),
        sleep(offline ? 120000 : 60000).then(() => { throw Object.assign(new Error('timed out'), { code: 'timeout' }); }),
      ]);
    } catch (e) {
      last = e;
      if (!/\b(500|503|429)\b/.test(`${e.message} ${e.code}`)) throw e;
    }
  }
  throw last;
}

export async function ask(question) {
  const cfg = await loadConfig();
  setRepeatMin(cfg.repeatMin);
  const clean = mask(question).text;
  const offline = !navigator.onLine;
  if (offline && (await nanoStatus()) !== 'available') throw Object.assign(new Error('offline without the on-device model'), { code: 'offline-no-nano' });
  if (!offline) await Promise.race([refreshPool(), sleep(4000)]); // picks up tips added since this page loaded, but never waits long
  let tips, official;
  if (!offline) { // the cloud model reads everything and judges relevance itself, so wording differences can't hide a tip
    const pool = allTips();
    tips = pool.slice(0, 60).concat(pool.slice(60).slice(-60));
    official = OFFICIAL;
  } else { // small on-device context: pre-select the closest matches
    ({ tips, official } = rank(clean, allTips(), 8));
  }
  const map = Object.fromEntries([...tips, ...official].map((x) => [x.id, x]));
  if (!tips.length && !official.length) {
    return { r: { verdict: 'unknown', summary: '', official: [], repeated: [], single: [], conflicts: [], gaps: [] }, map, sent: null };
  }
  const onDeviceParams = { createOptions: { expectedInputs: LANG, expectedOutputs: LANG }, promptOptions: { responseConstraint: JSON_SCHEMA } };
  const model = getGenerativeModel(ai, offline
    ? { mode: InferenceMode.ONLY_ON_DEVICE, onDeviceParams } // no network: go straight to Gemini Nano
    : { // cloud when online, Gemini Nano on this device if the cloud can't be reached
        mode: InferenceMode.PREFER_IN_CLOUD,
        inCloudParams: { model: cfg.model, generationConfig: { responseMimeType: 'application/json', responseSchema: SCHEMA, temperature: 0.2 } },
        onDeviceParams,
      });
  const prompt = `${RULES}\n\nSOURCES:\n${[...official, ...tips].map(line).join('\n')}\n\nQUESTION: ${clean}`;
  const res = await generate(model, prompt, offline);
  console.info('inferenceSource reported by SDK:', res.response.inferenceSource, '| online:', navigator.onLine);
  const source = !navigator.onLine || /device/i.test(String(res.response.inferenceSource || '')) ? 'device' : 'cloud';
  const txt = res.response.text();
  const raw = JSON.parse(txt.match(/\{[\s\S]*\}/)[0]);
  return { r: ground(raw, tips, official), map, sent: { tips: tips.length, official: official.length }, source, prompt };
}
