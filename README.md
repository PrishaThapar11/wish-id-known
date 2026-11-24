# Wish I’d Known

**The things nobody told you, written down by the students who found out the hard way.**
A student-built knowledge base for a fictional university (Halden). Every answer shows what the handbook says, what students report, and what nobody knows yet. Built for #BuildHybridAI 2026 with Firebase AI Logic.

- Live app: _add your Firebase Hosting URL_
- Demo video: _add your YouTube link_

## The problem
Universities have an official rulebook and an unofficial one. Which hostel block is better, what the warden actually stops you for, what happens if you skip experiential learning, how to switch from hosteller to day scholar: none of it is written down, and even seniors disagree. Students who want to share what they learned have good reasons not to put their raw story, names and details into a shared system.

## How hybrid inference is the product
| Step | Mode | Why |
|---|---|---|
| Add a tip: read the raw story, extract one structured tip | `ONLY_ON_DEVICE` (Gemini Nano in Chrome) | The raw story must never leave the device, so there is deliberately no cloud fallback. If Nano is unavailable the student writes the tip by hand. |
| Ask: build an evidence-graded answer | `PREFER_IN_CLOUD` (Gemini, falls back to Nano offline) | Cross-tip reasoning is cloud work, but the same question still works offline. The answer says which model produced it. |

Fixed rules (not just the model) remove names, phone numbers, emails and roll numbers before and after Nano. The student edits and approves the tip and can open **Exactly what will leave this device** before sharing. Ask has the same transparency: **Exactly what was sent**.

## Answers are graded, not just generated
Each answer is split into: **From the handbook**, **Heard from several students** (needs 3 or more tips), **One person’s experience** (always labelled unverified), **Handbook vs. what students report**, and **Still unclear**. The model proposes claims with evidence ids; the app checks them. Claims without valid evidence are dropped, and a "repeated" claim backed by fewer than 3 tips is downgraded. If nothing matches, the app says nobody has written it down instead of guessing.

## Firebase products
Firebase AI Logic (hybrid inference), Firestore, Anonymous Authentication, App Check, Remote Config (answer model and "repeated" threshold, changeable without redeploying), Hosting.

## Privacy, stated precisely
- The raw story stays in the browser.
- Only the approved short tip is stored, with no name and no account id on it.
- Anonymous sign-in lets a student delete their own tips. A separate private record (`tipOwners`) links a tip to the anonymous account. Only that account can read or delete it.
- Tips added through the app appear as **Community tip, unreviewed**. Handbook entries and tips marked **Sample** are invented for the demo and are never presented as real student counts.

## Run it locally
Requires desktop Chrome 139+ for on-device AI (the model downloads on first use).
```
npm install
cp .env.example .env     # fill in your Firebase web config
npm run dev
npm test
```
Firebase setup: enable AI Logic (Gemini Developer API), Firestore, Anonymous sign-in, App Check, and publish `firestore.rules`. Add Remote Config parameters `ask_model` (string) and `repeat_min` (number).

## Built during the contest period
All code in this repository was written during the #BuildHybridAI 2026 contest period.

## License
Apache-2.0
