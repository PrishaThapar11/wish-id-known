import { loadCommunity } from './firebase.js';
import { TIPS, SHELF } from './seed.js';

let community = [];
export const allTips = () => [...TIPS, ...community];
export async function refreshPool() {
  try {
    community = (await loadCommunity()).map((d) => ({
      id: 'C' + d.id, topic: d.topic, shelf: SHELF[d.topic] || '', kind: d.kind, when: d.when,
      text: `${d.claim} ${d.detail}`.trim(), origin: 'community',
    }));
  } catch (e) { console.warn('Community tips unavailable', e); }
  return community;
}
