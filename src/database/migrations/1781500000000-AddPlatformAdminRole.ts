import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Seeds the platform `admin` role (product-owner / My Tax Diary staff).
 * Distinct from firm roles `owner` and `staff`. No new column on users —
 * reuses roles + users.role_id.
 */
export class AddPlatformAdminRole1781500000000 implements MigrationInterface {
  name = 'AddPlatformAdminRole1781500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO \`roles\` (\`id\`, \`createdAt\`, \`updatedAt\`, \`deletedAt\`, \`name\`)
      SELECT UUID(), NOW(6), NOW(6), NULL, 'admin'
      FROM DUAL
      WHERE NOT EXISTS (SELECT 1 FROM \`roles\` WHERE \`name\` = 'admin')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM \`roles\`
      WHERE \`name\` = 'admin'
        AND NOT EXISTS (
          SELECT 1 FROM \`users\` WHERE \`users\`.\`role_id\` = \`roles\`.\`id\`
        )
    `);
  }
}
