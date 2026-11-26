// Deterministic scrubber. Runs before and after the on-device model, because the model is not a guarantee.
// Office addresses like fees.office@halden.edu help the next student, so they stay. Personal ones are masked.
const ROLE = new Set('office accounts account fees fee hostel warden dean registrar admin exam exams examcell placement placements cdc library helpdesk support info contact mess transport academic academics admissions finance cashier sports'.split(' '));
const isOfficeMail = (m) => { const [local, domain] = m.toLowerCase().split('@'); return /(\.edu|\.ac\.in|\.edu\.in)$/.test(domain) && local.split(/[._-]+/).every((x) => ROLE.has(x) || /^\d+$/.test(x)); };
const RULES = [
  ['EMAIL', /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, isOfficeMail],
  ['UPI', /\b[\w.-]{2,}@(?!\w+\.\w)[a-z]{2,}\b/gi],
  ['AADHAAR', /(?<!\d)\d{4}\s?\d{4}\s?\d{4}(?!\d)/g],
  ['PHONE', /(?<!\d)(?:\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}(?!\d)/g],
  ['REGNO', /\b\d{2}[A-Z]{3}\d{4,5}\b/gi],
  ['ROOM', /\b(?:room|rm)\s*(?:no\.?\s*|number\s*)?#?\d{2,4}[a-z]?\b/gi],
];
const TITLE = /\b(?:Prof(?:essor)?|Dr|Mr|Mrs|Ms|Sir|Madam|Warden)\.?\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?/g;

// "my roommate Aisha" -> "my roommate". Keeps the role, drops the name.
const REL = /\b([Rr]oommate|[Ww]ingmate|[Ff]riend|[Ss]enior|[Jj]unior|[Cc]lassmate|[Bb]atchmate|[Cc]lerk|[Tt]eacher|[Mm]entor|[Cc]oordinator)\s+(?:named\s+|called\s+)?[A-Z][a-z]{2,}\b/g;

export function mask(text) {
  let out = String(text || '');
  const found = {};
  for (const [type, re, keep] of RULES) {
    out = out.replace(re, (m) => { if (keep && keep(m)) return m; found[type] = (found[type] || 0) + 1; return `[${type}]`; });
  }
  out = out.replace(REL, (m, rel) => { found.NAME = (found.NAME || 0) + 1; return rel; });
  out = out.replace(TITLE, (m) => {
    found.NAME = (found.NAME || 0) + 1;
    return /^warden/i.test(m) ? 'the warden' : /^(dr|prof)/i.test(m) ? 'a professor' : 'a staff member';
  });
  return { text: out, found, total: Object.values(found).reduce((a, b) => a + b, 0) };
}
