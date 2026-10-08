import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTenantBillingPeriodEndsAt1782100000000 implements MigrationInterface {
  name = 'AddTenantBillingPeriodEndsAt1782100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`tenants\`
        ADD \`billing_period_ends_at\` datetime NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`tenants\`
        DROP COLUMN \`billing_period_ends_at\`
    `);
  }
}
