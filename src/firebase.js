import { initializeApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import { getAI, GoogleAIBackend } from 'firebase/ai';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getFirestore, addDoc, collection, serverTimestamp, getDocs, query, where, limit, setDoc, doc, getDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { getRemoteConfig, fetchAndActivate, getValue } from 'firebase/remote-config';

const env = import.meta.env;
export const app = initializeApp({
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  appId: env.VITE_FIREBASE_APP_ID,
});

// Local dev: prints a debug token in the console. 
if (env.DEV) self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
if (env.DEV || env.VITE_RECAPTCHA_SITE_KEY) {
  initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(env.VITE_RECAPTCHA_SITE_KEY || 'debug-placeholder'),
    isTokenAutoRefreshEnabled: true,
  });
}

export const ai = getAI(app, { backend: new GoogleAIBackend() });
const auth = getAuth(app);
const db = getFirestore(app);

export async function saveTip(tip) {
  if (!auth.currentUser) await signInAnonymously(auth);
  // One atomic batch: the tip and its private owner record are created together or not at all.
  // The tip itself never carries an account id. The rules reject an owner record for a tip that already exists.
  const ref = doc(collection(db, 'tips'));
  const b = writeBatch(db);
  b.set(ref, { ...tip, status: 'community', createdAt: serverTimestamp() });
  b.set(doc(db, 'tipOwners', ref.id), { uid: auth.currentUser.uid });
  await b.commit();
  return ref;
}

export async function loadCommunity() {
  const s = await getDocs(query(collection(db, 'tips'), where('status', '==', 'community'), limit(100)));
  return s.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// Remote Config: change the answer model or the "repeated" threshold from the console, no redeploy.
const rc = getRemoteConfig(app);
rc.settings.minimumFetchIntervalMillis = env.DEV ? 0 : 3600000;
rc.defaultConfig = { ask_model: 'gemini-3.5-flash-lite', repeat_min: 3 };
let cfg;
export const loadConfig = () => cfg || (cfg = fetchAndActivate(rc).catch((e) => console.warn('Remote Config unavailable, using defaults', e)).then(() => ({
  model: getValue(rc, 'ask_model').asString(), repeatMin: getValue(rc, 'repeat_min').asNumber() || 3,
})));

// Tips this browser's anonymous account created. The account persists in this browser until site data is cleared.
export async function myTips() {
  await auth.authStateReady();
  if (!auth.currentUser) return [];
  const o = await getDocs(query(collection(db, 'tipOwners'), where('uid', '==', auth.currentUser.uid)));
  const snaps = await Promise.all(o.docs.map((d) => getDoc(doc(db, 'tips', d.id))));
  return snaps.filter((s) => s.exists()).map((s) => ({ id: s.id, ...s.data() }));
}
export async function deleteTip(id) {
  await deleteDoc(doc(db, 'tips', id));
  await deleteDoc(doc(db, 'tipOwners', id));
}
