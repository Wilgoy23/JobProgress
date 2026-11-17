export const STATUSES = [
  { id: 'saved', label: 'Saved' },
  { id: 'applied', label: 'Applied' },
  { id: 'assessment', label: 'Assessment' },
  { id: 'interviewing', label: 'Interviewing' },
  { id: 'offer', label: 'Offer' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'withdrawn', label: 'Withdrawn' },
  { id: 'ghosted', label: 'Ghosted' },
];

export const STATUS_LABEL = Object.fromEntries(STATUSES.map((s) => [s.id, s.label]));
export const STATUS_ORDER = Object.fromEntries(STATUSES.map((s, i) => [s.id, i]));
export const ACTIVE = new Set(['applied', 'assessment', 'interviewing']);
export const CLOSED = new Set(['rejected', 'withdrawn', 'ghosted']);

// Hostname patterns -> friendly job-site name shown on the link button.
export const PORTALS = [
  [/(^|\.)(myworkdayjobs|myworkdaysite|workday)\.com$/, 'Workday'],
  [/(^|\.)greenhouse\.io$/, 'Greenhouse'],
  [/(^|\.)lever\.co$/, 'Lever'],
  [/(^|\.)ashbyhq\.com$/, 'Ashby'],
  [/(^|\.)icims\.com$/, 'iCIMS'],
  [/(^|\.)smartrecruiters\.com$/, 'SmartRecruiters'],
  [/(^|\.)taleo\.net$/, 'Taleo'],
  [/(^|\.)(successfactors|sapsf)\.(com|eu)$/, 'SuccessFactors'],
  [/(^|\.)oraclecloud\.com$/, 'Oracle'],
  [/(^|\.)jobvite\.com$/, 'Jobvite'],
  [/(^|\.)bamboohr\.com$/, 'BambooHR'],
  [/(^|\.)workable\.com$/, 'Workable'],
  [/(^|\.)linkedin\.com$/, 'LinkedIn'],
  [/(^|\.)indeed\.com$/, 'Indeed'],
  [/(^|\.)glassdoor\.[a-z.]+$/, 'Glassdoor'],
  [/(^|\.)joinhandshake\.com$/, 'Handshake'],
  [/(^|\.)wellfound\.com$/, 'Wellfound'],
  [/(^|\.)ziprecruiter\.com$/, 'ZipRecruiter'],
];
