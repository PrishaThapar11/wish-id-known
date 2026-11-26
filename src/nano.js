import { getGenerativeModel, InferenceMode } from 'firebase/ai';
import { ai } from './firebase.js';

const TOPICS = ['hostel', 'academics', 'professors', 'paperwork', 'placements', 'campus'];
const KINDS = ['process', 'pattern', 'warning', 'opinion'];
const LANG = [{ type: 'text', languages: ['en'] }];

export async function nanoStatus() {
  try {
    if (typeof LanguageModel === 'undefined') return 'unavailable';
    return await LanguageModel.availability({ expectedInputs: LANG, expectedOutputs: LANG });
  } catch { return 'unavailable'; }
}

const PROMPT = `You help students of Halden University share practical tips anonymously.
Read the story below and write ONE tip a future student could use.
Rules:
- Never include the name of any person. Use roles: a warden, a professor, a clerk.
- Keep office or department email addresses that appear in the story, because they help the next student.
- Do not judge anyone's character or competence. State what happened or how the process works.
- Do not invent facts that are not in the story. If the story contains no useful tip, return empty strings for claim and detail.
- claim: one specific sentence, at most 25 words. Name the concrete step, document, office, deadline or number from the story. Never write generic advice like "be proactive" or "gather documents".
- detail: 1 to 3 sentences with specifics (forms, order of steps, timing, where to go).
- topic: ${TOPICS.join(' | ')} (professors = courses, FFCS, workload, assessment format only)
- kind: process (how something works) | pattern (how it usually goes) | warning (what goes wrong) | opinion (personal view)
Return JSON with keys topic, kind, claim, detail.

STORY:
`;

const JSON_SCHEMA = {
  type: 'object',
  properties: {
    topic: { type: 'string', enum: TOPICS },
    kind: { type: 'string', enum: KINDS },
    claim: { type: 'string' },
    detail: { type: 'string' },
  },
  required: ['topic', 'kind', 'claim', 'detail'],
};

function model(withSchema) {
  return getGenerativeModel(ai, {
    mode: InferenceMode.ONLY_ON_DEVICE, // never falls back to the cloud
    onDeviceParams: {
      createOptions: { expectedInputs: LANG, expectedOutputs: LANG },
      ...(withSchema ? { promptOptions: { responseConstraint: JSON_SCHEMA } } : {}),
    },
  });
}

function parse(txt) {
  const m = String(txt).match(/\{[\s\S]*\}/);
  if (!m) throw new Error('no JSON in model output');
  const o = JSON.parse(m[0]);
  return {
    topic: TOPICS.includes(o.topic) ? o.topic : 'campus',
    kind: KINDS.includes(o.kind) ? o.kind : 'pattern',
    claim: String(o.claim || '').trim().slice(0, 220),
    detail: String(o.detail || '').trim().slice(0, 700),
  };
}

export async function extractTip(maskedStory) {
  try {
    const r = await model(true).generateContent(PROMPT + maskedStory);
    return parse(r.response.text());
  } catch (e) {
    console.warn('Structured output failed, retrying as plain JSON prompt:', e);
    const r = await model(false).generateContent(PROMPT + maskedStory);
    return parse(r.response.text());
  }
}
