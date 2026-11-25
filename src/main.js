import { mask } from './shield.js';
import { nanoStatus, extractTip } from './nano.js';
import { saveTip } from './firebase.js';
import { refreshPool } from './pool.js';
import './app.js';

const $ = (s) => document.querySelector(s);
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
  const btn = $('#go'); btn.disabled = true; btn.textContent = 'Reading it on this device…';
  const m = mask(raw);
  let fields = { topic: 'campus', kind: 'pattern', claim: '', detail: '' };
  let note = 'Fill in the tip yourself. Your original text has not been kept or sent anywhere.';
  try {
    if ((await nanoStatus()) === 'unavailable') throw new Error('unavailable');
    fields = await extractTip(m.text);
    note = 'This is what the on-device model pulled out of your story. Edit anything that is wrong or too specific.';
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
async function runAsk() {
  say('#askErr', '');
  const q = $('#q').value.trim();
  if (q.length < 8) return say('#askErr', 'Type a fuller question, at least a few words.');
  const b = $('#askBtn'); b.disabled = true; b.textContent = 'Looking…';
  const ans = $('#answer'); ans.hidden = false; ans.replaceChildren(Object.assign(document.createElement('p'), { className: 'loading', textContent: 'Going through the handbook and student tips' }));
  try {
    renderAnswer($('#answer'), await ask(q), goAdd);
  } catch (e) {
    console.error(e);
    $('#answer').hidden = true;
    say('#askErr', navigator.onLine ? (/500|503|429|timeout|timed out|overload|demand/i.test(`${e.code} ${e.message}`) ? 'The AI service is busy right now. Wait a few seconds and try again.' : `Couldn’t get an answer (${e.code || e.message}).`) : 'Asking needs a connection. Adding a tip still works offline.');
  } finally { b.disabled = false; b.textContent = 'Look it up'; }
}
$('#askBtn').onclick = runAsk;
$('#q').addEventListener('keydown', (e) => { if (e.key === 'Enter') runAsk(); });
