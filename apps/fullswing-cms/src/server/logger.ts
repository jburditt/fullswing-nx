export const cmsLoggerOptions = {
  level: process.env.LOG_LEVEL ?? 'info',
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers.set-cookie',
      'accessToken',
      'refreshToken',
      'clientSecret',
      'githubToken',
    ],
    censor: '[REDACTED]',
  },
};