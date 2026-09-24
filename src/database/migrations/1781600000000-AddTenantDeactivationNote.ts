import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTenantDeactivationNote1781600000000 implements MigrationInterface {
  name = 'AddTenantDeactivationNote1781600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`tenants\`
        ADD COLUMN \`deactivation_reason\` TEXT NULL,
        ADD COLUMN \`deactivated_at\` DATETIME NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`tenants\`
        DROP COLUMN \`deactivation_reason\`,
        DROP COLUMN \`deactivated_at\`
    `);
  }
}
