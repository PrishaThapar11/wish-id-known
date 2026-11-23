import { initializeApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import { getAI, GoogleAIBackend } from 'firebase/ai';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getFirestore, addDoc, collection, serverTimestamp } from 'firebase/firestore';

const env = import.meta.env;
export const app = initializeApp({
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  appId: env.VITE_FIREBASE_APP_ID,
});

// Local dev: prints a debug token in the console. Register it in Firebase > App Check > Manage debug tokens.
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
  // The tip document carries no uid. Auth is only used so the rules can require a signed-in client.
  return addDoc(collection(db, 'tips'), { ...tip, status: 'pending', createdAt: serverTimestamp() });
}
