import { mask } from './shield.js';
import { nanoStatus, extractTip } from './nano.js';
import { saveTip, loadConfig } from './firebase.js';
import { refreshPool } from './pool.js';
import { substance, overlap } from './retrieve.js';
import './app.js';

const $ = (s) => document.querySelector(s);
loadConfig(); // fetch Remote Config now, while online, so a later offline question never waits for it
const show = (id, on = true) => { $(id).hidden = !on; };
const say = (id, msg) => { const el = $(id); el.textContent = msg || ''; el.hidden = !msg; };
const SAMPLE = `So I wanted to move from hosteller to day scholar in the middle of 3rd year because my parents moved to Bhopal. Nobody in my block knew how. I went to the hostel office first and the clerk sent me to the warden, Mr Sharma, who said I need a no-dues from the mess and a written request signed by my parent. Then the Dean's office wanted the same letter again with the fee receipt. My roll is 23BCE10456 and they kept asking for it. Took me about two weeks, and the mess refund came only after I mailed accounts at fees.office@halden.edu.`;

(async () => {
  const s = await nanoStatus();
  const chip = $('#chip');
  const map = {
    available: ['ok', 'On-device AI is ready. Your story stays in this browser.'],
    downloadable: ['warn', 'On-device AI will download the first time you use it (a few GB, one time).'],
    downloading: ['warn', 'On-device AI is still downloading. You can fill the form by hand meanwhile.'],
    unavailable: ['bad', 'On-device AI is not available here (needs desktop Chrome 139+). You can still write the tip by hand. Nothing is sent to the cloud for cleaning.'],
  };
  const [cls, msg] = map[s] || map.unavailable;
  chip.className = 'chip ' + cls; chip.textContent = msg;
  if (s === 'available') { // warm up Gemini Nano now, so an offline answer later isn't a cold start
    const L0 = [{ type: 'text', languages: ['en'] }];
    LanguageModel.create({ expectedInputs: L0, expectedOutputs: L0 }).then((x) => x.destroy && x.destroy()).catch(() => {});
  }
  const dl = $('#dl');
  if (s === 'downloadable' || s === 'downloading') {
    dl.hidden = false;
    dl.onclick = async () => {
      dl.disabled = true;
      try {
        const L = [{ type: 'text', languages: ['en'] }];
        await LanguageModel.create({ expectedInputs: L, expectedOutputs: L, monitor(mon) { mon.addEventListener('downloadprogress', (e) => { chip.className = 'chip warn'; chip.textContent = `Downloading the on-device model… ${Math.round(e.loaded * 100)}%`; }); } });
        chip.className = 'chip ok'; chip.textContent = 'On-device AI is ready. Your story stays in this browser.'; dl.hidden = true;
      } catch (e) { console.warn(e); dl.disabled = false; chip.className = 'chip bad'; chip.textContent = 'The download didn’t finish. Check your connection and try again.'; }
    };
  }
})();

function payload() {
  const clean = (v) => mask(v).text.trim();
  return {
    topic: $('#fTopic').value, kind: $('#fKind').value, when: $('#fWhen').value,
    claim: clean($('#fClaim').value), detail: clean($('#fDetail').value),
  };
}
const refresh = () => { $('#payload').textContent = JSON.stringify(payload(), null, 2); };
['#fTopic', '#fKind', '#fWhen', '#fClaim', '#fDetail'].forEach((s) => $(s).addEventListener('input', refresh));

$('#sample').onclick = () => { $('#raw').value = SAMPLE; $('#raw').focus(); };

$('#go').onclick = async () => {
  say('#err', '');
  const raw = $('#raw').value.trim();
  if (raw.length < 40) return say('#err', 'Write a bit more, at least a couple of sentences, so there is a tip to pull out.');
  if (substance(mask(raw).text) < 8) return say('#err', 'There isn’t enough here to make a tip once personal details are removed. Say what happened and what you did, in a few sentences.');
  const btn = $('#go'); btn.disabled = true; btn.textContent = 'Reading it on this device…';
  const m = mask(raw);
  let fields = { topic: 'campus', kind: 'pattern', claim: '', detail: '' };
  let note = 'Fill in the tip yourself. Your original text has not been kept or sent anywhere.';
  try {
    if ((await nanoStatus()) === 'unavailable') throw new Error('unavailable');
    fields = await extractTip(m.text);
    if (overlap(`${fields.claim} ${fields.detail}`, m.text) < 0.45) {
      fields = { ...fields, claim: '', detail: '' };
      note = 'The on-device model wrote something that doesn’t match your story, so it was discarded. Write the tip yourself below.';
    } else {
      note = 'This is what the on-device model pulled out of your story. Edit anything that is wrong or too specific.';
      if (!/[.!?]$/.test(fields.claim)) { fields.claim = ''; note += ' The one-sentence tip came out incomplete, so it is blank for you to write.'; }
    }
  } catch (e) {
    console.warn(e);
    if (e.message !== 'unavailable') note = 'The on-device model could not produce a tip this time (see console). Fill it in by hand; nothing was sent to the cloud.';
  }
  $('#note').textContent = note;
  const f = Object.entries(m.found).map(([k, n]) => `${n} ${k.toLowerCase()}`).join(', ');
  say('#found', m.total ? `Removed before the model even saw it: ${f}.` : '');
  $('#fTopic').value = fields.topic; $('#fKind').value = fields.kind;
  $('#fClaim').value = fields.claim; $('#fDetail').value = fields.detail;
  refresh();
  show('#review'); $('#review').scrollIntoView({ behavior: 'smooth' });
  btn.disabled = false; btn.textContent = 'Clean it up on this device';
};

$('#share').onclick = async () => {
  say('#err2', '');
  const p = payload();
  if (!navigator.onLine) return say('#err2', 'You’re offline. Cleaning works offline, but sharing needs a connection. Try again when you’re back online.');
  if (p.claim.length < 10) return say('#err2', 'The one-sentence tip is empty or too short.');
  const b = $('#share'); b.disabled = true; b.textContent = 'Sharing…';
  try {
    await saveTip(p);
    refreshPool();
    $('#raw').value = '';
    show('#review', false); show('#done'); $('#done').scrollIntoView({ behavior: 'smooth' });
  } catch (e) {
    console.error(e);
    say('#err2', `Could not share it (${e.code || e.message}). Check that Firestore is created, Anonymous sign-in is on, and the rules are published.`);
  } finally { b.disabled = false; b.textContent = 'Share this tip'; }
};
$('#cancel').onclick = () => { show('#review', false); window.scrollTo(0, 0); };
$('#again').onclick = () => { show('#done', false); window.scrollTo(0, 0); };

// ---- Ask ----
import { ask } from './ask.js';
import { renderAnswer } from './render.js';
const goAdd = () => { location.hash = '#add'; };
const setQ = (q) => { $('#q').value = q; };
document.querySelectorAll('[data-q]').forEach((b) => b.addEventListener('click', () => {
  setQ(b.dataset.q);
  if (b.classList.contains('eg')) $('#askBtn').click();
}));
function askError(e) {
  const t = `${e.code} ${e.message}`;
  if (e.code === 'offline-no-nano') return 'You’re offline, and this browser can’t run the on-device model right now. Reconnect, or use desktop Chrome with the on-device model downloaded.';
  if (/timeout|timed out/i.test(t)) return navigator.onLine ? 'That took too long. Try again in a moment.' : 'The on-device model took too long to start. Try once more, it is usually faster the second time.';
  if (/\b(500|503|429)\b|overload|demand/i.test(t)) return 'The AI service is busy right now. Wait a few seconds and try again.';
  return `Couldn’t get an answer (${e.code || e.message}).`;
}
async function runAsk() {
  say('#askErr', '');
  const q = $('#q').value.trim();
  if (q.length < 8) return say('#askErr', 'Type a fuller question, at least a few words.');
  const b = $('#askBtn'); b.disabled = true; b.textContent = 'Looking…';
  const ans = $('#answer'); ans.hidden = false; ans.replaceChildren(Object.assign(document.createElement('p'), { className: 'loading', textContent: navigator.onLine ? 'Going through the handbook and student tips' : 'You’re offline, so Gemini Nano is answering on this device. This can take a little while' }));
  const slow = setTimeout(() => { const l = document.querySelector('#answer .loading'); if (l) l.textContent = navigator.onLine ? 'Still working. The AI service is slow right now' : 'Still working on this device. The first on-device answer can take up to a minute'; }, 8000);
  try {
    renderAnswer($('#answer'), await ask(q), goAdd);
  } catch (e) {
    console.error(e);
    $('#answer').hidden = true;
    say('#askErr', askError(e));
  } finally { clearTimeout(slow); b.disabled = false; b.textContent = 'Look it up'; }
}
$('#askBtn').onclick = runAsk;
$('#q').addEventListener('keydown', (e) => { if (e.key === 'Enter') runAsk(); });
