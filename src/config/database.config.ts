import { registerAs } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { join } from 'path';

export default registerAs('database', () => ({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  name: process.env.DB_NAME,
  url: process.env.DATABASE_URL,
}));

/**
 * TypeORM connection options factory.
 * Used in TypeOrmModule.forRootAsync() inside app.module.ts.
 * synchronize is intentionally false — always use migrations.
 */
export const typeOrmConfig = (): TypeOrmModuleOptions => ({
  type: 'mysql',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  entities: [join(__dirname, '../**/*.entity{.ts,.js}')],
  migrations: [join(__dirname, '../database/migrations/*{.ts,.js}')],
  autoLoadEntities: true,
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
  retryAttempts: 3,
  retryDelay: 3000,
});
