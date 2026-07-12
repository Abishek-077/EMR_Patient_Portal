const nodeEnv = process.env.NODE_ENV || 'development';
const host = process.env.HOST || '127.0.0.1';
const sessionSecret = process.env.SESSION_SECRET || (nodeEnv === 'production' ? '' : 'local-development-change-me');

if (!sessionSecret) {
  throw new Error('SESSION_SECRET is required when NODE_ENV=production');
}

const defaultOrigins = [
  `http://${host}:5173`,
  'http://127.0.0.1:5173',
  'http://localhost:5173',
];

const cookieSameSite = normalizeSameSite(process.env.COOKIE_SAME_SITE || 'lax');
const cookieSecure = booleanValue(process.env.COOKIE_SECURE, nodeEnv === 'production');

if (cookieSameSite === 'none' && !cookieSecure) {
  throw new Error('COOKIE_SECURE must be true when COOKIE_SAME_SITE=none');
}

export const env = Object.freeze({
  host,
  nodeEnv,
  port: positiveNumber(process.env.PORT, 4000),
  apiBasePath: normalizeBasePath(process.env.API_BASE_PATH || '/api'),
  allowedOrigins: csv(process.env.ALLOWED_ORIGINS, defaultOrigins),
  sessionTtlHours: positiveNumber(process.env.SESSION_TTL_HOURS, 12),
  rememberSessionTtlHours: positiveNumber(process.env.REMEMBER_SESSION_TTL_HOURS, 168),
  maxSessionsPerUser: Math.max(1, Math.floor(positiveNumber(process.env.MAX_SESSIONS_PER_USER, 10))),
  passwordResetTtlMinutes: positiveNumber(process.env.PASSWORD_RESET_TTL_MINUTES, 30),
  sessionSecret,
  cookieSecure,
  cookieSameSite,
  databasePath: process.env.EMR_DB_PATH || '',
  uploadPath: process.env.EMR_UPLOAD_DIR || '',
  paymentProvider: process.env.PAYMENT_PROVIDER || 'local-sandbox',
  notificationProvider: process.env.NOTIFICATION_PROVIDER || 'local-outbox',
  clinicalProvider: process.env.CLINICAL_PROVIDER || 'local-clinical-store',
});

function positiveNumber(value, fallback) {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function booleanValue(value, fallback) {
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
}

function csv(value, fallback) {
  const entries = String(value || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  return [...new Set(entries.length ? entries : fallback)];
}

function normalizeSameSite(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return ['lax', 'strict', 'none'].includes(normalized) ? normalized : 'lax';
}

function normalizeBasePath(value) {
  const normalized = `/${String(value || 'api').trim().replace(/^\/+|\/+$/g, '')}`;
  return normalized === '/' ? '/api' : normalized;
}
