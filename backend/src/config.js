export const env = {
  host: process.env.HOST || '127.0.0.1',
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 4000),
  sessionTtlHours: Number(process.env.SESSION_TTL_HOURS || 168),
};

