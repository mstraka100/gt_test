export const config = {
  port: process.env.PORT || 3000,
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
  jwtExpiresIn: 3600, // 1 hour in seconds
  refreshTokenExpiresIn: 604800, // 7 days in seconds
  bcryptRounds: 10,
};
