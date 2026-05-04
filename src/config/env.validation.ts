import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  // Application
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(3001),

  // Database
  DB_HOST: Joi.string().default('localhost'),
  DB_PORT: Joi.number().default(3306),
  DB_USER: Joi.string().required(),
  DB_PASSWORD: Joi.string().allow('').optional(),
  DB_NAME: Joi.string().required(),
  DATABASE_URL: Joi.string().uri().optional(),

  // App
  FRONTEND_URL: Joi.string().uri().default('http://localhost:3000'),

  // Rate limiting
  THROTTLE_TTL: Joi.number().default(60),
  THROTTLE_LIMIT: Joi.number().default(100),

  // Security
  BCRYPT_ROUNDS: Joi.number().min(10).max(14).default(12),

  // Auth — TODO (auth phase): make JWT_SECRET required once auth module is built
  JWT_SECRET: Joi.string().optional(),
  JWT_EXPIRES_IN: Joi.string().default('1d'),
  REFRESH_TOKEN_SECRET: Joi.string().optional(),
  REFRESH_TOKEN_EXPIRES_IN: Joi.string().default('7d'),
});
