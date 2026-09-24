/**
 * Seeds the first platform product-owner admin (idempotent).
 *
 * Usage (uses DB_* from .env, same as migrations):
 *   npm run seed:admin
 *
 * Default credentials (change via forgot-password after first login):
 *   email:    info@mytaxdiary.co.uk
 *   password: Demo@1234
 */
import { join } from 'path';
import * as dotenv from 'dotenv';
import { AppDataSource } from './data-source';
import { Role } from '../modules/users/entities/role.entity';
import { User } from '../modules/users/entities/user.entity';
import { hashPassword } from '../common/helpers/crypto.helper';
import { EMPTY_PERMISSIONS, PLATFORM_ADMIN_ROLE } from '../modules/users/permissions';

dotenv.config({ path: join(process.cwd(), '.env') });

const ADMIN_EMAIL = 'info@mytaxdiary.co.uk';
const ADMIN_PASSWORD = 'Demo@1234';
const ADMIN_FIRST_NAME = 'My';
const ADMIN_LAST_NAME = 'Tax Diary';

async function seedAdmin(): Promise<void> {
  await AppDataSource.initialize();

  try {
    const roleRepo = AppDataSource.getRepository(Role);
    const userRepo = AppDataSource.getRepository(User);

    let adminRole = await roleRepo.findOne({ where: { name: PLATFORM_ADMIN_ROLE } });
    if (!adminRole) {
      adminRole = await roleRepo.save(roleRepo.create({ name: PLATFORM_ADMIN_ROLE }));
      console.log(`Created role: ${PLATFORM_ADMIN_ROLE}`);
    }

    const email = ADMIN_EMAIL.toLowerCase();
    const existing = await userRepo.findOne({ where: { email } });

    if (existing) {
      if (existing.role?.name === PLATFORM_ADMIN_ROLE) {
        console.log(`Platform admin already exists: ${email}`);
        return;
      }
      console.error(
        `Email ${email} already belongs to a non-admin user (role=${existing.role?.name ?? 'none'}). Not converting.`,
      );
      process.exitCode = 1;
      return;
    }

    const passwordHash = await hashPassword(ADMIN_PASSWORD);
    const user = userRepo.create({
      firstName: ADMIN_FIRST_NAME,
      lastName: ADMIN_LAST_NAME,
      firmName: 'My Tax Diary Platform',
      email,
      passwordHash,
      role: adminRole,
      tenantId: undefined,
      permissions: EMPTY_PERMISSIONS,
      isEmailVerified: true,
      isActive: true,
    });
    await userRepo.save(user);

    console.log(`Seeded platform admin: ${email}`);
    console.log(
      'Sign in via POST /auth/admin/login, then use forgot-password to set a strong password.',
    );
  } finally {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  }
}

seedAdmin().catch((err: unknown) => {
  console.error('Failed to seed platform admin', err);
  process.exit(1);
});
