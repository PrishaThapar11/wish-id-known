import { mask } from './shield.js';
import assert from 'node:assert';
const r = mask('Mail rahul.k@halden.edu or call 98765 43210, reg 23BCE1234. Dr Mehra said ask Warden Iyer. pay orbit@okhdfcbank.');
assert(!/rahul|98765|23BCE|Mehra|Iyer|orbit@/.test(r.text), r.text);
assert(r.found.EMAIL === 1 && r.found.PHONE === 1 && r.found.REGNO === 1 && r.found.NAME === 2 && r.found.UPI === 1, JSON.stringify(r.found));
const a = mask('My roommate Aisha told me. I live in room 214, block C. Call +91 98765-43210. Friend named Rohan agreed.');
assert(!/Aisha|Rohan|214|98765/.test(a.text), a.text);
assert(/roommate/.test(a.text) && /[Ff]riend/.test(a.text), 'roles are kept');
console.log('shield ok:', r.text);
