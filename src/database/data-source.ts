import * as dotenv from 'dotenv';
import { DataSource } from 'typeorm';
import { join } from 'path';

/**
 * Standalone TypeORM DataSource used by the TypeORM CLI for migrations.
 * NestJS uses TypeOrmModule.forRootAsync() in app.module.ts instead.
 *
 * Usage:
 *   npm run migration:generate -- src/database/migrations/MigrationName
 *   npm run migration:run
 *   npm run migration:revert
 */
dotenv.config({ path: join(process.cwd(), '.env') });

export const AppDataSource = new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  entities: [join(__dirname, '/../**/*.entity{.ts,.js}')],
  migrations: [join(__dirname, '/migrations/*{.ts,.js}')],
  synchronize: false,
  logging: false,
});
