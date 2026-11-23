// Deterministic scrubber. Runs before and after the on-device model, because the model is not a guarantee.
const RULES = [
  ['EMAIL', /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g],
  ['UPI', /\b[\w.-]{2,}@(?!\w+\.\w)[a-z]{2,}\b/gi],
  ['AADHAAR', /(?<!\d)\d{4}\s?\d{4}\s?\d{4}(?!\d)/g],
  ['PHONE', /(?<!\d)(?:\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}(?!\d)/g],
  ['REGNO', /\b\d{2}[A-Z]{3}\d{4,5}\b/gi],
];
const TITLE = /\b(?:Prof(?:essor)?|Dr|Mr|Mrs|Ms|Sir|Madam|Warden)\.?\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?/g;

export function mask(text) {
  let out = String(text || '');
  const found = {};
  for (const [type, re] of RULES) {
    out = out.replace(re, () => { found[type] = (found[type] || 0) + 1; return `[${type}]`; });
  }
  out = out.replace(TITLE, (m) => {
    found.NAME = (found.NAME || 0) + 1;
    return /^warden/i.test(m) ? 'the warden' : /^(dr|prof)/i.test(m) ? 'a professor' : 'a staff member';
  });
  return { text: out, found, total: Object.values(found).reduce((a, b) => a + b, 0) };
}
