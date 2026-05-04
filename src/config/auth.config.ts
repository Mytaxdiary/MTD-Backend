import { registerAs } from '@nestjs/config';

// TODO (auth phase): wire these into JwtModule and refresh token strategy
export default registerAs('auth', () => ({
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN,
  refreshTokenSecret: process.env.REFRESH_TOKEN_SECRET,
  refreshTokenExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN,
}));
