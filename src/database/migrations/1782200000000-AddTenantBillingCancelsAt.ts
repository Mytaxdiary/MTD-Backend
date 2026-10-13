import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTenantBillingCancelsAt1782200000000 implements MigrationInterface {
  name = 'AddTenantBillingCancelsAt1782200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`tenants\`
        ADD \`billing_cancels_at\` datetime NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`tenants\`
        DROP COLUMN \`billing_cancels_at\`
    `);
  }
}
